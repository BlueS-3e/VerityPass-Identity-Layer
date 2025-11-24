#!/usr/bin/env python3
"""
Simple CSP scanner for built frontend assets.
Exits non-zero if inline scripts/styles or inline event handlers are found in built HTML.

Usage: python scripts/check_csp.py <path-to-built-html-dir>
Example: python scripts/check_csp.py webapp/dist
"""
import sys
import os
import re


def scan_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = f.read()
    problems = []
    # <script> tags without src
    for m in re.finditer(r'<script(?:(?!src)[^>])*?>', data, flags=re.IGNORECASE | re.DOTALL):
        problems.append(('inline-script', m.group(0)[:120].replace('\n',' ')))
    # style="..." attributes
    for m in re.finditer(r'style\s*=\s*"[^"]+"', data, flags=re.IGNORECASE):
        problems.append(('inline-style-attr', m.group(0)))
    # inline event handlers like onclick=, onload=
    # Match only when the attribute begins after whitespace (avoid matching 'content="..."' etc.)
    for m in re.finditer(r'(?<=\s)on[a-z]+\s*=\s*"[^"]+"', data, flags=re.IGNORECASE):
        problems.append(('inline-event', m.group(0)))
    return problems


def main():
    if len(sys.argv) < 2:
        print('Usage: check_csp.py <built-html-dir>')
        sys.exit(2)
    built_dir = sys.argv[1]
    if not os.path.isdir(built_dir):
        print(f"Built directory not found: {built_dir}")
        sys.exit(2)

    html_files = [os.path.join(built_dir, f) for f in os.listdir(built_dir) if f.endswith('.html')]
    if not html_files:
        print('No HTML files found in built dir; aborting check.')
        sys.exit(2)

    total_problems = 0
    for f in html_files:
        problems = scan_file(f)
        if problems:
            print(f"Issues in {f}:")
            for t, snippet in problems:
                print(f"  - {t}: {snippet}")
            total_problems += len(problems)

    if total_problems:
        print(f"Found {total_problems} inline script/style occurrences. Please remove or convert them to external assets or use nonces/hashes.")
        sys.exit(1)
    print('No inline scripts/styles found. CSP can be applied without unsafe-inline for scripts/styles.')
    sys.exit(0)


if __name__ == '__main__':
    main()
