import pyttsx3
import os

def generate_voiceover(script_lines, output_dir):
    engine = pyttsx3.init()
    
    # Optional: Configure voice properties (rate, volume, voice type)
    # voices = engine.getProperty('voices')
    # engine.setProperty('voice', voices[1].id) # 0 for male, 1 for female (if available)
    engine.setProperty('rate', 150) # Speed of speech
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for i, line in enumerate(script_lines):
        if line.strip():
            filename = os.path.join(output_dir, f"voice_{i+1:02d}.wav")
            print(f"Generating audio for segment {i+1}...")
            engine.save_to_file(line, filename)
    
    engine.runAndWait()
    print("Voiceover generation completed.")

if __name__ == "__main__":
    script = [
        "Chào mừng đến với Blockchain AI Operations Console. Nền tảng phân tích và giám sát rủi ro giao dịch Blockchain toàn diện bằng Trí tuệ nhân tạo.",
        "Tại bảng điều khiển System Admin, người dùng dễ dàng giám sát sức khỏe hệ thống, lưu lượng API và các số liệu kỹ thuật theo thời gian thực.",
        "Ở góc độ AI Data Engineer, nền tảng cung cấp cái nhìn tổng quan về tình trạng các mô hình học máy, tính năng và các phiên bản model đang trực tiếp quét dữ liệu on-chain.",
        "Trong phần Compliance Risk Manager, hệ thống báo cáo chính xác số tiền bị chặn, thống kê minh bạch các quy tắc rủi ro để phục vụ kiểm toán và rà soát pháp lý.",
        "Với Security Analyst, mỗi cảnh báo từ AI sẽ được đẩy vào Alert Queue. Khi xem chi tiết ví, hệ thống sẽ vẽ ra Biểu đồ kết nối trực quan.",
        "Phân tích Multi-hop cho phép theo dõi dòng tiền qua nhiều bước trung gian, bóc tách hành vi đáng ngờ và đưa ra Phán quyết thần kinh tự động.",
        "Các trường hợp vi phạm được quản lý chặt chẽ theo trạng thái. Hệ thống cung cấp cơ chế thông báo đa kênh linh hoạt như Slack, Telegram hay Webhook.",
        "Mọi cảnh báo đều được phân loại mức độ khẩn cấp, đảm bảo đội ngũ vận hành không bỏ sót bất kỳ nguy cơ bảo mật nào.",
        "Cuối cùng là mô phỏng các cuộc tấn công trốn tránh trên Terminal logs.",
        "AI Sentinel phát hiện tức thời hành vi gian lận và tự động đình chỉ các ví vi phạm. Blockchain AI Operations Console - Bảo vệ tài sản số của bạn."
    ]
    
    output_directory = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video\voiceovers"
    generate_voiceover(script, output_directory)
