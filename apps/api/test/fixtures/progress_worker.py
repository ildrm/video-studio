"""Test-only progress source for lease/cancellation races; it never creates output."""
import json
import sys
import time

request = json.load(sys.stdin)
if request.get('document', {}).get('malformedFixture'):
    print('null', flush=True)
    time.sleep(10)
while True:
    print(json.dumps({'event': 'progress', 'phase': 'running', 'fraction': 0.25}), flush=True)
    time.sleep(0.1)
