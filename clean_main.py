import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
text = path.read_text('utf-8')

lines = text.split('\n')
new_lines = []
skip = False
current_block = []

blocks_to_remove = [
    '/diagnostics/alchemy/{wallet_address}',
    '/analyze/{wallet_address}',
    '/predict/{wallet_address}',
    '/user/{wallet_address}/history',
    '/feedback',
    '/feedback/stats',
    '/exchange/rate',
    '/exchange/estimate',
]

def is_start_of_block(line):
    s = line.strip()
    return any(f'@app.get("{r}"' in s or f'@app.post("{r}"' in s or f"@app.get('{r}'" in s or f"@app.post('{r}'" in s for r in blocks_to_remove)

for line in lines:
    s = line.strip()
    if not skip:
        if is_start_of_block(line):
            skip = True
            current_block = [line]
        else:
            new_lines.append(line)
    else:
        current_block.append(line)
        if s.startswith('@app.') or s.startswith('@router.') or s.startswith('def '):
            skip = False
            new_lines.extend(current_block)
            current_block = []
        elif s == '' and len(current_block) > 20:
            skip = False
            new_lines.extend(current_block)
            current_block = []

if current_block:
    new_lines.extend(current_block)

path.write_text('\n'.join(new_lines), 'utf-8')
print('DONE')
