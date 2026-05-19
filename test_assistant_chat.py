#!/usr/bin/env python3
"""
Test script: Run 10 random assistant chat queries.
Tests dashboard analytics, wallet-specific, system architecture, account support, and open-domain questions.
"""

import json
import time
import requests
import random

# Test queries across all categories
test_queries = [
    # Dashboard Analytics
    ("dashboard_analytics_1", "4 chỉ số chính trên dashboard là gì?"),
    ("dashboard_analytics_2", "Hôm nay tổng cảnh báo là bao nhiêu và so với hôm qua thì tăng hay giảm?"),
    ("dashboard_analytics_3", "Hiện tại có bao nhiêu ví đang được theo dõi?"),

    # Wallet & Risk Analysis
    ("wallet_analysis_1", "Ví nào có risk score cao nhất trong hệ thống?"),
    ("wallet_analysis_2", "Cảnh báo critical nghĩa là gì và cần xử lý như thế nào?"),

    # System Architecture
    ("system_architecture_1", "Hệ thống này gồm những thành phần chính nào?"),
    ("system_architecture_2", "Frontend sử dụng công nghệ gì?"),

    # Account Support
    ("account_support_1", "Làm sao để đăng ký tài khoản mới?"),
    ("account_support_2", "Bị lỗi đăng nhập thì phải làm sao?"),

    # Open Domain (General Knowledge)
    ("open_domain_1", "Ethereum là gì?"),
    ("open_domain_2", "Làm sao để bảo vệ ví crypto an toàn?"),
    ("open_domain_3", "Blockchain có ứng dụng nào trong ngân hàng không?"),
]

BASE_URL = "http://127.0.0.1:8000"
ENDPOINT = "/assistant/chat"

print("=" * 80)
print("AI ASSISTANT CHAT TEST SUITE - 10 RANDOM QUERIES")
print("=" * 80)
print()

# Shuffle and pick 10 queries
random.shuffle(test_queries)
selected_queries = test_queries[:10]

results = []
successful_count = 0
error_count = 0
fallback_count = 0

for idx, (query_id, question) in enumerate(selected_queries, 1):
    print(f"[{idx}/10] Query ID: {query_id}")
    print(f"        Question: {question}")

    payload = {
        "message": question,
        "role": "operator",
        "wallet_address": None,
        "screen_scope": "dashboard",
        "conversation_history": [],
        "context": {},
    }

    try:
        response = requests.post(
            f"{BASE_URL}{ENDPOINT}",
            json=payload,
            timeout=15,
        )

        if response.status_code == 200:
            data = response.json()
            answer = data.get("answer", "").strip()
            model_enabled = data.get("model_enabled", False)
            sources = data.get("sources", [])

            # Check if fallback was used (low quality detection)
            is_fallback = not answer or len(answer) < 50 or "Hiện chưa có đủ dữ liệu" in answer

            if is_fallback:
                fallback_count += 1
                status = "[FALLBACK]"
            else:
                successful_count += 1
                status = "[SUCCESS]"

            answer_preview = answer[:100] + "..." if len(answer) > 100 else answer
            print(f"        Status: {status}")
            print(f"        AI Model: {'ENABLED' if model_enabled else 'DISABLED'}")
            print(f"        Answer Preview: {answer_preview}")
            print(f"        Sources: {sources[:2]}")  # First 2 sources

            results.append({
                "query_id": query_id,
                "question": question,
                "status": "success" if not is_fallback else "fallback",
                "answer_length": len(answer),
                "model_enabled": model_enabled,
                "sources_count": len(sources),
                "answer": answer[:150],  # Store first 150 chars
            })
        else:
            error_count += 1
            print(f"        Status: [ERROR] HTTP {response.status_code}")
            print(f"        Response: {response.text[:100]}")
            results.append({
                "query_id": query_id,
                "question": question,
                "status": "error",
                "error_code": response.status_code,
            })
    except requests.exceptions.Timeout:
        error_count += 1
        print(f"        Status: [TIMEOUT]")
        results.append({
            "query_id": query_id,
            "question": question,
            "status": "timeout",
        })
    except Exception as e:
        error_count += 1
        print(f"        Status: [EXCEPTION] {type(e).__name__}: {str(e)[:50]}")
        results.append({
            "query_id": query_id,
            "question": question,
            "status": "exception",
            "error": str(e)[:100],
        })

    print()
    time.sleep(0.5)  # Small delay between requests

# Summary
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total Queries: 10")
print(f"✓ Successful: {successful_count}")
print(f"⚠ Fallback (low quality): {fallback_count}")
print(f"✗ Errors: {error_count}")
print()
print("Result Details:")
for r in results:
    if r["status"] == "success":
        print(f"  {r['query_id']}: ✓ SUCCESS ({r['answer_length']} chars)")
    elif r["status"] == "fallback":
        print(f"  {r['query_id']}: ⚠ FALLBACK ({r['answer_length']} chars)")
    elif r["status"] == "error":
        print(f"  {r['query_id']}: ✗ HTTP ERROR {r.get('error_code', 'N/A')}")
    elif r["status"] == "timeout":
        print(f"  {r['query_id']}: ✗ TIMEOUT")
    else:
        print(f"  {r['query_id']}: ✗ {r['status'].upper()}")

print()
print("=" * 80)
