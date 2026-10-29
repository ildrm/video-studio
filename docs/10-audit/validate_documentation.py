"""Offline integrity checks for this documentation set; no application behavior is tested."""
from pathlib import Path
from urllib.parse import unquote
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
def check(condition, message):
    if not condition: errors.append(message)
def load(path):
    return json.loads(path.read_text(), parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
def anchors(text):
    found = set(); counts = {}; fenced = False
    for line in text.splitlines():
        if line.startswith('```'): fenced = not fenced
        if fenced or not re.match(r'^#{1,6} ', line): continue
        value = re.sub(r'<[^>]+>|[`*]', '', re.sub(r'^#{1,6} ', '', line)).strip().lower()
        value = re.sub(r'[^\w\-\s]', '', value)
        value = re.sub(r'\s', '-', value)
        n = counts.get(value, 0); counts[value] = n + 1
        found.add(value + ('-' + str(n) if n else ''))
    return found

files = sorted(p for p in ROOT.rglob('*') if p.is_file())
mds = [p for p in files if p.suffix == '.md']
for p in files: check(p.stat().st_size > 0, f'Empty: {p.relative_to(ROOT)}')
for p in mds:
    text = p.read_text()
    check(sum(line.startswith('```') for line in text.splitlines()) % 2 == 0, f'Unclosed fence: {p.name}')
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if re.match(r'^[a-z]+://|^mailto:', target): continue
        file, _, anchor = unquote(target).partition('#')
        dest = (p.parent / file).resolve() if file else p
        check(dest.is_relative_to(ROOT), f'Link escapes docs: {p.name}: {target}')
        check(dest.exists(), f'Broken link: {p.name}: {target}')
        if anchor and dest.is_file() and dest.suffix == '.md':
            check(anchor in anchors(dest.read_text()), f'Broken anchor: {p.name}: {target}')
    # All Markdown tables have a consistent number of cells. Fenced examples excluded.
    fenced = False; table_columns = None
    for n, line in enumerate(text.splitlines(), 1):
        if line.startswith('```'): fenced = not fenced
        if fenced: continue
        if line.startswith('|') and line.endswith('|'):
            columns = len(re.split(r'(?<!\\)\|', line)) - 2
            if table_columns is None: table_columns = columns
            check(columns == table_columns, f'Table column mismatch: {p.name}:{n}')
        else: table_columns = None

for p in files:
    if p.suffix != '.json' and p.name != 'openapi.yaml': continue
    doc = load(p)
    def scan(value):
        if isinstance(value, dict):
            for k, v in value.items():
                if k == '$ref' and not re.match(r'^[a-z]+:', v):
                    name, _, fragment = v.partition('#'); target = (p.parent / name).resolve() if name else p
                    check(target.exists(), f'Missing schema file: {p.name}: {v}')
                    if target.exists() and fragment:
                        data = load(target)
                        try:
                            for part in fragment.lstrip('/').split('/'):
                                data = data[part.replace('~1', '/').replace('~0', '~')]
                        except (KeyError, TypeError): errors.append(f'Missing schema pointer: {p.name}: {v}')
                scan(v)
        elif isinstance(value, list):
            for x in value: scan(x)
    scan(doc)

api = load(ROOT/'04-backend/openapi.yaml'); opids = []; operations = 0
for p, methods in api['paths'].items():
    for method, op in methods.items():
        operations += 1; opids.append(op['operationId'])
        names = {x['name'] for x in op['parameters'] if x['in'] == 'path'}
        check(names == set(re.findall(r'\{(\w+)\}', p)), f'Path parameters: {p}')
        check('x-permission' in op and 'x-phase' in op, f'Missing policy: {p}')
        if method not in ['get','head']:
            check(any(x['name']=='X-CSRF-Token' and x.get('required') for x in op['parameters']), f'CSRF: {p}')
        for status, response in op['responses'].items():
            if status in ['201','202']: check('Location' in response.get('headers',{}), f'Missing Location: {p}')
            if status == '204': check('content' not in response, f'204 body: {p}')
check(len(opids)==len(set(opids)), 'Duplicate operation IDs')
put = api['paths']['/workspaces/{workspaceId}/projects/{projectId}/revision']['put']
check('412' in put['responses'] and '428' in put['responses'], 'Revision precondition errors missing')

catalog = (ROOT/'01-product/feature-catalog.md').read_text()
families = re.findall(r'^\| ([A-Z]{3}-\d{3}) \|', catalog, re.M)
check(len(families)==len(set(families)), 'Duplicate feature IDs')
backlog = (ROOT/'09-delivery/epics-user-stories-and-tasks.md').read_text()
taskrows = {m.group(1):m.group(0) for m in re.finditer(r'^\| (T\d{2}-\d{2}) [^\n]+',backlog,re.M)}
check(len(taskrows) == len(re.findall(r'^\| T\d{2}-\d{2} ', backlog, re.M)), 'Duplicate task definitions')
testtext = (ROOT/'09-delivery/acceptance-test-catalog.md').read_text()
testids = re.findall(r'^\| (AT-\d{2}) \|',testtext,re.M)
check(len(testids)==len(set(testids)), 'Duplicate acceptance IDs')
for feature in families:
    check(bool(re.search(r'^\| '+feature+r' \|',backlog,re.M)), f'Unmapped feature: {feature}')
for id in re.findall(r'AT-\d{2}',backlog): check(id in testids, f'Unknown test: {id}')
graph = {}
for id, row in taskrows.items():
    deps = re.findall(r'T\d{2}-\d{2}', row.split('|')[3]); graph[id]=deps
    for dep in deps:
        check(dep in taskrows, f'Unknown task dependency: {id} -> {dep}')
        check(int(dep[1:3])<=int(id[1:3]), f'Later-phase dependency: {id} -> {dep}')
def visit(id, ancestors):
    check(id not in ancestors, f'Task cycle: {" -> ".join(ancestors+[id])}')
    if id in ancestors: return
    for dep in graph.get(id,[]): visit(dep, ancestors+[id])
for id in graph: visit(id, [])
portal=(ROOT/'README.md').read_text()
for p in files:
    if p.name=='README.md': continue
    check(p.relative_to(ROOT).as_posix() in portal, f'Portal omission: {p.relative_to(ROOT)}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print(json.dumps({'files':len(files),'markdownFiles':len(mds),'openapiPaths':len(api['paths']),'operations':operations,'featureFamilies':len(families),'tasks':len(taskrows),'acceptanceScenarios':len(testids),'errors':0}))
