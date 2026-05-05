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

        # Debug logging
        api_key_status = "CONFIGURED" if self.api_key else "NOT SET"
        logger.info(f"HFSecurityAnalyst initialized: model={self.model}, api_key={api_key_status}, enabled={self.enabled}")

        # Load Persona from file
        from pathlib import Path
        self.persona = "Bạn là Sentinel Prime, trợ lý AI bảo mật cao cấp cho dự án Blockchain Sentinel."
        try:
            persona_path = Path(__file__).parent / "ai_persona.txt"
            if persona_path.exists():
                self.persona = persona_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not load ai_persona.txt: {e}")

        # Refine persona to be more analytical
        self.persona += "\n\nBổ sung phong cách: Bạn là một chuyên gia phân tích dữ liệu sắc sảo, luôn dựa trên con số thực tế để đưa ra nhận định. Bạn không bao giờ trả lời hời hợt hoặc dùng các câu mẫu sáo rỗng."

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
            response = self._generate_text(prompt=prompt, max_new_tokens=1000, temperature=0.45)

            # Check if response is an error message (when API fails but no exception is raised)
            if response and ("tạm thời không khả dụng" in response.lower() or
                           "gặp lỗi" in response.lower() or
                           '"error"' in response or
                           '"code":' in response):
                # API returned error message instead of actual response - use fallback
                logger.warning(f"API returned error response, triggering fallback")
                return self._fallback_dashboard_answer(
                    question=question,
                    context=context,
                    conversation_history=conversation_history,
                    knowledge_snippets=knowledge_snippets,
                )

            return response
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
            response = self._generate_text(prompt=prompt, max_new_tokens=900, temperature=0.55)

            # Check if response is an error message (when API fails but no exception is raised)
            if response and ("tạm thời không khả dụng" in response.lower() or
                           "gặp lỗi" in response.lower() or
                           '"error"' in response or
                           '"code":' in response):
                # API returned error message instead of actual response - use fallback
                logger.warning(f"API returned error response, triggering fallback")
                return self._fallback_general_answer(
                    question=question,
                    context=context,
                    conversation_history=conversation_history,
                    knowledge_snippets=knowledge_snippets,
                )

            return response
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

        # Try multiple model names and API versions (Gemini models only)
        # Prioritize working models first (tested 2026-04-28)
        versions = ["v1", "v1beta"]
        models_to_try = [
            "gemini-2.5-flash",      # Newest model (primary)
            "gemini-2.5-pro",        # Newer pro version
            "gemini-2.0-flash",      # Stable fallback
        ]
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
                                logger.info(f"✓ Gemini API success with {version}/{model_name}")
                                return text
                    else:
                        error_detail = response.text[:100] if response.text else str(response.status_code)
                        last_error = f"({version}/{model_name}) {response.status_code}: {error_detail}"
                        logger.debug(f"Model {model_name} on {version} failed: {response.status_code}")
                except Exception as e:
                    last_error = f"({version}/{model_name}) {str(e)[:50]}"
                    logger.debug(f"Exception with {model_name}: {e}")

        # All API calls failed - raise so callers can route to deterministic fallback answers
        logger.error(f"All Gemini API attempts failed. Last error: {last_error}")
        raise RuntimeError(f"Gemini API unavailable: {last_error}")

    def _construct_dashboard_chat_prompt(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        context_json = json.dumps(context, ensure_ascii=False, indent=2)
        knowledge_text = render_snippets_for_prompt(knowledge_snippets)
        history_text = json.dumps(conversation_history[-6:], ensure_ascii=False, indent=2)
        screen_scope = str(context.get("screen_scope", "dashboard"))

        # Extract key metrics for better guidance
        overview = context.get("overview", {})
        alert_trend = context.get("alert_trend", {})

        metrics_summary = f"""
SNAPSHOT HỆ THỐNG HIỆN TẠI:
- Tổng ví: {overview.get('total_wallets', 0)}
- Tổng alerts: {overview.get('total_alerts', 0)} (Critical: {overview.get('critical_alerts', 0)})
- Alerts hôm nay: {overview.get('alerts_today', 0)}
- Alerts 24h: {overview.get('alerts_24h', 0)}
- Xu hướng: {alert_trend.get('trend_direction', 'STABLE')} ({alert_trend.get('trend_percentage', 0):.1f}%)
- Spike phát hiện: {alert_trend.get('spike_detected', False)}
- Giao dịch bị chặn: {overview.get('total_blocked', 0)} (Hôm nay: {overview.get('blocked_today', 0)})
"""

        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}

MỤC ĐÍCH: Phân tích dữ liệu dashboard {screen_scope} và cung cấp lời khuyên hành động cụ thể cho người vận hành.

HƯỚNG DẪN TRẢ LỜI NGHIÊM NGẶT:
1. LUÔN SỬ DỤNG SỐ LIỆU THỰC TẾ từ JSON CONTEXT - đừng dùng con số tùy ý
2. LIÊN KẾT TRỰ TIẾP: Nếu hỏi về alerts tăng, phải nói: "Hôm nay X alerts, trung bình Y/ngày, tức tăng Z%"
3. HÀNH ĐỘNG CỤ THỂ: Không chỉ nói "cần xử lý", mà nói "cần xử lý ngay X cases critical"
4. PHÁT HIỆN ANOMALY: Khi spike_detected=true, phải highlight như cảnh báo quan trọng
5. ĐỊNH DẠNG: Dùng dấu gạch đầu dòng (-) cho danh sách, không dùng đánh số trừ khi người dùng yêu cầu
6. NGÔN NGỮ: Tiếng Việt chuyên nghiệp, tránh dùng từ generic như "tương đối", "khá", v.v.
7. KHÔNG HALLUCINATE: Nếu không có dữ liệu cho câu hỏi, hãy nêu rõ "Không có dữ liệu..." thay vì đoán

{metrics_summary}

<|eot_id|><|start_header_id|>user<|end_header_id|>
JSON CONTEXT ĐẦY ĐỦ (Dữ liệu hệ thống):
{context_json}

LỊCH SỬ HỘI THOẠI (để bối cảnh):
{history_text}

TÀI LIỆU THAM KHẢO DỰ ÁN:
{knowledge_text or "Không có tài liệu cụ thể được lấy."}

CÂU HỎI TỪNG ĐƯỢC ĐẶT:
{question}

HÃY TRẢ LỜI NGẮN GỌN NHƯNG ĐẦY ĐỦ, KỂ KỀ SỐ LIỆU CỤ THỂ:
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _construct_general_chat_prompt(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        context_json = json.dumps(context, ensure_ascii=False, indent=2)
        knowledge_text = render_snippets_for_prompt(knowledge_snippets)
        history_text = json.dumps(conversation_history[-8:], ensure_ascii=False, indent=2)

        # Extract overview if available for a "System Snapshot"
        overview = context.get("overview", {})
        alert_trend = context.get("alert_trend", {})
        risk_dist = context.get("risk_distribution", {})
        recent_cases = context.get("recent_high_priority_cases", [])

        system_snapshot = f"""
TRẠNG THÁI HỆ THỐNG (System Snapshot):
- Tổng số ví đang theo dõi: {overview.get('total_wallets', 'N/A')}
- Tổng số cảnh báo rủi ro: {overview.get('total_alerts', 'N/A')}
- Cảnh báo mức CRITICAL: {overview.get('critical_alerts', 'N/A')}
- Cảnh báo mức HIGH: {overview.get('high_alerts', 'N/A')}
- Cảnh báo hôm nay: {overview.get('alerts_today', 'N/A')}
- Giao dịch đã bị chặn: {overview.get('total_blocked', 'N/A')}
- Xu hướng alerts: {alert_trend.get('trend_direction', 'STABLE')} ({alert_trend.get('trend_percentage', 0):.1f}%)
- Spike phát hiện: {alert_trend.get('spike_detected', False)}
- Phân bố rủi ro: Critical={risk_dist.get('CRITICAL', 0)}, High={risk_dist.get('HIGH', 0)}, Medium={risk_dist.get('MEDIUM', 0)}
{f"- Các case cần xử lý: {len(recent_cases)} (PENDING/FLAGGED)" if recent_cases else ""}
"""

        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}

PHẠM VI KIẾN THỨC VÀ KHẢ NĂNG:
1. Phân tích blockchain: Hiểu sâu về Ethereum, cấu trúc giao dịch, smart contract patterns
2. Kỹ thuật phát hiện: Mixer detection, phishing patterns, money laundering techniques, multi-hop attacks
3. Điểm rủi ro: Công thức scoring (Random Forest, Multi-Agent, Heuristics), cách đọc và diễn giải
4. Kiến trúc hệ thống: Frontend React, Backend FastAPI, AI Engine, Database architecture, RBAC
5. Quy trình vận hành: Cách xử lý cases, policies, compliance, audit

{system_snapshot}

HƯỚNG DẪN TƯ DUY & PHẢN ỨNG (Chain of Thought):
1. ĐỌC SNAPSHOT: Luôn kiểm tra SYSTEM SNAPSHOT trước để hiểu tình hình hiện tại
2. HIỂU CÂU HỎI: Phân tích xem người dùng đang hỏi gì - phát hiện intent sâu hơn từ khóa
3. LIÊN KẾT DỮ LIỆU: Nếu có dữ liệu trong context, phải trích dẫn số liệu cụ thể
4. GIẢI THÍCH: Không chỉ nói "có vấn đề", mà giải thích CHI TIẾT bằng dữ liệu
5. ĐỀ XUẤT: Đưa ra hành động cụ thể, không generic
6. TRÁNH HALLUCINATE: Không bao giờ nói số liệu không có trong context

HẠNG MỤC CÂU HỎI THỨ NHẤT:
- Nếu hỏi về dashboard/alerts/metrics → dùng dữ liệu từ SYSTEM SNAPSHOT
- Nếu hỏi về ví cụ thể → dùng wallet_focus context
- Nếu hỏi về hệ thống → dùng kiến thức kiến trúc và dự án documentation
- Nếu hỏi về account/đăng nhập → giải thích vấn đề phổ biến và cách fix

ĐỊNH DẠN OUTPUT:
- Sử dụng tiếng Việt chuẩn mực
- Dùng dấu gạch đầu dòng (-) cho danh sách
- Tránh từ mơ hồ như "tương đối", "khá", "khoảng"
- Cấu trúc: Mô tả vấn đề → Dữ liệu cụ thể → Phân tích → Đề xuất
- Giữ độ dài phù hợp (100-400 từ)

<|eot_id|><|start_header_id|>user<|end_header_id|>
NGỮ CẢNH HỆ THỐNG ĐẦY ĐỦ:
{context_json}

LỊCH SỬ HỘI THOẠI (để hiểu flow):
{history_text}

DỮ LIỆU TRI THỨC TỪ DOCS:
{knowledge_text or "Không có tài liệu cụ thể - dùng cơ sở tri thức Sentinel Prime."}

CÂU HỎI TỪ NGƯỜI DÙNG:
{question}

HÃY TRẢ LỜI NGẮN GỌN VÀ CHÍNH XÁC, SỬ DỤNG DỮ LIỆU THỰC:
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _fallback_dashboard_answer(
        self,
        question: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
    ) -> str:
        """Improved fallback with actual context data"""
        overview = context.get("overview", {}) if isinstance(context, dict) else {}
        alert_trend = context.get("alert_trend", {}) if isinstance(context, dict) else {}

        total_wallets = overview.get("total_wallets", 0)
        total_alerts = overview.get("total_alerts", 0)
        critical_alerts = overview.get("critical_alerts", 0)
        blocked = overview.get("total_blocked", 0)
        trend_dir = alert_trend.get("trend_direction", "STABLE")

        q_lower = (question or "").lower()

        # Dynamically match question to metrics
        if any(term in q_lower for term in ["4 chỉ số", "metric", "chỉ số"]):
            return (
                "4 chỉ số chính trên dashboard (dữ liệu thực tế):\n"
                f"- Tổng ví theo dõi: {total_wallets}\n"
                f"- Tổng cảnh báo: {total_alerts} (Critical: {critical_alerts})\n"
                f"- Giao dịch bị chặn: {blocked}\n"
                f"- Alerts hôm nay: {overview.get('alerts_today', 0)}\n\n"
                f"Xu hướng hiện tại: {trend_dir}"
            )
        elif any(term in q_lower for term in ["tăng", "giảm", "xu hướng"]):
            return (
                f"Xu hướng alerts: {trend_dir}\n"
                f"Chi tiết: {alert_trend.get('trend_percentage', 0):.1f}% so với trung bình 7 ngày\n"
                f"Alerts hôm nay: {overview.get('alerts_today', 0)}\n"
                f"Spike phát hiện: {'Có' if alert_trend.get('spike_detected', False) else 'Không'}\n\n"
                "Mình chưa có đủ chi tiết phân tích sâu từ mô hình AI, nhưng dữ liệu dashboard trên đó thực tế."
            )
        else:
            return (
                "Tóm tắt hệ thống hiện tại:\n"
                f"- {total_wallets} ví đang theo dõi\n"
                f"- {total_alerts} cảnh báo toàn bộ ({critical_alerts} Critical)\n"
                f"- {blocked} giao dịch đã chặn\n"
                f"- Xu hướng: {trend_dir}\n\n"
                "Mình chưa có chi tiết phân tích AI sâu hơn để trả lời câu hỏi của bạn. "
                "Hãy thử hỏi cụ thể hơn về một số liệu hoặc ví cụ thể để mình phân tích."
            )

    def _fallback_general_answer(
        self,
        question: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
    ) -> str:
        """Improved general fallback with context awareness"""
        q_lower = (question or "").lower()

        # Support question detection
        if any(term in q_lower for term in ["đăng nhập", "login", "tài khoản", "account"]):
            return (
                "Vấn đề đăng nhập/tài khoản thường do:\n"
                "- Username hoặc mật khẩu sai\n"
                "- Tài khoản chưa được kích hoạt\n"
                "- Wallet address không tồn tại trong hệ thống\n"
                "- Session token hết hạn\n\n"
                "Cách khắc phục: Kiểm tra thông tin đăng nhập, wallet address, và thử lại sau vài phút."
            )

        # System architecture question detection
        if any(term in q_lower for term in ["thành phần", "architecture", "cấu trúc hệ thống", "frontend", "backend"]):
            return (
                "Kiến trúc hệ thống gồm:\n"
                "- Frontend: Next.js + React (UI trực quan cho dashboard)\n"
                "- Backend: FastAPI + Python (xử lý logic, AI scoring)\n"
                "- Database: PostgreSQL/Supabase (lưu trữ dữ liệu blockchain)\n"
                "- AI Engine: Multi-agent detection (phát hiện rủi ro)\n\n"
                "Dữ liệu từ blockchain được xử lý → AI scoring → tạo alerts → hiển thị dashboard."
            )

        # Default fallback
        snippet_hint = ""
        if knowledge_snippets and len(knowledge_snippets) > 0:
            top_snippet = knowledge_snippets[0]
            snippet_hint = f"\n\nTham khảo: {top_snippet.source} - {top_snippet.heading}"

        return (
            "Mình chưa có lời giải thích AI chi tiết cho câu hỏi này, nhưng tôi có thể giúp về:\n"
            "- Dashboard metrics & alerts\n"
            "- Wallet analysis & risk scoring\n"
            "- Hệ thống architecture\n"
            "- Đăng nhập/tài khoản\n"
            "- Quy trình vận hành\n\n"
            "Hãy hỏi cụ thể hơn để mình trả lời tốt hơn."
            + snippet_hint
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
        Build a high-quality prompt for the security analyst LLM with XAI and Actions.
        """

        # Summary of detections
        reasons = []
        for agent, result in detections.items():
            if isinstance(result, dict) and result.get('detected'):
                reasons.extend(result.get('reasons', []))

        reasons_text = "\n- ".join(reasons) if reasons else "Không phát hiện mẫu hành vi bất thường cụ thể."

        ml_score = detections.get('ml_prediction', {}).get('ml_score', 0)
        ml_reason = detections.get('ml_prediction', {}).get('ml_reason', 'N/A')
        heuristic_score = risk_score # Simplified for explanation

        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}

NHIỆM VỤ: Phân tích chi tiết rủi ro cho ví blockchain và đưa ra giải thích chuyên sâu (XAI).

YÊU CẦU PHẢN HỒI (XAI & Actions):
1. Giải thích con số: Sử dụng công thức Score = w_ML * S_ML + w_H * S_H để giải thích tại sao ví có số điểm {risk_score}.
2. Phân tích hành vi: Tại sao các dấu hiệu Heuristic và ML lại dẫn đến kết luận này.
3. Đề xuất hành động: Nếu rủi ro > 70, hãy thêm tag [ACTION: BLOCK_WALLET]. Nếu rủi ro từ 40-70, thêm tag [ACTION: WATCHLIST].
4. Ngôn ngữ: Tiếng Việt chuyên nghiệp, súc tích.

<|eot_id|><|start_header_id|>user<|end_header_id|>
THÔNG TIN VÍ:
- Địa chỉ: {wallet_address}
- Điểm rủi ro tổng hợp: {risk_score}/100 ({risk_level})
- Điểm từ mô hình ML (S_ML): {ml_score}
- Các dấu hiệu Heuristic:
{reasons_text}

HÃY ĐƯA RA PHÂN TÍCH CHUYÊN SÂU:
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""
