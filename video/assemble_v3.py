import os
from moviepy import VideoFileClip, AudioFileClip, CompositeAudioClip

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# Để đồng bộ chính xác, ta sẽ phải gen lại audio V3 thành các file nhỏ
# ứng với từng khung thời gian cụ thể (cụm).
import edge_tts
import asyncio

async def gen_v3_audio_chunks(output_dir):
    script_chunks = [
        "Xin chào! Đây là phần mềm Blockchain AI Operations Console.",
        "Như các bạn đang thấy, tại Dashboard Admin, chúng ta dễ dàng theo dõi sức khoẻ của hệ thống cũng như lưu lượng API.",
        "Chuyển sang góc độ kỹ sư dữ liệu, bạn sẽ nắm được tình trạng của các mô hình AI trực tiếp rà quét dữ liệu on-chain.",
        "Còn đây là tab Quản lý rủi ro. Phần mềm thống kê cực kỳ chi tiết số tiền bị chặn và các quy tắc để kiểm toán.",
        "Tiếp theo là phần thú vị nhất cho chuyên viên bảo mật! Khi xem ví đáng ngờ, AI tự vẽ ra biểu đồ kết nối.",
        "Từ đó truy vết các dòng tiền qua nhiều bước trung gian và đưa ra phán quyết tự động.",
        "Tất cả các vi phạm đều được gom lại xử lý. Kèm theo đó là hệ thống cảnh báo đa kênh qua Slack hay Telegram.",
        "Và cuối cùng, tự động nhận diện và đình chỉ tức thời các giao dịch gian lận trên Terminal logs. Một lá chắn hoàn hảo!"
    ]
    
    # 8 chunks corresponding to key scenes.
    voice = "vi-VN-NamMinhNeural"
    rate = "+50%"
    
    for i, txt in enumerate(script_chunks):
        comm = edge_tts.Communicate(txt, voice, rate=rate)
        await comm.save(os.path.join(output_dir, f"v3_{i:02d}.mp3"))

def assemble_v3(video_path, voiceover_dir, output_path, srt_path):
    video = VideoFileClip(video_path)
    audio_clips = []
    
    # 8 segments with precise timing to match video scenes
    # Video timing points:
    # 0s: Title
    # 1.5s: Admin Dashboard
    # 10s: AI Data Engineer
    # 18s: Compliance Risk Manager
    # 25s: Security Analyst
    # 32s: Multi-hop flows
    # 40s: Case Management
    # 55s: Terminal
    
    start_times = [
        0.0,   # "Xin chào..." (0-1.5s)
        1.5,   # "Như các bạn đang thấy..." (1.5-10s)
        10.0,  # "Chuyển sang góc độ..." (10-18s)
        18.0,  # "Còn đây là tab Quản lý rủi ro..." (18-25s)
        25.0,  # "Tiếp theo là phần thú vị nhất..." (25-32s)
        32.0,  # "Từ đó truy vết..." (32-40s)
        40.0,  # "Tất cả các vi phạm..." (40-55s)
        55.0   # "Và cuối cùng..." (55-66s)
    ]
    
    script_chunks = [
        "Xin chào! Đây là phần mềm Blockchain AI Operations Console.",
        "Như các bạn đang thấy, tại Dashboard Admin, chúng ta dễ dàng theo dõi sức khoẻ của hệ thống cũng như lưu lượng API.",
        "Chuyển sang góc độ kỹ sư dữ liệu, bạn sẽ nắm được tình trạng của các mô hình AI trực tiếp rà quét dữ liệu on-chain.",
        "Còn đây là tab Quản lý rủi ro. Phần mềm thống kê cực kỳ chi tiết số tiền bị chặn và các quy tắc để kiểm toán.",
        "Tiếp theo là phần thú vị nhất cho chuyên viên bảo mật! Khi xem ví đáng ngờ, AI tự vẽ ra biểu đồ kết nối.",
        "Từ đó truy vết các dòng tiền qua nhiều bước trung gian và đưa ra phán quyết tự động.",
        "Tất cả các vi phạm đều được gom lại xử lý. Kèm theo đó là hệ thống cảnh báo đa kênh qua Slack hay Telegram.",
        "Và cuối cùng, tự động nhận diện và đình chỉ tức thời các giao dịch gian lận trên Terminal logs. Một lá chắn hoàn hảo!"
    ]
    
    # Sinh srt
    srt_content = ""
    sub_index = 1
    
    for i in range(8):
        audio_file = os.path.join(voiceover_dir, f"v3_{i:02d}.mp3")
        if os.path.exists(audio_file):
            clip = AudioFileClip(audio_file)
            dur = clip.duration
            clip = clip.with_start(start_times[i])
            audio_clips.append(clip)
            
            # Split text to short lines for subtitles
            words = script_chunks[i].split(" ")
            
            # Tính thời gian mỗi từ để chia sub đều nhau
            time_per_word = dur / len(words)
            
            # Nhóm 6 từ thành 1 dòng
            words_per_line = 8
            
            word_idx = 0
            while word_idx < len(words):
                line_words = words[word_idx:word_idx+words_per_line]
                
                start_sec = start_times[i] + (word_idx * time_per_word)
                end_sec = start_times[i] + ((word_idx + len(line_words)) * time_per_word)
                
                # Make sure end_sec does not exceed the total duration of this clip
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
        
    print("Done V3!")

async def main():
    base_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    voiceover_dir = os.path.join(base_dir, "edge_voiceovers_v3")
    if not os.path.exists(voiceover_dir):
        os.makedirs(voiceover_dir)
        
    # 1. Gen audio
    print("Generating audio chunks...")
    await gen_v3_audio_chunks(voiceover_dir)
    
    # 2. Assemble
    print("Assembling video...")
    video_file = os.path.join(base_dir, "Final.mp4")
    srt_file = os.path.join(base_dir, "subtitles_v3.srt")
    output_file = os.path.join(base_dir, "Final_V3.mp4")
    
    assemble_v3(video_file, voiceover_dir, output_file, srt_file)

if __name__ == "__main__":
    asyncio.run(main())
