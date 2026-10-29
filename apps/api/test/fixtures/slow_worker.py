"""Test-only worker that stays active until the supervisor cancels it."""
import json
import os
from pathlib import Path
import sys
import time

json.load(sys.stdin)
root = Path(os.environ['MEDIA_WORK_ROOT'])
with (root / 'worker-starts').open('a', encoding='utf-8') as handle:
    handle.write(str(os.getpid()) + '\n')
(root / 'worker-env.json').write_text(json.dumps(sorted(os.environ)), encoding='utf-8')
print(json.dumps({'event': 'progress', 'phase': 'running', 'fraction': 0.1}), flush=True)
while True:
    time.sleep(1)
