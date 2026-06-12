import os
from moviepy import VideoFileClip, AudioFileClip, CompositeAudioClip, CompositeVideoClip, TextClip

def assemble_video(video_path, voiceover_dir, srt_path, output_path):
    # 1. Load the original video
    print("Loading video...")
    video = VideoFileClip(video_path)
    
    # 2. Add Audio Clips
    print("Processing audio...")
    audio_clips = []
    
    # Based on the srt timestamps (approximate for the 10 clips)
    # We will map the voiceovers to specific start times in seconds
    # 1: 00:00:00,000 --> 00:00:04,500 (0.0s)
    # 2: 00:00:04,500 --> 00:00:10,000 (4.5s)
    # 3: 00:00:10,000 --> 00:00:18,000 (10.0s)
    # 4: 00:00:18,000 --> 00:00:25,000 (18.0s)
    # 5: 00:00:25,000 --> 00:00:32,000 (25.0s)
    # 6: 00:00:32,000 --> 00:00:40,000 (32.0s)
    # 7: 00:00:40,000 --> 00:00:47,000 (40.0s)
    # 8: 00:00:47,000 --> 00:00:55,000 (47.0s)
    # 9: 00:00:55,000 --> 00:01:00,000 (55.0s)
    # 10: 00:01:00,000 --> 00:01:06,000 (60.0s)
    
    start_times = [0.0, 4.5, 10.0, 18.0, 25.0, 32.0, 40.0, 47.0, 55.0, 60.0]
    
    for i in range(10):
        audio_file = os.path.join(voiceover_dir, f"voice_{i+1:02d}.wav")
        if os.path.exists(audio_file):
            clip = AudioFileClip(audio_file).with_start(start_times[i])
            audio_clips.append(clip)
            
    # Combine original audio (if any) with voiceover. Or just use voiceover.
    # We will just use the voiceovers as the primary audio.
    final_audio = CompositeAudioClip(audio_clips)
    video = video.with_audio(final_audio)
    
    # 3. Add Subtitles (Burn in)
    # MoviePy doesn't have native srt burning easily without ImageMagick.
    # To keep it simple and robust, we can use ffmpeg directly via command line to burn subtitles.
    # Let's save the intermediate video with just the new audio first.
    
    temp_output = output_path.replace(".mp4", "_temp.mp4")
    print("Writing temp video with audio...")
    video.write_videofile(temp_output, codec="libx264", audio_codec="aac")
    video.close()
    
    # 4. Burn subtitles using ffmpeg
    print("Burning subtitles with ffmpeg...")
    # FFmpeg requires forward slashes or escaped backslashes for the subtitles filter path
    srt_path_ffmpeg = srt_path.replace("\\", "/")
    # Escape colon for windows path in ffmpeg filter e.g. C:/ -> C\\:/
    srt_path_ffmpeg = srt_path_ffmpeg.replace(":", "\\:")
    
    ffmpeg_cmd = f'ffmpeg -y -i "{temp_output}" -vf "subtitles=\'{srt_path_ffmpeg}\':force_style=\'FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2\'" -c:a copy "{output_path}"'
    os.system(ffmpeg_cmd)
    
    # Cleanup temp file
    if os.path.exists(temp_output):
        os.remove(temp_output)
        
    print("Done! Final video saved to:", output_path)

if __name__ == "__main__":
    base_dir = r"c:\Users\Ngoc Tan\Downloads\blockchain-ai-project\video"
    video_file = os.path.join(base_dir, "Final.mp4")
    voiceover_dir = os.path.join(base_dir, "voiceovers")
    srt_file = os.path.join(base_dir, "subtitles.srt")
    output_file = os.path.join(base_dir, "Final_with_voice_and_subs.mp4")
    
    assemble_video(video_file, voiceover_dir, srt_file, output_file)
