import os
import asyncio
import edge_tts
from moviepy import VideoFileClip, AudioFileClip, CompositeAudioClip

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

async def gen_audio_chunks(output_dir, script_chunks):
    """Generate TTS audio for each script chunk using Edge TTS."""
    voice = "vi-VN-NamMinhNeural"
    rate = "+50%"  # 1.5x speed
    for i, txt in enumerate(script_chunks):
        out_file = os.path.join(output_dir, f"v5_{i:02d}.mp3")
        print(f"  Generating audio chunk {i}: {txt[:50]}...")
        comm = edge_tts.Communicate(txt, voice, rate=rate)
        await comm.save(out_file)
        print(f"  -> Saved {out_file}")

def assemble(video_path, voiceover_dir, output_path, srt_path, script_chunks, start_times):
    """Assemble video with voiceover audio and burned-in subtitles."""
    video = VideoFileClip(video_path)
    audio_clips = []
    
    srt_content = ""
    sub_index = 1
    
    for i in range(len(script_chunks)):
        audio_file = os.path.join(voiceover_dir, f"v5_{i:02d}.mp3")
        if os.path.exists(audio_file):
            clip = AudioFileClip(audio_file)
            dur = clip.duration
            clip = clip.with_start(start_times[i])
            audio_clips.append(clip)
            
            # Split subtitle into single-line segments (~8 words per line)
            words = script_chunks[i].split(" ")
            time_per_word = dur / len(words)
            words_per_line = 8  # Giữ phụ đề luôn ở 1 dòng, dễ đọc
            
            word_idx = 0
            while word_idx < len(words):
                line_words = words[word_idx:word_idx+words_per_line]
                
                start_sec = start_times[i] + (word_idx * time_per_word)
                end_sec = start_times[i] + ((word_idx + len(line_words)) * time_per_word)
                
                if end_sec > start_times[i] + dur:
                    end_sec = start_times[i] + dur
                
                start_str = format_time(start_sec)
                end_str = format_time(end_sec)
                
                text_line = " ".join(line_words)
                srt_content += f"{sub_index}\n{start_str} --> {end_str}\n{text_line}\n\n"
                
                sub_index += 1
                word_idx += words_per_line

    # Write SRT file
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    print(f"SRT file saved: {srt_path}")
        
    # Merge audio onto video
    final_audio = CompositeAudioClip(audio_clips)
    video = video.with_audio(final_audio)
    
    temp_output = output_path.replace(".mp4", "_temp.mp4")
    print("Writing temp video with audio...")
    video.write_videofile(temp_output, codec="libx264", audio_codec="aac")
    video.close()
    
    # Burn subtitles using ffmpeg
    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")
    ffmpeg_cmd = (
        f'ffmpeg -y -i "{temp_output}" '
        f'-vf "subtitles=\'{srt_path_ffmpeg}\':force_style=\'FontSize=18,FontName=Arial,'
        f'PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,'
        f'BorderStyle=3,Outline=1,Shadow=0,MarginV=30\'" '
        f'-c:a copy "{output_path}"'
    )
    print("Burning subtitles with ffmpeg...")
    os.system(ffmpeg_cmd)
    
    # Cleanup temp file
    if os.path.exists(temp_output):
        os.remove(temp_output)
        
    print(f"Done! Output: {output_path}")

async def main():
    base_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    voiceover_dir = os.path.join(base_dir, "edge_voiceovers_v5")
    if not os.path.exists(voiceover_dir):
        os.makedirs(voiceover_dir)
    
    # =====================================================================
    # SCRIPT - Kịch bản lồng tiếng cho video 0526.mp4 (80s)
    # Giọng nam NamMinh, tốc độ 1.5x
    # Văn phong nghiêm túc, liền mạch, có câu dẫn chuyển đoạn
    # =====================================================================
    script_chunks = [
        # Chunk 0: INTRO - Giới thiệu cụ thể công dụng dự án (~14s ảnh nền)
        "Trong thị trường Blockchain hiện nay, mỗi năm có hàng tỷ đô la bị thất thoát "
        "do gian lận, rửa tiền và tấn công mạng. "
        "Blockchain AI Operations Console là nền tảng giám sát thông minh, "
        "ứng dụng trí tuệ nhân tạo để phát hiện giao dịch bất thường, "
        "truy vết dòng tiền đáng ngờ, "
        "và tự động đình chỉ các ví vi phạm trước khi thiệt hại xảy ra.",

        # Chunk 1: Admin Dashboard
        "Tại giao diện Admin Dashboard, người quản trị giám sát toàn diện sức khỏe hệ thống, "
        "theo dõi lưu lượng API, tỷ lệ lỗi và độ trễ xử lý.",

        # Chunk 2: AI Data Engineer
        "Chuyển sang góc nhìn Kỹ sư dữ liệu AI. "
        "Hệ thống quản lý chi tiết các tính năng và phiên bản mô hình máy học "
        "như anomaly detection hay graph propagation đang quét dữ liệu on-chain.",

        # Chunk 3: Compliance Risk Manager
        "Đối với Quản lý rủi ro tuân thủ, phần mềm thống kê chính xác lượng tiền đã bị chặn, "
        "các quy tắc rủi ro được minh bạch hóa phục vụ công tác kiểm toán.",

        # Chunk 4: Security Analyst - Wallet Intelligence
        "Khi chuyên viên bảo mật phân tích một ví đáng ngờ, "
        "AI lập tức vẽ ra biểu đồ kết nối trực quan "
        "giúp bóc tách hành vi giao dịch đa lớp.",

        # Chunk 5: Multi-hop Analysis
        "Thông qua phân tích Multi-hop, hệ thống tự động dò tìm dòng tiền "
        "qua nhiều bước trung gian và đưa ra phán quyết thần kinh tự động.",

        # Chunk 6: Case Management & Notifications
        "Toàn bộ vi phạm được tổng hợp thành từng Case xử lý. "
        "Đi kèm là hệ thống cảnh báo đa kênh, phân loại theo mức độ khẩn cấp "
        "để đảm bảo phản ứng kịp thời.",

        # Chunk 7: Terminal Logs Simulation
        "Và đây là mô phỏng trên logs thực tế. "
        "AI Sentinel tự động nhận diện hành vi rửa tiền "
        "và đình chỉ tức thời các ví vi phạm trước khi chúng kịp hành động.",

        # Chunk 8: KẾT - Lời kết đầu tư
        "Với tiềm năng ứng dụng to lớn, giải pháp này không chỉ bảo vệ tài sản "
        "mà còn củng cố niềm tin, mở ra cơ hội đầu tư bền vững trong kỷ nguyên Web3.",
    ]
    
    # Step 1: Generate TTS audio
    print("=" * 60)
    print("STEP 1: Generating TTS audio chunks...")
    print("=" * 60)
    await gen_audio_chunks(voiceover_dir, script_chunks)
    
    # Step 1.5: Auto-calculate start_times based on actual audio durations
    print("=" * 60)
    print("STEP 1.5: Calculating timing from actual audio durations...")
    print("=" * 60)
    
    durations = []
    for i in range(len(script_chunks)):
        audio_file = os.path.join(voiceover_dir, f"v5_{i:02d}.mp3")
        clip = AudioFileClip(audio_file)
        durations.append(clip.duration)
        clip.close()
    
    # Intro bắt đầu tại 0.5s, các chunk tiếp theo nối đuôi với khoảng cách 1.5s
    start_times = [0.5]  # Chunk 0: Intro
    for i in range(1, len(script_chunks)):
        next_start = start_times[i-1] + durations[i-1] + 1.5  # 1.5s gap
        start_times.append(round(next_start, 1))
    
    # In ra timeline để kiểm tra
    for i in range(len(script_chunks)):
        end = start_times[i] + durations[i]
        print(f"  Chunk {i}: {start_times[i]:.1f}s -> {end:.1f}s (dur={durations[i]:.1f}s)")
    
    last_end = start_times[-1] + durations[-1]
    print(f"  Total audio ends at: {last_end:.1f}s (video: 80.1s)")
    if last_end > 80.1:
        print("  WARNING: Audio exceeds video length!")
    
    # Step 2 & 3: Assemble video with audio + subtitles
    print("=" * 60)
    print("STEP 2: Assembling video with audio and subtitles...")
    print("=" * 60)
    video_file = os.path.join(base_dir, "0526.mp4")
    srt_file = os.path.join(base_dir, "subtitles_v5.srt")
    output_file = os.path.join(base_dir, "Final_V5.mp4")
    
    assemble(video_file, voiceover_dir, output_file, srt_file, script_chunks, start_times)

if __name__ == "__main__":
    asyncio.run(main())
