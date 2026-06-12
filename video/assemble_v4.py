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

async def gen_v4_audio_chunks(output_dir, script_chunks):
    voice = "vi-VN-NamMinhNeural"
    rate = "+50%"
    for i, txt in enumerate(script_chunks):
        comm = edge_tts.Communicate(txt, voice, rate=rate)
        await comm.save(os.path.join(output_dir, f"v4_{i:02d}.mp3"))

def assemble_v4(video_path, voiceover_dir, output_path, srt_path, script_chunks, start_times):
    video = VideoFileClip(video_path)
    audio_clips = []
    
    srt_content = ""
    sub_index = 1
    
    for i in range(len(script_chunks)):
        audio_file = os.path.join(voiceover_dir, f"v4_{i:02d}.mp3")
        if os.path.exists(audio_file):
            clip = AudioFileClip(audio_file)
            dur = clip.duration
            clip = clip.with_start(start_times[i])
            audio_clips.append(clip)
            
            words = script_chunks[i].split(" ")
            time_per_word = dur / len(words)
            words_per_line = 7 # Giữ phụ đề luôn ở 1 hàng
            
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

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
        
    final_audio = CompositeAudioClip(audio_clips)
    video = video.with_audio(final_audio)
    
    temp_output = output_path.replace(".mp4", "_temp.mp4")
    video.write_videofile(temp_output, codec="libx264", audio_codec="aac")
    video.close()
    
    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")
    ffmpeg_cmd = f'ffmpeg -y -i "{temp_output}" -vf "subtitles=\'{srt_path_ffmpeg}\':force_style=\'FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2\'" -c:a copy "{output_path}"'
    os.system(ffmpeg_cmd)
    
    if os.path.exists(temp_output):
        os.remove(temp_output)
        
    print("Done V4!")

async def main():
    base_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    voiceover_dir = os.path.join(base_dir, "edge_voiceovers_v4")
    if not os.path.exists(voiceover_dir):
        os.makedirs(voiceover_dir)
        
    script_chunks = [
        "Tại Admin Dashboard, bạn có thể giám sát sức khoẻ toàn bộ hệ thống. Đồng thời theo dõi lưu lượng API, tỷ lệ lỗi và độ trễ trong thời gian thực.",
        "Chuyển sang góc độ Kỹ sư dữ liệu AI. Hệ thống quản lý chi tiết các tính năng và phiên bản mô hình máy học như anomaly hay graph propagation đang quét on-chain.",
        "Đối với Quản lý rủi ro tuân thủ, phần mềm thống kê chính xác lượng tiền bị chặn. Các quy tắc rủi ro được minh bạch hóa để phục vụ kiểm toán.",
        "Khi chuyên viên bảo mật phân tích một ví đáng ngờ, AI lập tức vẽ ra biểu đồ kết nối trực quan để bóc tách hành vi đa lớp.",
        "Thông qua phân tích Multi-hop, hệ thống tự động dò tìm dòng tiền qua nhiều bước trung gian và đưa ra Phán quyết thần kinh tự động.",
        "Tất cả trường hợp vi phạm được gom thành Case xử lý. Đi kèm là hệ thống cảnh báo đa kênh phân loại theo mức độ khẩn cấp để đảm bảo an toàn.",
        "Và đây là mô phỏng trên logs thực tế. AI Sentinel tự động nhận diện hành vi rửa tiền và đình chỉ tức thời các ví vi phạm trước khi chúng kịp hành động."
    ]
    
    # Bắt đầu vào mốc 1.0s thay vì 0.0s, giải quyết triệt để lỗi chồng chéo ở logo
    start_times = [
        1.0,   # Cụm 1: Admin
        10.0,  # Cụm 2: AI Data
        18.0,  # Cụm 3: Compliance
        25.0,  # Cụm 4: Security (Connection Graph)
        32.0,  # Cụm 5: Multi-hop/Neural Verdict
        40.0,  # Cụm 6: Case
        55.0   # Cụm 7: Terminal Logs
    ]
        
    print("Generating V4 audio chunks...")
    await gen_v4_audio_chunks(voiceover_dir, script_chunks)
    
    print("Assembling V4 video...")
    video_file = os.path.join(base_dir, "Final.mp4")
    srt_file = os.path.join(base_dir, "subtitles_v4.srt")
    output_file = os.path.join(base_dir, "Final_V4.mp4")
    
    assemble_v4(video_file, voiceover_dir, output_file, srt_file, script_chunks, start_times)

if __name__ == "__main__":
    asyncio.run(main())
