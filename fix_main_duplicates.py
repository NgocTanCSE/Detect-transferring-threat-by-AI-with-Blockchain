import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
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

lines = text.split('\n')
new_lines = []
commenting = False

def is_duplicate_start(line):
    s = line.strip()
    return any(f'@app.get("{r}"' in s or f'@app.post("{r}"' in s or f"@app.get('{r}'" in s or f"@app.post('{r}'" in s for r in duplicate_routes)

for line in lines:
    s = line.strip()
    if not commenting:
        if is_duplicate_start(line):
            commenting = True
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(f'{indent}# DUPLICATE: moved to ai_router.py')
            new_lines.append(f'{indent}# {line}')
        else:
            new_lines.append(line)
    else:
        # already commenting
        if s == '':
            new_lines.append('')
        elif s.startswith('@app.') or s.startswith('@router.') or s.startswith('def '):
            commenting = False
            new_lines.append(line)
        else:
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(f'{indent}# DUPLICATE {line}')

path.write_text('\n'.join(new_lines), 'utf-8')
print('DONE')
