import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
text = path.read_text('utf-8')

old = "# app.include_router(ai_router)"
new = "app.include_router(ai_router)"

if old in text:
    path.write_text(text.replace(old, new), 'utf-8')
    print('OK')
else:
    print('NOT FOUND')
