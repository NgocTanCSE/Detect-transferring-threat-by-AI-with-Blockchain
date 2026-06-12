import edge_tts
import asyncio
import os

async def generate_single_audio(output_file):
    # Kịch bản liền mạch
    # Dùng SSML hoặc cấu trúc câu để kiểm soát ngắt nghỉ
    text = (
        "Xin chào! Đây là phần mềm Blockchain AI Operations Console. "
        "Như các bạn đang thấy, tại Dashboard Admin, chúng ta có thể dễ dàng theo dõi toàn bộ sức khoẻ của hệ thống cũng như lưu lượng API đang chạy. "
        "Chuyển sang góc độ của kỹ sư dữ liệu, bạn sẽ nắm được ngay tình trạng của các mô hình AI đang trực tiếp rà quét dữ liệu on-chain. "
        "Còn đây là tab Quản lý rủi ro. Phần mềm sẽ thống kê cực kỳ chi tiết số tiền bị chặn và các quy tắc để phục vụ kiểm toán. "
        "Tiếp theo là phần thú vị nhất dành cho các chuyên viên bảo mật! Khi xem chi tiết một ví đáng ngờ, AI sẽ tự động vẽ ra biểu đồ kết nối rất trực quan. Từ đó truy vết các dòng tiền qua nhiều bước trung gian và đưa ra phán quyết tự động. "
        "Tất cả các vi phạm đều được gom lại để xử lý. Kèm theo đó là hệ thống cảnh báo đa kênh tiện lợi qua Slack hay Telegram để không ai bỏ sót thông tin. "
        "Và cuối cùng, phần mềm chứng minh sức mạnh bằng cách tự động nhận diện và đình chỉ ngay lập tức các giao dịch gian lận hiển thị trực tiếp trên Terminal logs này. Một lá chắn hoàn hảo cho tài sản số của bạn!"
    )
    
    # Giọng Nam Minh của Microsoft
    voice = "vi-VN-NamMinhNeural"
    # Tốc độ đọc 1.5x (tăng 50%)
    rate = "+50%"
    
    print("Generating seamless audio V3...")
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_file)
    print("Edge TTS Single Voiceover generation completed.")

if __name__ == "__main__":
    output_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    filename = os.path.join(output_dir, "voice_v3_full.mp3")
    asyncio.run(generate_single_audio(filename))
