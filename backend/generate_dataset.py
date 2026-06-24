"""Synthetic dataset generator for blockchain risk model training.

Generates a realistic transaction_dataset.csv matching the feature schema
expected by train_model.py, based on statistics from the existing trained scaler.
"""

import os
import numpy as np
import pandas as pd

from app.core.config import DATASET_PATH, RANDOM_SEED

RNG = np.random.default_rng(RANDOM_SEED)
N_SAMPLES = 10000
FRAUD_RATIO = 0.12

FEATURE_COLS = [
    "Avg min between sent tnx",
    "Avg min between received tnx",
    "Time Diff between first and last (Mins)",
    "Sent tnx",
    "Received Tnx",
    "Number of Created Contracts",
    "Unique Received From Addresses",
    "Unique Sent To Addresses",
    "min value received",
    "max value received ",
    "avg val received",
    "min val sent",
    "max val sent",
    "avg val sent",
    "total transactions (including tnx to create contract",
    "total Ether sent",
    "total ether received",
    "total ether balance",
    " Total ERC20 tnxs",
    " ERC20 total Ether received",
    " ERC20 total ether sent",
    " ERC20 total Ether sent contract",
    " ERC20 uniq sent addr",
    " ERC20 uniq rec addr",
    " ERC20 uniq sent addr.1",
    " ERC20 uniq rec contract addr",
    " ERC20 avg time between sent tnx",
    " ERC20 avg time between rec tnx",
    " ERC20 avg time between rec 2 tnx",
    " ERC20 avg time between contract tnx",
    " ERC20 min val rec",
    " ERC20 max val rec",
    " ERC20 avg val rec",
    " ERC20 min val sent",
    " ERC20 max val sent",
    " ERC20 avg val sent",
    " ERC20 min val sent contract",
    " ERC20 max val sent contract",
    " ERC20 avg val sent contract",
    " ERC20 uniq sent token name",
    " ERC20 uniq rec token name",
    " ERC20 most sent token type",
    "ERC20_most_rec_token_type",
]

COL_MEAN = {
    "Avg min between sent tnx": 5086.9,
    "Avg min between received tnx": 8004.9,
    "Time Diff between first and last (Mins)": 218333.3,
    "Sent tnx": 115.9,
    "Received Tnx": 163.7,
    "Number of Created Contracts": 3.7,
    "Unique Received From Addresses": 30.4,
    "Unique Sent To Addresses": 25.8,
    "min value received": 43.8,
    "max value received ": 523.2,
    "avg val received": 100.7,
    "min val sent": 4.8,
    "max val sent": 314.6,
    "avg val sent": 44.8,
    "total transactions (including tnx to create contract": 283.4,
    "total Ether sent": 10160.9,
    "total ether received": 11638.3,
    "total ether balance": 1477.4,
    " Total ERC20 tnxs": 33.2,
    " ERC20 total Ether received": 118701504.7,
    " ERC20 total ether sent": 12700219.0,
    " ERC20 total Ether sent contract": 101.6,
    " ERC20 uniq sent addr": 5.2,
    " ERC20 uniq rec addr": 7.0,
    " ERC20 uniq sent addr.1": 0.0,
    " ERC20 uniq rec contract addr": 4.5,
    " ERC20 avg time between sent tnx": 0.0,
    " ERC20 avg time between rec tnx": 0.0,
    " ERC20 avg time between rec 2 tnx": 0.0,
    " ERC20 avg time between contract tnx": 0.0,
    " ERC20 min val rec": 444.7,
    " ERC20 max val rec": 114701175.7,
    " ERC20 avg val rec": 3980081.5,
    " ERC20 min val sent": 10752.2,
    " ERC20 max val sent": 11937795.7,
    " ERC20 avg val sent": 5786131.8,
    " ERC20 min val sent contract": 0.0,
    " ERC20 max val sent contract": 0.0,
    " ERC20 avg val sent contract": 0.0,
    " ERC20 uniq sent token name": 1.3,
    " ERC20 uniq rec token name": 4.4,
    " ERC20 most sent token type": 0.0,
    "ERC20_most_rec_token_type": 0.0,
}

COL_SCALE = {
    "Avg min between sent tnx": 21485.5,
    "Avg min between received tnx": 23080.5,
    "Time Diff between first and last (Mins)": 322921.5,
    "Sent tnx": 757.2,
    "Received Tnx": 940.8,
    "Number of Created Contracts": 141.4,
    "Unique Received From Addresses": 298.6,
    "Unique Sent To Addresses": 263.8,
    "min value received": 325.9,
    "max value received ": 13008.2,
    "avg val received": 2884.9,
    "min val sent": 138.6,
    "max val sent": 6628.9,
    "avg val sent": 239.1,
    "total transactions (including tnx to create contract": 1352.3,
    "total Ether sent": 358304.5,
    "total ether received": 364186.3,
    "total ether balance": 242413.1,
    " Total ERC20 tnxs": 428.4,
    " ERC20 total Ether received": 10084442929.6,
    " ERC20 total ether sent": 1129522602.4,
    " ERC20 total Ether sent contract": 5864.6,
    " ERC20 uniq sent addr": 100.7,
    " ERC20 uniq rec addr": 78.3,
    " ERC20 uniq sent addr.1": 0.1,
    " ERC20 uniq rec contract addr": 16.6,
    " ERC20 avg time between sent tnx": 1.0,
    " ERC20 avg time between rec tnx": 1.0,
    " ERC20 avg time between rec 2 tnx": 1.0,
    " ERC20 avg time between contract tnx": 1.0,
    " ERC20 min val rec": 16156.2,
    " ERC20 max val rec": 10083312738.5,
    " ERC20 avg val rec": 204894411.7,
    " ERC20 min val sent": 1008164.4,
    " ERC20 max val sent": 1129057882.2,
    " ERC20 avg val sent": 565986924.6,
    " ERC20 min val sent contract": 1.0,
    " ERC20 max val sent contract": 1.0,
    " ERC20 avg val sent contract": 1.0,
    " ERC20 uniq sent token name": 6.5,
    " ERC20 uniq rec token name": 16.0,
    " ERC20 most sent token type": 1.0,
    "ERC20_most_rec_token_type": 1.0,
}


def _sample_with_zeros(mu: float, sigma: float, n: int) -> np.ndarray:
    if mu <= 0.01 and sigma <= 1.0:
        return np.zeros(n, dtype=np.float64)
    values = RNG.lognormal(mean=np.log(max(mu, 0.1)), sigma=min(sigma / max(mu, 0.1), 3.0), size=n)
    values = np.clip(values, 0, values.max())
    return values


def _generate_fraud_features(df: pd.DataFrame, mask: np.ndarray) -> pd.DataFrame:
    n = mask.sum()
    if n == 0:
        return df
    factor = RNG.uniform(2.0, 8.0, size=n)
    for col in [
        "Sent tnx", "Received Tnx",
        "min value received", "max value received ",
        "min val sent", "max val sent",
        "total transactions (including tnx to create contract",
        "Unique Received From Addresses", "Unique Sent To Addresses",
    ]:
        df.loc[mask, col] = df.loc[mask, col] * factor
    df.loc[mask, "Avg min between sent tnx"] = df.loc[mask, "Avg min between sent tnx"] / factor
    df.loc[mask, "Avg min between received tnx"] = df.loc[mask, "Avg min between received tnx"] / factor
    df.loc[mask, "Time Diff between first and last (Mins)"] = df.loc[mask, "Time Diff between first and last (Mins)"] / RNG.uniform(1.5, 4.0, size=n)
    return df


def generate_dataset(n_samples: int = N_SAMPLES) -> pd.DataFrame:
    data = {}
    for col in FEATURE_COLS:
        mu = COL_MEAN.get(col, 0.0)
        sigma = COL_SCALE.get(col, 1.0)
        data[col] = _sample_with_zeros(mu, sigma, n_samples)
    df = pd.DataFrame(data)
    for col in df.columns:
        df[col] = df[col].round(6)
    n_fraud = int(n_samples * FRAUD_RATIO)
    fraud_indices = RNG.choice(n_samples, size=n_fraud, replace=False)
    fraud_mask = np.zeros(n_samples, dtype=bool)
    fraud_mask[fraud_indices] = True
    df = _generate_fraud_features(df, fraud_mask)
    df["FLAG"] = fraud_mask.astype(int)
    return df


def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, DATASET_PATH)
    if os.path.exists(output_path):
        ans = input(f"{output_path} exists. Overwrite? (y/N): ")
        if ans.lower() != "y":
            print("Aborted.")
            return
    df = generate_dataset()
    df.to_csv(output_path, index=False)
    fraud_count = df["FLAG"].sum()
    print(f"Generated {len(df)} rows ({fraud_count} fraud / {len(df) - fraud_count} legitimate)")
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
