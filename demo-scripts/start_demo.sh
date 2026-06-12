#!/bin/bash
# Wrapper to run the interactive Python demo script

echo "Đang khởi động Demo bảo mật AI Blockchain..."
echo "Đang kiểm tra các phụ thuộc..."

if ! command -v python3 &> /dev/null; then
    echo "Không tìm thấy Python3. Vui lòng cài đặt Python3."
    exit 1
fi

python3 "$(dirname "$0")/sim_ai_sentinel_scenarios.py"
