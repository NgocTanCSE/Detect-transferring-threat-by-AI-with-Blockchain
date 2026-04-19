import json
import logging
import requests
from typing import Dict, List, Any, Optional

from app.core.config import HF_API_TOKEN, HF_INFERENCE_URL
from app.services.assistant_knowledge_base import KnowledgeSnippet, render_snippets_for_prompt

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
            return self._generate_text(prompt=prompt, max_new_tokens=500, temperature=0.7)
        except Exception as e:
            logger.error(f"HF Inference API call failed: {e}")
            return f"The AI analyst encountered an error while processing this wallet: {str(e)}"

    def answer_dashboard_question(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Answer operator questions about dashboard metrics in Vietnamese."""
        if not self.enabled:
            return self._fallback_dashboard_answer(question=question, context=context, conversation_history=conversation_history, knowledge_snippets=knowledge_snippets)

        prompt = self._construct_dashboard_chat_prompt(
            question=question,
            context=context,
            knowledge_snippets=knowledge_snippets or [],
            conversation_history=conversation_history or [],
        )
        try:
            return self._generate_text(prompt=prompt, max_new_tokens=380, temperature=0.45)
        except Exception as error:
            logger.error(f"HF dashboard chat failed: {error}")
            return self._fallback_dashboard_answer(
                question=question,
                context=context,
                conversation_history=conversation_history,
                knowledge_snippets=knowledge_snippets,
            )

    def _generate_text(self, prompt: str, max_new_tokens: int, temperature: float) -> str:
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_new_tokens,
                "temperature": temperature,
                "top_p": 0.9,
                "return_full_text": False,
            },
        }

        response = requests.post(self.api_url, headers=self.headers, json=payload, timeout=20)
        response.raise_for_status()
        result = response.json()

        if isinstance(result, list) and len(result) > 0:
            insight = result[0].get("generated_text", "").strip()
            if "ASSISTANT:" in insight:
                insight = insight.split("ASSISTANT:")[-1].strip()
            return insight

        return "Hiện chưa có đủ nội dung trả lời từ mô hình. Vui lòng thử lại."

    def _construct_dashboard_chat_prompt(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        context_json = json.dumps(context, ensure_ascii=False)
        knowledge_text = render_snippets_for_prompt(knowledge_snippets)
        history_text = json.dumps(conversation_history[-6:], ensure_ascii=False)
        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

Bạn là trợ lý vận hành cho dashboard chống gian lận blockchain.
Chỉ trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, chính xác theo số liệu context.
Nếu câu hỏi vượt ngoài context thì nói rõ thiếu dữ liệu, không bịa.
Ưu tiên dùng kiến thức dự án được cung cấp bên dưới khi giải thích thuật ngữ, luồng triển khai và cách vận hành.

Format trả lời:
1) Giải thích ý nghĩa chỉ số
2) Nhận định nhanh theo dữ liệu hiện tại
3) Hành động đề xuất cho operator

<|eot_id|><|start_header_id|>user<|end_header_id|>
CONTEXT_DASHBOARD_JSON:
{context_json}

LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
{history_text}

TRÍCH DẪN TÀI LIỆU DỰ ÁN:
{knowledge_text or "Không có snippet phù hợp."}

CÂU HỎI:
{question}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _fallback_dashboard_answer(
        self,
        question: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
    ) -> str:
        overview = context.get("overview", {}) if isinstance(context, dict) else {}
        total_wallets = overview.get("total_wallets", 0)
        total_alerts = overview.get("total_alerts", 0)
        critical_alerts = overview.get("critical_alerts", 0)
        blocked = overview.get("total_blocked", 0)
        snippet_hint = ""
        if knowledge_snippets:
            top_snippet = knowledge_snippets[0]
            snippet_hint = f"\n- Nguồn tham khảo gần nhất: {top_snippet.source} / {top_snippet.heading}"

        return (
            "AI model đang tạm thời không khả dụng, mình trả lời theo dữ liệu hệ thống hiện có.\n\n"
            f"- Tổng ví theo dõi: {total_wallets}\n"
            f"- Tổng cảnh báo: {total_alerts}\n"
            f"- Cảnh báo critical: {critical_alerts}\n"
            f"- Giao dịch đã chặn: {blocked}\n\n"
            f"Câu hỏi của bạn: {question}\n"
            + snippet_hint
            + "\nGợi ý: nếu cần giải thích sâu hơn theo ví cụ thể, hãy cung cấp địa chỉ ví để mình phân tích theo ngữ cảnh chi tiết."
        )

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
