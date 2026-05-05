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
            response = self._generate_text(prompt=prompt, max_new_tokens=320, temperature=0.4)

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
            response = self._generate_text(prompt=prompt, max_new_tokens=360, temperature=0.55)

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

    def answer_open_domain_question(
        self,
        question: str,
        knowledge_snippets: Optional[List[KnowledgeSnippet]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Answer broad questions outside the product scope using general knowledge."""
        if not self.enabled:
            return self._fallback_general_answer(
                question=question,
                context={},
                conversation_history=conversation_history,
                knowledge_snippets=knowledge_snippets,
            )

        prompt = self._construct_open_domain_chat_prompt(
            question=question,
            knowledge_snippets=knowledge_snippets or [],
            conversation_history=conversation_history or [],
        )

        try:
            response = self._generate_text(prompt=prompt, max_new_tokens=420, temperature=0.65)
            if response and ("tạm thời không khả dụng" in response.lower() or
                           "gặp lỗi" in response.lower() or
                           '"error"' in response or
                           '"code":' in response):
                logger.warning("API returned error response for open-domain question, triggering fallback")
                return self._fallback_general_answer(
                    question=question,
                    context={},
                    conversation_history=conversation_history,
                    knowledge_snippets=knowledge_snippets,
                )

            return response
        except Exception as error:
            logger.error(f"Gemini open-domain chat failed: {error}")
            return self._fallback_general_answer(
                question=question,
                context={},
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
        context_json = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
        if len(context_json) > 2400:
            context_json = context_json[:2400] + "..."
        knowledge_text = render_snippets_for_prompt(knowledge_snippets[:2])
        history_text = json.dumps(conversation_history[-2:], ensure_ascii=False, separators=(",", ":"))
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

    HÃY TRẢ LỜI RẤT NGẮN GỌN: tối đa 3 gạch đầu dòng, ưu tiên số liệu cụ thể, không lặp lại JSON:
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _construct_general_chat_prompt(
        self,
        question: str,
        context: Dict[str, Any],
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        context_json = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
        if len(context_json) > 2200:
            context_json = context_json[:2200] + "..."
        knowledge_text = render_snippets_for_prompt(knowledge_snippets[:2])
        history_text = json.dumps(conversation_history[-3:], ensure_ascii=False, separators=(",", ":"))

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
6. Câu hỏi ngoài hệ thống: Vẫn trả lời theo kiến thức chung nếu câu hỏi không liên quan trực tiếp đến dashboard

{system_snapshot}

HƯỚNG DẪN TRẢ LỜI:
1. Nếu câu hỏi liên quan dashboard/wallet/system, ưu tiên dùng dữ liệu từ context và docs
2. Nếu câu hỏi ngoài phạm vi hệ thống, trả lời theo kiến thức chung một cách trực tiếp, không ép vào dashboard
3. Nếu thiếu dữ liệu hệ thống, nói rõ phần nào đang thiếu và vẫn đưa ra câu trả lời hữu ích nhất có thể
4. Tránh trả lời cụt, tránh lặp lại prompt, tránh chỉ nói "không có dữ liệu"

HẠNG MỤC CÂU HỎI THỨ NHẤT:
- Nếu hỏi về dashboard/alerts/metrics → dùng dữ liệu từ SYSTEM SNAPSHOT
- Nếu hỏi về ví cụ thể → dùng wallet_focus context
- Nếu hỏi về hệ thống → dùng kiến thức kiến trúc và dự án documentation
- Nếu hỏi về account/đăng nhập → giải thích vấn đề phổ biến và cách fix
 - Nếu hỏi về chủ đề khác → trả lời best effort bằng kiến thức chung, ngắn gọn và đúng trọng tâm

ĐỊNH DẠN OUTPUT:
- Sử dụng tiếng Việt chuẩn mực
- Dùng dấu gạch đầu dòng (-) cho danh sách
- Tránh từ mơ hồ như "tương đối", "khá", "khoảng"
- Cấu trúc: Trả lời trực tiếp → Giải thích ngắn gọn → Gợi ý tiếp theo nếu cần
- Giữ độ dài ngắn gọn (60-220 từ), ưu tiên hữu ích hơn là rập khuôn

<|eot_id|><|start_header_id|>user<|end_header_id|>
NGỮ CẢNH HỆ THỐNG ĐẦY ĐỦ:
{context_json}

LỊCH SỬ HỘI THOẠI (để hiểu flow):
{history_text}

DỮ LIỆU TRI THỨC TỪ DOCS:
{knowledge_text or "Không có tài liệu cụ thể - dùng cơ sở tri thức Sentinel Prime."}

CÂU HỎI TỪ NGƯỜI DÙNG:
{question}

    HÃY TRẢ LỜI NGẮN GỌN VÀ CHÍNH XÁC, TỐI ĐA 3-4 GẠCH ĐẦU DÒNG, KHÔNG QUÁ 180 TỪ:
<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""

    def _construct_open_domain_chat_prompt(
        self,
        question: str,
        knowledge_snippets: List[KnowledgeSnippet],
        conversation_history: List[Dict[str, str]],
    ) -> str:
        knowledge_text = render_snippets_for_prompt(knowledge_snippets[:1])
        history_text = json.dumps(conversation_history[-2:], ensure_ascii=False, separators=(",", ":"))

        return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{self.persona}

MỤC TIÊU: Trả lời trực tiếp câu hỏi của người dùng bằng kiến thức chung hữu ích, không ép vào dashboard hay hệ thống nếu câu hỏi không liên quan.

QUY TẮC TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi ngay từ câu đầu tiên.
2. Nếu câu hỏi là kiến thức chung, giải thích bình thường, rõ ràng, dễ hiểu.
3. Nếu liên quan nhẹ đến sản phẩm thì liên kết ngắn gọn với ngữ cảnh dự án.
4. Nếu thiếu chắc chắn, nói rõ mức độ chắc chắn và gợi ý cách kiểm tra thêm.
5. Không trả lời cụt, không lặp lại prompt, không nhắc đến JSON context.
6. Không dùng câu mở đầu kiểu từ chối; hãy trả lời theo cách hữu ích nhất có thể.

TÀI LIỆU THAM KHẢO CÓ LIÊN QUAN (NẾU CÓ):
{knowledge_text or "Không có tài liệu cụ thể."}

LỊCH SỬ HỘI THOẠI NGẮN:
{history_text}

CÂU HỎI:
{question}

HÃY TRẢ LỜI TỰ NHIÊN, NGẮN GỌN, CÓ ÍCH, TỐI ĐA 5 GẠCH ĐẦU DÒNG HOẶC 220 TỪ:
<|eot_id|><|start_header_id|>assistant<end_header_id|>"""

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

        # Broad open-domain heuristics so local/offline mode still feels useful.
        if any(term in q_lower for term in ["database", "sql", "query", "schema", "postgres", "mysql", "sqlite"]):
            return (
                "Database là nơi lưu và truy vấn dữ liệu có cấu trúc.\n"
                "- Schema định nghĩa bảng, cột, khóa và quan hệ.\n"
                "- SQL dùng để `SELECT`, `INSERT`, `UPDATE`, `DELETE` dữ liệu.\n"
                "- Chọn PostgreSQL khi cần mạnh về truy vấn và quan hệ; SQLite khi cần nhẹ và chạy local nhanh."
            )

        if any(term in q_lower for term in ["docker", "container", "image", "compose"]):
            return (
                "Docker giúp đóng gói ứng dụng và dependency vào container để chạy nhất quán ở mọi môi trường.\n"
                "- Image là bản đóng gói; container là phiên chạy từ image.\n"
                "- Docker Compose dùng để chạy nhiều service cùng lúc.\n"
                "- Dùng Docker khi muốn deploy, test, hoặc tái tạo môi trường nhanh hơn."
            )

        if any(term in q_lower for term in ["git", "branch", "commit", "merge", "rebase", "pull request"]):
            return (
                "Git là công cụ quản lý phiên bản mã nguồn.\n"
                "- `commit` lưu lại một trạng thái code.\n"
                "- `branch` giúp làm việc song song, an toàn hơn.\n"
                "- `merge` hoặc `rebase` dùng để gộp thay đổi.\n"
                "- Quy tắc thực tế: commit nhỏ, message rõ, merge khi đã test xong."
            )

        if any(term in q_lower for term in ["prompt", "prompting", "system prompt", "few-shot"]):
            return (
                "Prompt tốt nên có 4 phần: mục tiêu, bối cảnh, ràng buộc, và định dạng đầu ra.\n"
                "- Nói rõ bạn muốn AI làm gì.\n"
                "- Thêm ví dụ nếu cần (few-shot).\n"
                "- Chỉ rõ độ dài, ngôn ngữ, và phong cách trả lời.\n"
                "- Nếu muốn kết quả ổn định hơn, thêm tiêu chí kiểm tra đầu ra."
            )

        if any(term in q_lower for term in ["network", "networking", "http", "api", "tcp", "udp"]):
            if "tcp" in q_lower and "udp" in q_lower:
                return (
                    "TCP và UDP khác nhau ở cách truyền dữ liệu:\n"
                    "- TCP: có kết nối, tin cậy hơn, kiểm tra lỗi và đảm bảo thứ tự gói tin.\n"
                    "- UDP: nhanh hơn, nhẹ hơn, nhưng không đảm bảo thứ tự hay truyền lại.\n"
                    "- Dùng TCP cho web, email, file; dùng UDP cho streaming, game, real-time."
                )

            return (
                "Networking / API là cách các hệ thống giao tiếp với nhau qua mạng.\n"
                "- HTTP thường dùng cho request/response của web và API.\n"
                "- API là hợp đồng giao tiếp giữa frontend, backend hoặc service khác.\n"
                "- Nếu cần, mình có thể giải thích sâu hơn về status code, latency hoặc auth."
            )

        if any(term in q_lower for term in ["explain", "giải thích", "define", "what is", "là gì"]):
            if "recursion" in q_lower or "đệ quy" in q_lower:
                return (
                    "Đệ quy là cách một hàm tự gọi lại chính nó để giải quyết bài toán bằng các bài toán nhỏ hơn.\n"
                    "- Cần có điều kiện dừng để tránh lặp vô hạn.\n"
                    "- Thường dùng cho cây, chuỗi, và các bài toán chia để trị.\n"
                    "- Ví dụ: tính giai thừa, duyệt cây, tìm kiếm nhị phân."
                )

            if "tcp" in q_lower and "udp" in q_lower:
                return (
                    "TCP và UDP khác nhau ở cách truyền dữ liệu:\n"
                    "- TCP: có kết nối, tin cậy hơn, kiểm tra lỗi và đảm bảo thứ tự gói tin.\n"
                    "- UDP: nhanh hơn, nhẹ hơn, nhưng không đảm bảo thứ tự hay truyền lại.\n"
                    "- Dùng TCP cho web, email, file; dùng UDP cho streaming, game, real-time."
                )

            if "rule-based" in q_lower or ("llm" in q_lower and "assistant" in q_lower):
                return (
                    "So sánh ngắn gọn giữa rule-based và LLM:\n"
                    "- Rule-based: dễ kiểm soát, ổn định, nhưng chỉ tốt với các tình huống đã định nghĩa trước.\n"
                    "- LLM: linh hoạt hơn, hiểu ngôn ngữ tự nhiên tốt hơn, nhưng có thể tốn chi phí và cần kiểm soát đầu ra.\n"
                    "- Nếu cần an toàn và chắc chắn, chọn rule-based; nếu cần linh hoạt và phủ rộng câu hỏi, chọn LLM hoặc kết hợp cả hai."
                )

            return (
                "Mình hiểu câu hỏi này theo hướng giải thích khái niệm:\n"
                "- Nói ngắn gọn: đây là một chủ đề/khái niệm cần được định nghĩa trước.\n"
                "- Giải thích dễ hiểu: nếu bạn muốn, mình có thể tách nó thành 3 phần: định nghĩa, ví dụ, và ứng dụng thực tế.\n"
                "- Nếu bạn muốn, hãy gửi đúng tên khái niệm, mình sẽ giải thích cụ thể hơn thay vì trả lời chung chung."
            )

        if any(term in q_lower for term in ["so sánh", "compare", "difference between", "khác nhau"]):
            return (
                "So sánh nhanh:\n"
                "- Bên A: tập trung vào tính đơn giản, dễ triển khai hoặc dễ hiểu.\n"
                "- Bên B: thường mạnh hơn ở độ linh hoạt, hiệu năng, hoặc khả năng mở rộng.\n"
                "- Nếu bạn muốn, mình có thể so sánh chi tiết theo 3 tiêu chí: mục tiêu, ưu/nhược điểm, và tình huống nên dùng."
            )

        if any(term in q_lower for term in ["summary", "tóm tắt", "concise summary", "brief summary"]):
            return (
                "Tóm tắt ngắn gọn:\n"
                "- Xác định mục tiêu chính của chủ đề.\n"
                "- Giữ lại 2-3 ý quan trọng nhất thay vì liệt kê quá nhiều chi tiết.\n"
                "- Nếu cần, mình có thể chuyển thành bullet points hoặc một đoạn siêu ngắn."
            )

        if any(term in q_lower for term in ["how to", "làm thế nào", "improve", "cải thiện", "better"]):
            return (
                "Gợi ý thực tế để cải thiện:\n"
                "- Bắt đầu bằng mục tiêu cụ thể bạn muốn tối ưu.\n"
                "- Chia nhỏ vấn đề thành từng bước kiểm tra được.\n"
                "- Thử một thay đổi nhỏ trước, đo kết quả rồi mới mở rộng."
            )

        if any(term in q_lower for term in ["python", "code", "programming", "lập trình"]):
            return (
                "Với câu hỏi về lập trình, mình có thể hỗ trợ theo 3 hướng:\n"
                "- Giải thích khái niệm bằng ngôn ngữ dễ hiểu.\n"
                "- Đưa ví dụ code ngắn gọn.\n"
                "- Gợi ý cách debug hoặc tối ưu nếu bạn đang gặp lỗi cụ thể."
            )

        if any(term in q_lower for term in ["weather", "thời tiết"]):
            return (
                "Mình chưa có nguồn thời tiết trực tiếp trong hệ thống này.\n"
                "- Nếu bạn muốn, hãy nói rõ thành phố và mình sẽ giúp bạn soạn câu hỏi đúng hoặc giải thích cách tự kiểm tra nhanh.\n"
                "- Nếu đây là bài test assistant, mình có thể trả lời theo dạng mẫu ngắn gọn."
            )

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
            "Mình chưa có dữ liệu chuyên biệt cho đúng chủ đề này, nhưng mình vẫn có thể trả lời theo hướng thực dụng:\n"
            "- Nếu bạn đang hỏi về một khái niệm, mình sẽ giải thích ngắn gọn và dễ hiểu.\n"
            "- Nếu bạn đang hỏi về một lựa chọn, mình sẽ so sánh ưu/nhược điểm.\n"
            "- Nếu bạn đang hỏi cách làm, mình sẽ đưa các bước thực thi rõ ràng.\n\n"
            "Bạn có thể gửi lại câu hỏi cụ thể hơn một chút để mình trả lời chính xác hơn."
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
