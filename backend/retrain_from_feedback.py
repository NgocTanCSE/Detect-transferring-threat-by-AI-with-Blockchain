"""Retrain ML model using admin feedback labels from database."""

import json
import logging
import os
import sys
import shutil
from datetime import datetime, timezone

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV, TimeSeriesSplit
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, precision_score, recall_score, f1_score, precision_recall_curve
try:
    from imblearn.over_sampling import SMOTE
    _has_smote = True
except ImportError:
    _has_smote = False
    SMOTE = None
import joblib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db, SessionLocal
from app.models.models import FeedbackLabel, Wallet, Transaction, ModelRegistry
from app.services.feature_extractor import extract_transaction_features
from app.core.config import MODEL_DIRECTORY, RISK_MODEL_FILENAME, SCALER_FILENAME, FEATURES_FILENAME, DECISION_THRESHOLD_FILENAME, RANDOM_SEED

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def _find_optimal_threshold(y_true: np.ndarray, probas: np.ndarray, target_precision: float = 0.60) -> float:
    best_threshold = 0.5
    best_f1 = 0.0
    for threshold in np.arange(0.10, 0.95, 0.01):
        preds = (probas[:, 1] >= threshold).astype(int)
        prec = precision_score(y_true, preds, zero_division=0)
        rec = recall_score(y_true, preds, zero_division=0)
        f1 = f1_score(y_true, preds, zero_division=0)
        if prec >= target_precision and f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold
    return best_threshold


def load_feedback_data(db) -> pd.DataFrame:
    labels = db.query(FeedbackLabel).filter(
        FeedbackLabel.admin_label.in_(["fraud", "safe"]),
        FeedbackLabel.used_for_training == False
    ).all()
    if not labels:
        logger.info("No new feedback labels found for retraining")
        return pd.DataFrame()
    rows = []
    for lbl in labels:
        address = lbl.wallet_address
        txs = db.query(Transaction).filter(
            (Transaction.from_address == address) | (Transaction.to_address == address)
        ).order_by(Transaction.timestamp.desc().nullslast()).limit(100).all()
        if not txs:
            logger.warning(f"Skipping feedback wallet {address}: no transactions found")
            continue
        tx_dicts = [
            {
                "tx_hash": tx.tx_hash, "from_address": tx.from_address,
                "to_address": tx.to_address, "value": int(tx.value or 0),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "gas_price": int(tx.gas_price or 0), "gas_used": int(tx.gas_used or 0),
                "block_number": int(tx.block_number or 0), "chain_id": tx.chain_id,
            }
            for tx in txs
        ]
        features = extract_transaction_features(address, tx_dicts)
        if features is None or features.empty:
            logger.warning(f"Skipping feedback wallet {address}: feature extraction failed")
            continue
        feature_row = features.iloc[0].to_dict()
        feature_row["flag"] = 1 if lbl.admin_label == "fraud" else 0
        rows.append(feature_row)
    if not rows:
        logger.info("No valid feedback samples with transaction data")
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    logger.info(f"Loaded {len(df)} feedback samples with full features ({int(df['flag'].sum())} fraud)")
    return df


def retrain():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(base_dir, MODEL_DIRECTORY)
    dataset_path = os.path.join(base_dir, "transaction_dataset.csv")

    if not os.path.exists(dataset_path):
        logger.error(f"Dataset not found at {dataset_path}")
        return

    original = pd.read_csv(dataset_path)
    if "FLAG" not in original.columns:
        logger.error("Dataset missing FLAG column")
        return
    exclude_cols = ['Unnamed: 0', 'Index', 'Address', 'FLAG']
    feature_cols = [c for c in original.columns if c not in exclude_cols]
    X_orig = original[feature_cols].fillna(0).apply(pd.to_numeric, errors='coerce').fillna(0)
    y_orig = original["FLAG"]

    db = SessionLocal()
    try:
        feedback_df = load_feedback_data(db)
    finally:
        db.close()

    if not feedback_df.empty:
        common_cols = [c for c in feature_cols if c in feedback_df.columns]
        missing_cols = [c for c in feature_cols if c not in feedback_df.columns]
        if missing_cols:
            logger.warning(f"Feedback data missing {len(missing_cols)} feature columns, filling with 0")
        feedback_features = feedback_df[common_cols].fillna(0)
        X = pd.concat([X_orig[common_cols], feedback_features], ignore_index=True).fillna(0)
        y = pd.concat([y_orig.iloc[:len(X_orig)], feedback_df["flag"]], ignore_index=True)
        logger.info(f"Combined dataset: {len(X)} samples ({int(y.sum())} fraud)")
    else:
        X, y = X_orig, y_orig

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X.values)

    # Time-based split (sort by index as proxy for temporal ordering)
    split_idx = int(len(X_scaled) * 0.8)
    X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
    y_train, y_test = y.values[:split_idx], y.values[split_idx:]

    minority_count = int(y_train.sum())
    if minority_count > 1 and _has_smote:
        smote = SMOTE(random_state=RANDOM_SEED, k_neighbors=min(3, minority_count - 1))
        X_train, y_train = smote.fit_resample(X_train, y_train)
    elif minority_count > 1:
        fraud_idx = np.where(y_train == 1)[0]
        safe_idx = np.where(y_train == 0)[0]
        oversampled_fraud = np.random.choice(fraud_idx, size=len(safe_idx) - len(fraud_idx), replace=True)
        X_train = np.vstack([X_train, X_train[oversampled_fraud]])
        y_train = np.hstack([y_train, np.ones(len(oversampled_fraud))])

    # GridSearchCV for hyperparameter tuning
    param_grid = {
        'n_estimators': [200, 500],
        'max_depth': [15, 25, None],
        'min_samples_split': [5, 10],
        'min_samples_leaf': [2, 4],
    }
    base_model = RandomForestClassifier(random_state=RANDOM_SEED, class_weight='balanced_subsample', n_jobs=-1)
    grid_search = GridSearchCV(base_model, param_grid, cv=TimeSeriesSplit(n_splits=3), scoring='f1', n_jobs=-1)
    grid_search.fit(X_train, y_train)
    model = grid_search.best_estimator_
    logger.info(f"Best params: {grid_search.best_params_} (CV F1: {grid_search.best_score_:.4f})")

    probas = model.predict_proba(X_test)
    decision_threshold = _find_optimal_threshold(y_test, probas)
    predictions = (probas[:, 1] >= decision_threshold).astype(int)

    # Feature importance logging
    feature_importance = dict(zip(feature_cols, model.feature_importances_.tolist()))
    top_features = sorted(feature_importance.items(), key=lambda x: -x[1])[:20]

    metrics = {
        "accuracy": round(model.score(X_test, y_test), 4),
        "precision": round(precision_score(y_test, predictions, zero_division=0), 4),
        "recall": round(recall_score(y_test, predictions, zero_division=0), 4),
        "f1_score": round(f1_score(y_test, predictions, zero_division=0), 4),
        "decision_threshold": round(decision_threshold, 4),
        "n_features": X.shape[1],
        "n_train": len(X_train),
        "n_test": len(X_test),
        "feedback_samples": len(feedback_df) if not feedback_df.empty else 0,
        "best_params": grid_search.best_params_,
        "cv_f1": round(grid_search.best_score_, 4),
        "top_features": dict(top_features),
        "feature_importance_count": len(feature_importance),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Atomic model swap: write to timestamped version dir, then update "current" symlink
    version_tag = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    version_dir = os.path.join(model_dir, f"v_{version_tag}")
    os.makedirs(version_dir, exist_ok=True)
    joblib.dump(model, os.path.join(version_dir, RISK_MODEL_FILENAME))
    joblib.dump(scaler, os.path.join(version_dir, SCALER_FILENAME))
    joblib.dump(list(feature_cols), os.path.join(version_dir, FEATURES_FILENAME))
    joblib.dump(decision_threshold, os.path.join(version_dir, DECISION_THRESHOLD_FILENAME))
    with open(os.path.join(version_dir, "model_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Update "current" symlink
    current_link = os.path.join(model_dir, "current")
    if os.path.islink(current_link) or os.path.exists(current_link):
        os.remove(current_link)
    os.symlink(version_dir, current_link)
    logger.info(f"Model saved to {version_dir}, current symlink updated")

    # Register in ModelRegistry
    db = SessionLocal()
    try:
        registry_entry = ModelRegistry(
            model_name="risk_predictor",
            version=version_tag,
            artifact_uri=version_dir,
            framework="sklearn",
            is_active=True,
            promoted_by="retrain",
            promoted_at=datetime.now(timezone.utc),
        )
        db.add(registry_entry)
        # Deactivate previous active entries
        db.query(ModelRegistry).filter(
            ModelRegistry.model_name == "risk_predictor",
            ModelRegistry.id != registry_entry.id
        ).update({"is_active": False})
        db.commit()
        logger.info(f"Registered model risk_predictor:{version_tag} in ModelRegistry")
    except Exception as reg_error:
        logger.warning(f"Failed to register model in registry: {reg_error}")
        db.rollback()
    finally:
        db.close()

    if not feedback_df.empty:
        db = SessionLocal()
        try:
            labels = db.query(FeedbackLabel).filter(
                FeedbackLabel.admin_label.in_(["fraud", "safe"]),
                FeedbackLabel.used_for_training == False
            ).all()
            for lbl in labels:
                lbl.used_for_training = True
            db.commit()
            logger.info(f"Marked {len(labels)} feedback labels as used for training")
        finally:
            db.close()

    logger.info(f"Retraining complete. Metrics: {json.dumps(metrics, indent=2)}")


if __name__ == "__main__":
    retrain()
