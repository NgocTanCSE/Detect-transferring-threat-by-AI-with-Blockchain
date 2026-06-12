import edge_tts
import asyncio
import os

async def generate_audio(text, voice, rate, output_file):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_file)

async def main():
    # Kịch bản chia nhỏ để 1 câu chỉ dài khoảng 1 dòng (sub)
    script = [
        "Chào mừng đến với Blockchain AI Operations Console.",
        "Nền tảng phân tích và giám sát rủi ro giao dịch",
        "bằng Trí tuệ nhân tạo toàn diện.",
        
        "Tại System Admin Dashboard,",
        "người dùng dễ dàng giám sát sức khỏe hệ thống,",
        "lưu lượng API theo thời gian thực.",
        
        "Ở góc độ AI Data Engineer,",
        "bạn có cái nhìn tổng quan về tình trạng",
        "các mô hình học máy đang quét dữ liệu on-chain.",
        
        "Trong phần Compliance Risk Manager,",
        "hệ thống báo cáo chính xác số tiền bị chặn,",
        "thống kê minh bạch các quy tắc rủi ro.",
        
        "Với Security Analyst,",
        "cảnh báo từ AI được đẩy vào Alert Queue.",
        "Khi xem chi tiết ví, hệ thống sẽ vẽ",
        "Biểu đồ kết nối trực quan.",
        
        "Phân tích Multi-hop cho phép",
        "theo dõi dòng tiền qua nhiều bước trung gian,",
        "tự động đưa ra Phán quyết thần kinh.",
        
        "Các trường hợp vi phạm được quản lý chặt chẽ.",
        "Hệ thống cung cấp cơ chế thông báo đa kênh",
        "linh hoạt như Slack, Telegram.",
        
        "Mọi cảnh báo đều được phân loại",
        "đảm bảo không bỏ sót nguy cơ bảo mật nào.",
        
        "Cuối cùng là mô phỏng",
        "các cuộc tấn công trốn tránh trên Terminal logs.",
        
        "AI Sentinel phát hiện tức thời hành vi gian lận,",
        "tự động đình chỉ các ví vi phạm.",
        "Blockchain AI Console - Bảo vệ tài sản số của bạn."
    ]
    
    # Giọng Nam Minh của Microsoft
    voice = "vi-VN-NamMinhNeural"
    # Tốc độ đọc 1.5x (tăng 50%)
    rate = "+50%"
    
    output_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video\edge_voiceovers"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for i, line in enumerate(script):
        filename = os.path.join(output_dir, f"voice_{i+1:02d}.mp3")
        print(f"Generating audio for segment {i+1}...")
        await generate_audio(line, voice, rate, filename)
        
    print("Edge TTS Voiceover generation completed.")

if __name__ == "__main__":
    asyncio.run(main())
