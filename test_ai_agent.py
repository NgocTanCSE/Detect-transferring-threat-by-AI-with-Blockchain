#!/usr/bin/env python3
"""
Comprehensive test suite for the AI Assistant Agent.
Tests context understanding, response quality, and fallback handling.
"""

import json
import sys
import requests
from typing import Any, Dict, List
from datetime import datetime, timedelta

# Configuration
API_BASE = "http://localhost:7860"
ASSISTANT_ENDPOINT = f"{API_BASE}/assistant/chat"

# Test categories
TEST_CATEGORIES = {
    "dashboard_analytics": [
        "Giải thích 4 chỉ số chính trên dashboard",
        "Alerts hôm nay tăng hay giảm?",
        "Bao nhiêu ví critical status?",
        "Top 5 ví nguy hiểm là ai?",
        "Giao dịch đã chặn tăng 50% phải làm sao?",
    ],
    "wallet_analysis": [
        "Ví 0xabc123... có rủi ro gì?",
        "Làm thế nào phân biệt phishing vs mixer?",
        "Ví nào có interaction với Tornado Cash?",
        "Nên freeze wallet nào ngay bây giờ?",
    ],
    "system_architecture": [
        "Hệ thống có mấy thành phần chính?",
        "Frontend giao tiếp backend thế nào?",
        "AI Engine hoạt động ra sao?",
        "Database lưu dữ liệu như thế nào?",
        "Phân quyền trong hệ thống là gì?",
    ],
    "account_support": [
        "Tôi không thể đăng nhập, sao vậy?",
        "Làm sao tạo tài khoản mới?",
        "Tôi quên mật khẩu rồi",
        "Account của tôi bị khóa",
        "Register nhưng báo lỗi",
    ],
    "operational_guidance": [
        "Bây giờ nên làm gì tiếp theo?",
        "Ưu tiên xử lý case nào?",
        "Policy rule nào cần update?",
        "Nên bổ sung control nào?",
        "Audit completeness như thế nào?",
    ],
    "edge_cases": [
        "12345",  # Random number
        "你好",  # Chinese
        "ABCXYZ",  # Random code
        "?!?!?",  # Punctuation only
        "",  # Empty (will be caught by API)
        "a",  # Single character
    ],
}

class AIAgentTester:
    def __init__(self, api_base: str = API_BASE):
        self.api_base = api_base
        self.endpoint = f"{api_base}/assistant/chat"
        self.results = []
        self.conversation_history: List[Dict[str, str]] = []

    def build_context(self, role: str = "analyst", wallet: str = None, scope: str = "dashboard") -> Dict[str, Any]:
        """Build a realistic test context"""
        return {
            "overview": {
                "total_wallets": 1250,
                "total_alerts": 487,
                "critical_alerts": 34,
                "alerts_today": 52,
                "total_blocked": 18,
            },
            "top_risky_wallets": [
                {"address": "0x1234...abcd", "label": "Mixer-1", "risk_score": 95.5, "account_status": "critical"},
                {"address": "0x5678...efgh", "label": "Phishing-Group", "risk_score": 87.2, "account_status": "under_review"},
            ],
            "wallet_focus": {
                "address": wallet or "0xabc...def",
                "exists": True,
                "risk_score": 72.3,
                "account_status": "under_review",
                "label": "Suspicious-1",
                "transaction_count": 543,
                "alert_count": 12,
            } if wallet else None,
            "screen_scope": scope,
            "dashboard_role": role,
        }

    def send_question(
        self,
        question: str,
        role: str = "security_analyst",
        wallet: str = None,
        scope: str = "dashboard",
        include_history: bool = True,
    ) -> Dict[str, Any]:
        """Send a question to the AI Assistant"""
        context = self.build_context(role, wallet, scope)

        payload = {
            "message": question,
            "role": role,
            "wallet_address": wallet,
            "screen_scope": scope,
            "conversation_history": self.conversation_history[-4:] if include_history else [],
            "context": context,
        }

        try:
            response = requests.post(self.endpoint, json=payload, timeout=30)

            if response.status_code != 200:
                return {
                    "status": "error",
                    "code": response.status_code,
                    "message": response.text,
                    "question": question,
                }

            data = response.json()

            # Track conversation history
            if include_history:
                self.conversation_history.append({
                    "role": "user",
                    "content": question,
                })
                self.conversation_history.append({
                    "role": "assistant",
                    "content": data.get("answer", ""),
                })

            return {
                "status": "success",
                "question": question,
                "answer": data.get("answer", ""),
                "sources": data.get("sources", []),
                "knowledge_sources": data.get("knowledge_sources", []),
                "model_enabled": data.get("model_enabled", False),
                "answer_length": len(data.get("answer", "")),
                "context": data.get("context", {}),
            }
        except requests.exceptions.ConnectionError:
            return {
                "status": "connection_error",
                "question": question,
                "message": f"Could not connect to {self.endpoint}",
            }
        except Exception as e:
            return {
                "status": "error",
                "question": question,
                "message": str(e),
            }

    def analyze_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze response quality"""
        if response["status"] != "success":
            return {"quality": "failed", "reason": response.get("message", "Unknown error")}

        answer = response.get("answer", "")
        question = response.get("question", "")

        # Quality checks
        issues = []
        quality_score = 100

        # Check for template responses (hardcoded fallbacks)
        if "Mình chưa có đủ dữ liệu" in answer:
            issues.append("Generic fallback response")
            quality_score -= 30

        if any(x in answer for x in ["Template", "mẫu", "không xác định"]):
            issues.append("Possible template answer")
            quality_score -= 20

        # Check if answer relates to question
        question_words = set(question.lower().split())
        answer_words = set(answer.lower().split())
        common_words = question_words & answer_words

        if len(common_words) < 2 and len(question_words) > 3:
            issues.append("Answer seems unrelated to question")
            quality_score -= 25

        # Check answer length
        if len(answer) < 50:
            issues.append("Answer too short (< 50 chars)")
            quality_score -= 15

        if len(answer) > 2000:
            issues.append("Answer too long (> 2000 chars)")
            quality_score -= 10

        # Check for context usage
        context = response.get("context", {})
        overview = context.get("overview", {})
        if overview and any(str(overview.get(k, 0)) in answer for k in ["total_wallets", "total_alerts", "critical_alerts"]):
            issues.append("Uses context effectively")
            quality_score += 10

        return {
            "quality": "good" if quality_score >= 70 else "acceptable" if quality_score >= 50 else "poor",
            "score": quality_score,
            "issues": issues,
            "answer_length": len(answer),
            "model_enabled": response.get("model_enabled", False),
        }

    def run_category_tests(self, category: str) -> Dict[str, Any]:
        """Run tests for a specific category"""
        questions = TEST_CATEGORIES.get(category, [])
        results = {
            "category": category,
            "total": len(questions),
            "passed": 0,
            "failed": 0,
            "details": [],
        }

        print(f"\n{'='*70}")
        print(f"Testing: {category}")
        print(f"{'='*70}")

        for question in questions:
            if not question:  # Skip empty
                continue

            response = self.send_question(question)
            analysis = self.analyze_response(response)

            passed = response.get("status") == "success" and analysis.get("quality") in ["good", "acceptable"]

            if passed:
                results["passed"] += 1
                status_icon = "✓"
            else:
                results["failed"] += 1
                status_icon = "✗"

            print(f"\n{status_icon} Q: {question[:60]}...")
            print(f"  Response Status: {response.get('status')}")
            print(f"  Quality: {analysis.get('quality')} (Score: {analysis.get('score')})")
            if analysis.get("issues"):
                print(f"  Issues: {', '.join(analysis['issues'])}")

            results["details"].append({
                "question": question,
                "response_status": response.get("status"),
                "quality": analysis.get("quality"),
                "score": analysis.get("score"),
                "answer_preview": response.get("answer", "")[:100],
            })

        return results

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all test categories"""
        all_results = {
            "timestamp": datetime.now().isoformat(),
            "api_endpoint": self.endpoint,
            "categories": {},
            "summary": {
                "total_tests": 0,
                "total_passed": 0,
                "total_failed": 0,
                "pass_rate": 0.0,
            },
        }

        for category in TEST_CATEGORIES.keys():
            category_results = self.run_category_tests(category)
            all_results["categories"][category] = category_results

            all_results["summary"]["total_tests"] += category_results["total"]
            all_results["summary"]["total_passed"] += category_results["passed"]
            all_results["summary"]["total_failed"] += category_results["failed"]

        if all_results["summary"]["total_tests"] > 0:
            all_results["summary"]["pass_rate"] = (
                all_results["summary"]["total_passed"] / all_results["summary"]["total_tests"] * 100
            )

        return all_results

    def print_summary(self, results: Dict[str, Any]):
        """Print test summary"""
        print(f"\n{'='*70}")
        print("TEST SUMMARY")
        print(f"{'='*70}")
        print(f"Total Tests: {results['summary']['total_tests']}")
        print(f"Passed: {results['summary']['total_passed']}")
        print(f"Failed: {results['summary']['total_failed']}")
        print(f"Pass Rate: {results['summary']['pass_rate']:.1f}%")

        print(f"\n{'CATEGORY':<25} {'PASSED':<10} {'FAILED':<10} {'RATE':<10}")
        print("-" * 55)
        for category, cat_results in results["categories"].items():
            total = cat_results["total"]
            passed = cat_results["passed"]
            rate = (passed / total * 100) if total > 0 else 0
            print(f"{category:<25} {passed:<10} {cat_results['failed']:<10} {rate:>6.1f}%")

    def save_results(self, results: Dict[str, Any], filename: str = "test_results.json"):
        """Save test results to file"""
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to {filename}")


def main():
    """Run all tests"""
    print("Blockchain AI Agent - Comprehensive Test Suite")
    print("=" * 70)

    tester = AIAgentTester()

    # Check API connectivity
    print(f"\nChecking API connectivity to {tester.endpoint}...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=5)
        if response.status_code == 200:
            print("✓ API is reachable")
        else:
            print(f"✗ API returned status {response.status_code}")
    except Exception as e:
        print(f"✗ Cannot reach API: {e}")
        print("Make sure the backend is running on http://localhost:7860")
        return 1

    # Run all tests
    print("\nRunning comprehensive tests...")
    results = tester.run_all_tests()

    # Print summary
    tester.print_summary(results)

    # Save results
    tester.save_results(results, "test_ai_results.json")

    # Return exit code based on pass rate
    pass_rate = results["summary"]["pass_rate"]
    if pass_rate >= 80:
        print("\n✓ AI Agent is performing well!")
        return 0
    elif pass_rate >= 60:
        print("\n⚠ AI Agent needs improvements")
        return 1
    else:
        print("\n✗ AI Agent has significant issues")
        return 2


if __name__ == "__main__":
    sys.exit(main())
