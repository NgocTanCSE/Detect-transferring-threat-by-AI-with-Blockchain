import json
import logging
import requests
from typing import Dict, List, Any, Optional

from app.core.config import (
    GEMINI_API_KEY,
    GEMINI_API_BASE_URL,
    GEMINI_MODEL,
    GEMINI_REQUEST_TIMEOUT_SECONDS,
)
from app.services.assistant_knowledge_base import KnowledgeSnippet, render_snippets_for_prompt

logger = logging.getLogger(__name__)

class HFSecurityAnalyst:
    """
    AI Security Analyst that leverages Gemini API (AI Studio key)
    to provide intelligent reasoning and insights for blockchain threats.
    """

    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.model = GEMINI_MODEL
        self.api_url = f"{GEMINI_API_BASE_URL}/models/{self.model}:generateContent"
        self.enabled = bool(self.api_key)
        
        # Load Persona from file
        from pathlib import Path
        self.persona = "Bạn là trợ lý AI thông minh cho dự án Blockchain Sentinel."
        try:
            persona_path = Path(__file__).parent / "ai_persona.txt"
            if persona_path.exists():
                self.persona = persona_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not load ai_persona.txt: {e}")

        if not self.enabled:
            logger.warning("GEMINI_API_KEY/GOOGLE_API_KEY not found. AI Security Analyst will use fallback mode.")

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
            return "AI Analyst is currently unavailable. Provide GEMINI_API_KEY (or GOOGLE_API_KEY) to enable."

        # Construct specific context for the LLM
        prompt = self._construct_prompt(wallet_address, risk_score, risk_level, detections, transaction_summary)

        try:
            return self._generate_text(prompt=prompt, max_new_tokens=500, temperature=0.7)
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
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
            logger.error(f"Gemini dashboard chat failed: {error}")
            return self._fallback_dashboard_answer(
                question=question,
                context=context,
                conversation_history=conversation_history,
                knowledge_snippets=knowledge_snippets,
            )

    def answer_general_question(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Answer general project questions without forcing dashboard analytics structure."""
        if not self.enabled:
            return self._fallback_general_answer(question=question, context=context, conversation_history=conversation_history, knowledge_snippets=knowledge_snippets)

        prompt = self._construct_general_chat_prompt(
            question=question,
            context=context,
            knowledge_snippets=knowledge_snippets or [],
            conversation_history=conversation_history or [],
        )
        try:
            return self._generate_text(prompt=prompt, max_new_tokens=420, temperature=0.55)
        except Exception as error:
            logger.error(f"Gemini general chat failed: {error}")
            return self._fallback_general_answer(
                question=question,
                context=context,
                conversation_history=conversation_history,
                knowledge_snippets=knowledge_snippets,
            )

    def _generate_text(self, prompt: str, max_new_tokens: int, temperature: float) -> str:
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": max_new_tokens,
                "temperature": temperature,
                "top_p": 0.9,
            },
        }

        # Try multiple model names and API versions
        versions = ["v1", "v1beta"]
        models_to_try = [self.model, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
        last_error = None

        for version in versions:
            for model_name in models_to_try:
                try:
                    # Strip 'models/' if already present in model_name
                    clean_model_name = model_name.replace("models/", "")
                    url = f"https://generativelanguage.googleapis.com/{version}/models/{clean_model_name}:generateContent?key={self.api_key}"
                    
                    response = requests.post(
                        url,
                        headers={"Content-Type": "application/json"},
                        json=payload,
                        timeout=GEMINI_REQUEST_TIMEOUT_SECONDS,
                    )
                    if response.status_code == 200:
                        result = response.json()
                        candidates = result.get("candidates", [])
                        if candidates:
                            content = candidates[0].get("content", {})
                            parts = content.get("parts", [])
                            text = "".join(part.get("text", "") for part in parts).strip()
                            if text:
                                return text
                    else:
                        last_error = f"({version}/{model_name}) Status {response.status_code}"
                        # logger.warning(f"Model {model_name} on {version} failed: {response.status_code}")
                except Exception as e:
                    last_error = str(e)
        
        return f"Hiện chưa có đủ nội dung trả lời từ mô hình. (Lỗi: {last_error})"

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
        screen_scope = str(context.get("screen_scope", "dashboard"))
        
        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}
Mục tiêu: Giải thích các chỉ số trên màn hình {screen_scope} và đưa ra lời khuyên cho người vận hành.

HƯỚNG DẪN TRẢ LỜI:
- Luôn trả lời bằng tiếng Việt.
- Sử dụng số liệu thực tế từ JSON CONTEXT bên dưới.
- Trình bày rõ ràng, dễ hiểu. Nếu có nhiều ý, hãy dùng dấu gạch đầu dòng (-).
- Nếu không có đủ dữ liệu để trả lời chính xác, hãy nêu rõ và đưa ra nhận định dựa trên kiến thức chung về bảo mật blockchain.
- Kết hợp thông tin từ TÀI LIỆU DỰ ÁN để giải thích thuật ngữ hoặc quy trình.

<|eot_id|><|start_header_id|>user<|end_header_id|>
JSON CONTEXT (Dữ liệu hệ thống):
{context_json}

LỊCH SỬ HỘI THOẠI:
{history_text}

TÀI LIỆU THAM KHẢO DỰ ÁN:
{knowledge_text or "Không có tài liệu cụ thể, hãy dùng kiến thức chuyên gia."}

CÂU HỎI:
{question}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _construct_general_chat_prompt(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        context_json = json.dumps(context, ensure_ascii=False)
        knowledge_text = render_snippets_for_prompt(knowledge_snippets)
        history_text = json.dumps(conversation_history[-8:], ensure_ascii=False)
        
        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}
Bạn có kiến thức sâu rộng về dự án này, blockchain và kiến thức chung.
Bạn không chỉ trả lời câu hỏi mà còn đưa ra các phân tích sâu và dự báo rủi ro.

KHẢ NĂNG CỦA BẠN:
1. Phân tích thuật toán: Bạn hiểu rõ các công thức tính điểm rủi ro (Random Forest, Multi-Agent Scoring, Heuristics).
2. Chuyên gia Blockchain: Hiểu sâu về cấu trúc giao dịch, smart contract rác, kỹ thuật ẩn danh (Mixers), và các mô hình lừa đảo đa chuỗi.
3. Kiến trúc hệ thống: Nắm rõ luồng dữ liệu từ Frontend React đến Node.js Orchestrator và AI Engine Python.
4. Tri thức đa ngành: Có khả năng thảo luận về khoa học, lịch sử, lập trình và đời sống một cách thông tuệ.

HƯỚNG DẪN TƯ DUY (Chain of Thought):
- Khi nhận câu hỏi phức tạp, hãy phân tích từng bước: Giải thích bối cảnh -> Đưa ra số liệu/bằng chứng -> Kết luận & Khuyến nghị.
- Luôn sử dụng tiếng Việt chuẩn, súc tích nhưng đầy đủ ý nghĩa.
- Định dạng: Sử dụng dấu gạch đầu dòng (-) và các đoạn văn ngắn để dễ đọc. Tránh dùng markdown quá phức tạp làm rối mắt.

<|eot_id|><|start_header_id|>user<|end_header_id|>
NGỮ CẢNH HỆ THỐNG:
{context_json}

LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
{history_text}

DỮ LIỆU TRI THỨC DỰ ÁN (RAG):
{knowledge_text or "Dùng cơ sở tri thức Sentinel Prime của bạn."}

CÂU HỎI TỪ NGƯỜI DÙNG:
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

    def _fallback_general_answer(
        self,
        question: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
    ) -> str:
        snippet_hint = ""
        if knowledge_snippets:
            top_snippet = knowledge_snippets[0]
            snippet_hint = f"\n- Nguồn tham khảo gần nhất: {top_snippet.source} / {top_snippet.heading}"

        return (
            "Mình chưa lấy được câu trả lời từ mô hình, nhưng mình có thể hỗ trợ theo ngữ cảnh hệ thống.\n\n"
            f"Câu hỏi của bạn: {question}\n"
            + snippet_hint
            + "\nNếu bạn muốn, mình có thể trả lời theo 3 kiểu: lỗi đăng ký/đăng nhập, lỗi giao diện, hoặc câu hỏi về dashboard/ops."
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
