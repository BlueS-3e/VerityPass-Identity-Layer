#!/usr/bin/env python3
import os, re, sys
ROOT='webapp/src'
ignore_globals = set([
    'window','document','navigator','console','setTimeout','clearTimeout','JSON','Math','Date','localStorage','fetch',
    'require','process','module','exports','import','decodeURIComponent','encodeURIComponent','atob','btoa',
    'React','useState','useEffect','useRef','useCallback','useMemo','useContext','useReducer','useLayoutEffect',
    'Promise','URL','URLSearchParams','Intl','FormData','Element','Event','EventTarget','CustomEvent',
])
identifier_re = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\b")
import_re = re.compile(r"^\s*import\s+(?:([A-Za-z_][A-Za-z0-9_]*)|\{([^}]*)\}|\*\s+as\s+([A-Za-z_][A-Za-z0-9_]*))")
# capture export const/let/var
decl_re = re.compile(r"\b(?:const|let|var|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)")
export_decl_re = re.compile(r"\bexport\s+(?:const|let|var|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)")
# also capture destructured imports: import {a as b, c} from 'x'
as_re = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)")

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    for fn in filenames:
        if fn.endswith('.js') or fn.endswith('.jsx'):
            files.append(os.path.join(dirpath, fn))

report = {}
for path in files:
    text = open(path, 'r', encoding='utf-8').read()
    imports = set()
    decls = set()
    tokens = set()
    # parse imports
    for line in text.splitlines():
        m = import_re.match(line)
        if m:
            d = m.group(1)
            br = m.group(2)
            star = m.group(3)
            if d:
                imports.add(d)
            if star:
                imports.add(star)
            if br:
                # split by comma
                parts = [p.strip() for p in br.split(',') if p.strip()]
                for p in parts:
                    mm = as_re.match(p)
                    if mm:
                        imports.add(mm.group(2))
                    else:
                        # could be 'a' or 'a as b'
                        sp = p.split(' as ')
                        imports.add(sp[-1].strip())
    # declarations
    for m in decl_re.finditer(text):
        decls.add(m.group(1))
    for m in export_decl_re.finditer(text):
        decls.add(m.group(1))
    # tokens
    for m in identifier_re.finditer(text):
        tokens.add(m.group(0))
    # property names following dot -> treat as likely property, exclude them
    prop_names = set(re.findall(r"\.\s*([A-Za-z_][A-Za-z0-9_]*)", text))

    used = tokens - imports - decls - prop_names - ignore_globals
    # also remove React hooks imported via destructuring in React import
    # remove common jsx tags
    jsx_tags = set(['div','span','button','a','input','form','img','svg','path','h1','h2','h3','h4','h5','p','ul','li'])
    used = set(x for x in used if not x[0].islower() or x not in jsx_tags)

    # narrow to candidates that are likely undefined: appear with capital or known names
    # for brevity, only keep those not in a small allowlist
    allow = set(['aria','role','className','key','props','state','setState'])
    candidates = sorted([u for u in used if u not in allow and len(u)>1])
    report[path] = candidates

# Focused output for Attestation.jsx and Launchpad.jsx
focus = [os.path.join('webapp','src','Attestation.jsx'), os.path.join('webapp','src','Launchpad.jsx')]
for p in focus:
    print('---', p, '---')
    cand = report.get(p, [])
    if not cand:
        print('No obvious undefined identifiers found by heuristic scan.')
    else:
        for c in cand:
            print(c)

# Also print top 20 for whole project for manual inspection
print('\n--- Summary (sample) ---')
allc = set()
for k,v in report.items():
    for x in v:
        allc.add(x)
print('\n'.join(sorted(list(allc))[:200]))
