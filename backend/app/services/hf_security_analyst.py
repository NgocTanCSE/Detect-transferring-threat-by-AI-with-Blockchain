import json
import logging
import requests
from typing import Dict, List, Any, Optional

from app.core.config import HF_API_TOKEN, HF_INFERENCE_URL

logger = logging.getLogger(__name__)

class HFSecurityAnalyst:
    """
    AI Security Analyst that leverages Hugging Face Inference API (LLMs)
    to provide intelligent reasoning and insights for blockchain threats.
    """

    def __init__(self):
        self.api_url = HF_INFERENCE_URL
        self.headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
        self.enabled = bool(HF_API_TOKEN)
        
        if not self.enabled:
            logger.warning("HF_TOKEN not found. AI Security Analyst will be disabled.")

    def analyze_threat(
        self, 
        wallet_address: str, 
        risk_score: float, 
        risk_level: str,
        detections: Dict[str, Any],
        transaction_summary: Dict[str, Any]
    ) -> str:
        """
        Generate a natural language analysis of the detected threats using LLM.
        """
        if not self.enabled:
            return "AI Analyst is currently unavailable. Provide HF_TOKEN to enable."

        # Construct specific context for the LLM
        prompt = self._construct_prompt(wallet_address, risk_score, risk_level, detections, transaction_summary)

        try:
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 500,
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "return_full_text": False
                }
            }

            response = requests.post(self.api_url, headers=self.headers, json=payload, timeout=15)
            response.raise_for_status()
            
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                insight = result[0].get("generated_text", "").strip()
                # Remove any leftover prompt parts if model is not properly instructed
                if "ASSISTANT:" in insight:
                    insight = insight.split("ASSISTANT:")[-1].strip()
                return insight
            
            return "The AI analyst is currently processing the data. Please check back later."

        except Exception as e:
            logger.error(f"HF Inference API call failed: {e}")
            return f"The AI analyst encountered an error while processing this wallet: {str(e)}"

    def _construct_prompt(
        self, 
        wallet_address: str, 
        risk_score: float, 
        risk_level: str,
        detections: Dict[str, Any],
        transaction_summary: Dict[str, Any]
    ) -> str:
        """
        Build a high-quality prompt for the security analyst LLM.
        """
        
        # Summary of detections
        reasons = []
        for agent, result in detections.items():
            if result.get('detected'):
                reasons.extend(result.get('reasons', []))
        
        reasons_text = "\n- ".join(reasons) if reasons else "No specific heuristic patterns detected."
        
        ml_score = detections.get('ml_prediction', {}).get('ml_score', 0)
        ml_reason = detections.get('ml_prediction', {}).get('ml_reason', 'N/A')

        prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are a Senior Blockchain Security Analyst specializing in Ethereum fraud detection. 
Your goal is to explain complex transaction patterns to users in a clear, professional, and helpful way.
You must provide your analysis in Vietnamese (Tiếng Việt) but keep technical terms like 'Mixer', 'Wash Trading', 'Honeypot' when appropriate.

Provide:
1. A summary of the threat.
2. Why the specific patterns found are dangerous.
3. A clear recommendation for the user.

Keep the tone professional and security-focused.<|eot_id|><|start_header_id|>user<|end_header_id|>

HÃY PHÂN TÍCH RỦI RO CHO VÍ SAU:
- Wallet Address: {wallet_address}
- Risk Score: {risk_score}/100
- Risk Level: {risk_level}

CÁC DẤU HIỆU PHÁT HIỆN:
- {reasons_text}
- ML Model Prediction: {ml_reason} (Score: {ml_score})

GÓC NHÌN CHUYÊN GIA (AI ANALYST INSIGHT):<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

        return prompt
