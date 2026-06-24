"""Machine Learning model training pipeline for blockchain risk assessment."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Tuple, List

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
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

from app.core.config import (
    DATASET_PATH,
    MODEL_DIRECTORY,
    RISK_MODEL_FILENAME,
    SCALER_FILENAME,
    FEATURES_FILENAME,
    DECISION_THRESHOLD_FILENAME,
    TEST_SPLIT_RATIO,
    RANDOM_SEED
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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


EXCLUDED_FEATURES = [
    'Unnamed: 0', 'Index', 'Address', 'FLAG',
    'min value sent to contract', 'max val sent to contract',
    'avg value sent to contract', 'total ether sent contracts',
    ' ERC20 most sent token type', 'ERC20_most_rec_token_type',
    ' ERC20 uniq sent token name', ' ERC20 uniq rec token name',
]


def load_dataset(dataset_path: str) -> pd.DataFrame:
    """
    Load transaction dataset from CSV file.

    Args:
        dataset_path: Path to dataset CSV file

    Returns:
        Pandas DataFrame containing transaction data

    Raises:
        FileNotFoundError: If dataset file doesn't exist
    """
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    logger.info(f"Loading dataset from {dataset_path}")
    return pd.read_csv(dataset_path)


def preprocess_features(dataframe: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Extract and clean features from raw dataset.

    Args:
        dataframe: Raw dataset dataframe

    Returns:
        Tuple of (feature matrix, target labels)
    """
    if 'FLAG' not in dataframe.columns:
        raise ValueError("Dataset missing required 'FLAG' target column")

    target_labels = dataframe['FLAG']

    columns_to_drop = [col for col in EXCLUDED_FEATURES if col in dataframe.columns]
    feature_matrix = dataframe.drop(columns=columns_to_drop)

    feature_matrix = feature_matrix.fillna(0)

    for column in feature_matrix.columns:
        feature_matrix[column] = pd.to_numeric(feature_matrix[column], errors='coerce').fillna(0)

    logger.info(f"Preprocessed {feature_matrix.shape[1]} features from dataset")
    return feature_matrix, target_labels


def train_model(
    features: pd.DataFrame,
    labels: pd.Series
) -> Tuple[RandomForestClassifier, StandardScaler, Dict[str, float]]:
    """
    Train Random Forest classifier with feature scaling.

    Args:
        features: Feature matrix
        labels: Target labels

    Returns:
        Tuple of (trained model, fitted scaler, metrics dict)
    """
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    X_train, X_test, y_train, y_test = train_test_split(
        scaled_features, labels,
        test_size=TEST_SPLIT_RATIO,
        random_state=RANDOM_SEED,
        stratify=labels
    )

    minority_count = int(y_train.sum())
    if minority_count > 1 and _has_smote:
        smote = SMOTE(random_state=RANDOM_SEED, k_neighbors=min(3, minority_count - 1))
        X_train, y_train = smote.fit_resample(X_train, y_train)
        logger.info(f"After SMOTE: {len(X_train)} samples, {int(y_train.sum())} fraud")
    elif minority_count > 1:
        fraud_idx = np.where(y_train == 1)[0]
        safe_idx = np.where(y_train == 0)[0]
        oversampled_fraud = np.random.choice(fraud_idx, size=len(safe_idx) - len(fraud_idx), replace=True)
        X_train = np.vstack([X_train, X_train[oversampled_fraud]])
        y_train = np.hstack([y_train, np.ones(len(oversampled_fraud))])
        logger.info(f"After manual oversampling: {len(X_train)} samples, {int(y_train.sum())} fraud")

    logger.info("Training Random Forest classifier...")
    classifier = RandomForestClassifier(
        n_estimators=500,
        random_state=RANDOM_SEED,
        class_weight='balanced_subsample',
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=4,
        max_features='sqrt',
        n_jobs=-1
    )

    classifier.fit(X_train, y_train)

    accuracy = classifier.score(X_test, y_test)
    probas = classifier.predict_proba(X_test)
    threshold = _find_optimal_threshold(y_test.values, probas)
    predictions = (probas[:, 1] >= threshold).astype(int)
    precision = precision_score(y_test, predictions, zero_division=0)
    recall = recall_score(y_test, predictions, zero_division=0)
    f1 = f1_score(y_test, predictions, zero_division=0)

    metrics = {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "decision_threshold": round(threshold, 4),
        "n_features": features.shape[1],
        "n_train": len(X_train),
        "n_test": len(X_test),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    logger.info(f"Metrics: {json.dumps(metrics, indent=2)}")
    logger.info(f"\nConfusion Matrix:\n{confusion_matrix(y_test, predictions)}")

    return classifier, scaler, metrics


METRICS_FILENAME: str = "model_metrics.json"


def save_model_artifacts(
    model: RandomForestClassifier,
    scaler: StandardScaler,
    feature_names: List[str],
    metrics: Dict[str, float],
    base_dir: str,
    decision_threshold: float = 0.5
) -> None:
    """
    Persist trained model artifacts and metrics to disk.

    Args:
        model: Trained classifier
        scaler: Fitted feature scaler
        feature_names: List of feature column names
        metrics: Training metrics dict
        base_dir: Base directory for saving artifacts
        decision_threshold: Optimal decision threshold
    """
    model_dir = os.path.join(base_dir, MODEL_DIRECTORY)
    os.makedirs(model_dir, exist_ok=True)

    model_path = os.path.join(model_dir, RISK_MODEL_FILENAME)
    scaler_path = os.path.join(model_dir, SCALER_FILENAME)
    features_path = os.path.join(model_dir, FEATURES_FILENAME)
    threshold_path = os.path.join(model_dir, DECISION_THRESHOLD_FILENAME)

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_names, features_path)
    joblib.dump(decision_threshold, threshold_path)

    metrics_path = os.path.join(model_dir, METRICS_FILENAME)
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Model artifacts saved to {model_dir}")


def train() -> None:
    """Main training pipeline execution."""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        dataset_full_path = os.path.join(base_dir, DATASET_PATH)

        dataset = load_dataset(dataset_full_path)
        features, labels = preprocess_features(dataset)

        logger.info(f"Dataset shape: {features.shape}")
        logger.info(f"Class distribution: {labels.value_counts().to_dict()}")

        model, scaler, metrics = train_model(features, labels)
        save_model_artifacts(model, scaler, list(features.columns), metrics, base_dir, metrics.get("decision_threshold", 0.5))

        logger.info("Training pipeline completed successfully")

    except Exception as training_error:
        logger.error(f"Training failed: {training_error}")
        raise


if __name__ == "__main__":
    train()
