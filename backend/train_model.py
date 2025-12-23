"""Machine Learning model training pipeline for blockchain risk assessment."""

import logging
import os
from typing import Tuple, List

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import joblib

from app.core.config import (
    DATASET_PATH,
    MODEL_DIRECTORY,
    RISK_MODEL_FILENAME,
    SCALER_FILENAME,
    FEATURES_FILENAME,
    TEST_SPLIT_RATIO,
    RANDOM_SEED
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

EXCLUDED_FEATURES = [
    'Unnamed: 0', 'Index', 'Address', 'FLAG',
    'min value sent to contract', 'max val sent to contract',
    'avg value sent to contract', 'total ether sent contracts',
    'ERC20 most sent token type', 'ERC20_most_rec_token_type',
    'ERC20 uniq sent token name', 'ERC20 uniq rec token name'
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
) -> Tuple[RandomForestClassifier, StandardScaler]:
    """
    Train Random Forest classifier with feature scaling.

    Args:
        features: Feature matrix
        labels: Target labels

    Returns:
        Tuple of (trained model, fitted scaler)
    """
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    X_train, X_test, y_train, y_test = train_test_split(
        scaled_features, labels,
        test_size=TEST_SPLIT_RATIO,
        random_state=RANDOM_SEED,
        stratify=labels
    )

    logger.info("Training Random Forest classifier...")
    classifier = RandomForestClassifier(
        n_estimators=100,
        random_state=RANDOM_SEED,
        class_weight='balanced',
        max_depth=15,
        min_samples_split=5,
        n_jobs=-1
    )

    classifier.fit(X_train, y_train)

    accuracy = classifier.score(X_test, y_test)
    logger.info(f"Model accuracy on test set: {accuracy:.4f}")

    predictions = classifier.predict(X_test)
    logger.info("\nClassification Report:")
    logger.info(f"\n{classification_report(y_test, predictions)}")

    return classifier, scaler


def save_model_artifacts(
    model: RandomForestClassifier,
    scaler: StandardScaler,
    feature_names: List[str]
) -> None:
    """
    Persist trained model artifacts to disk.

    Args:
        model: Trained classifier
        scaler: Fitted feature scaler
        feature_names: List of feature column names
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, MODEL_DIRECTORY)
    os.makedirs(model_dir, exist_ok=True)

    model_path = os.path.join(model_dir, RISK_MODEL_FILENAME)
    scaler_path = os.path.join(model_dir, SCALER_FILENAME)
    features_path = os.path.join(model_dir, FEATURES_FILENAME)

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_names, features_path)

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

        model, scaler = train_model(features, labels)
        save_model_artifacts(model, scaler, list(features.columns))

        logger.info("Training pipeline completed successfully")

    except Exception as training_error:
        logger.error(f"Training failed: {training_error}")
        raise


if __name__ == "__main__":
    train()
