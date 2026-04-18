"""Hugging Face Spaces native entrypoint for FastAPI backend."""

import os

import uvicorn


if __name__ == "__main__":
    # HF Spaces exposes the app through port 7860.
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("API_PORT", "7860")))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
