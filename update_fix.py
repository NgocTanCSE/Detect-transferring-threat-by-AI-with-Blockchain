import pathlib

new_content = '''import pathlib

path = pathlib.Path(r'C:\\Users\\Ngoc Tan\\Downloads\\blockchain-ai-project\\backend\\app\\main.py')
text = path.read_text('utf-8')

duplicate_routes = [
    '/diagnostics/alchemy/{wallet_address}',
    '/analyze/{wallet_address}',
    '/predict/{wallet_address}',
    '/feedback',
    '/feedback/stats',
    '/exchange/rate',
    '/exchange/estimate',
]

lines = text.split('\\n')
new_lines = []
commenting = False
after_blank = False

for i, line in enumerate(lines):
    stripped = line.strip()
    
    if not commenting:
        is_duplicate = False
        matched_route = ''
        for route in duplicate_routes:
            if (f'@app.get("{route}"' in stripped or f'@app.post("{route}"' in stripped or
                f"@app.get('{route}'" in stripped or f"@app.post('{route}'" in stripped):
                is_duplicate = True
                matched_route = route
                break
        
        if is_duplicate:
            commenting = True
            after_blank = False
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(f'{indent}# DUPLICATE: moved to ai_router.py - {matched_route}')
            new_lines.append(f'{indent}# {line}')
        elif stripped == '# DUPLICATE: moved to ai_router.py' or stripped.startswith('# DUPLICATE: moved to ai_router.py - '):
            commenting = True
            after_blank = False
            new_lines.append(line)
        else:
            new_lines.append(line)
    else:
        if stripped == '':
            after_blank = True
            new_lines.append(f'# {line}' if line else '')
        elif after_blank and (stripped.startswith('@app.') or stripped.startswith('@router.')):
            commenting = False
            after_blank = False
            new_lines.append(line)
        else:
            after_blank = False
            indent = line[:len(line) - len(line.lstrip())]
            if stripped.startswith('#'):
                new_lines.append(line)
            else:
                new_lines.append(f'{indent}# DUPLICATE {line}')

path.write_text('\\n'.join(new_lines), 'utf-8')
print('DONE')
'''

target = pathlib.Path(r'C:\\Users\\Ngoc Tan\\Downloads\\blockchain-ai-project\\fix_main_duplicates.py')
target.write_text(new_content, 'utf-8')
print('Fixed script updated')
