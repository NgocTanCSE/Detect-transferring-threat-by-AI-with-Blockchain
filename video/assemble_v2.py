import os
from moviepy import VideoFileClip, AudioFileClip, CompositeAudioClip

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def assemble_v2(video_path, voiceover_dir, output_path, srt_path):
    video = VideoFileClip(video_path)
    
    script_lines = [
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

    # Cần tính toán timeline. Do đọc 1.5x nên tổng thời gian thoại sẽ khá ngắn
    # Ta sẽ rải đều các câu thoại qua video, nhưng đảm bảo audio không trùng lấp
    # Video dài 66 giây.
    # Ta chia làm 7 "cụm" cảnh tương ứng với video.
    
    # Cụm 1: 0 - 10s (câu 1-6)
    # Cụm 2: 10 - 18s (câu 7-9)
    # Cụm 3: 18 - 25s (câu 10-12)
    # Cụm 4: 25 - 40s (câu 13-19)
    # Cụm 5: 40 - 55s (câu 20-24)
    # Cụm 6: 55 - 60s (câu 25-26)
    # Cụm 7: 60 - 66s (câu 27-29)

    group_starts = {
        0: 0.0, 
        6: 10.0, 
        9: 18.0, 
        12: 25.0, 
        19: 40.0, 
        24: 55.0, 
        26: 60.0
    }
    
    audio_clips = []
    srt_content = ""
    
    current_time = 0.0
    
    for i in range(len(script_lines)):
        audio_file = os.path.join(voiceover_dir, f"voice_{i+1:02d}.mp3")
        
        if i in group_starts:
            # Sync to the next scene
            current_time = max(current_time, group_starts[i])
            
        if os.path.exists(audio_file):
            clip = AudioFileClip(audio_file)
            duration = clip.duration
            
            clip = clip.with_start(current_time)
            audio_clips.append(clip)
            
            start_str = format_time(current_time)
            end_str = format_time(current_time + duration)
            
            srt_content += f"{i+1}\n{start_str} --> {end_str}\n{script_lines[i]}\n\n"
            
            # Gap of 0.2s between sentences
            current_time += duration + 0.2

    # Save SRT
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
        
    print("Saved SRT to", srt_path)

    # Combine audio
    final_audio = CompositeAudioClip(audio_clips)
    video = video.with_audio(final_audio)
    
    temp_output = output_path.replace(".mp4", "_temp.mp4")
    print("Writing temp video with audio...")
    video.write_videofile(temp_output, codec="libx264", audio_codec="aac")
    video.close()
    
    print("Burning subtitles with ffmpeg...")
    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")
    # Font size 16 to keep subtitles small and single line
    ffmpeg_cmd = f'ffmpeg -y -i "{temp_output}" -vf "subtitles=\'{srt_path_ffmpeg}\':force_style=\'FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2\'" -c:a copy "{output_path}"'
    os.system(ffmpeg_cmd)
    
    if os.path.exists(temp_output):
        os.remove(temp_output)
        
    print("Done! Final video V2 saved to:", output_path)

if __name__ == "__main__":
    base_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    video_file = os.path.join(base_dir, "Final.mp4")
    voiceover_dir = os.path.join(base_dir, "edge_voiceovers")
    srt_file = os.path.join(base_dir, "subtitles_v2.srt")
    output_file = os.path.join(base_dir, "Final_V2.mp4")
    
    assemble_v2(video_file, voiceover_dir, output_file, srt_file)
