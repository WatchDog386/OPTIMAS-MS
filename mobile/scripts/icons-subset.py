#!/usr/bin/env python3
"""Rebuilds assets/fonts/ionicons-app.woff2: only the Ionicons the app uses (plus their -outline and
-sharp twins), so phones download ~50 KB instead of the full ~390 KB icon font.

Run after using an icon the app has not used before:
    pip install fonttools brotli && python3 scripts/icons-subset.py
"""
import glob, json, re, subprocess, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
vendor = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
glyphs = json.load(open(f'{vendor}/glyphmaps/Ionicons.json'))
code = ''.join(open(f).read() for f in glob.glob('app/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts*', recursive=True))
used = {s for s in re.findall(r"['\"`]([a-z0-9-]+)['\"`]", code) if s in glyphs}
names = {v for b in {re.sub(r'-(outline|sharp)$', '', u) for u in used} for v in (b, b + '-outline', b + '-sharp') if v in glyphs}
subprocess.run(
    ['pyftsubset', f'{vendor}/Fonts/Ionicons.ttf', '--unicodes=' + ','.join('U+%04X' % glyphs[n] for n in sorted(names)),
     '--output-file=assets/fonts/ionicons-app.woff2', '--flavor=woff2', '--no-hinting', '--desubroutinize'],
    check=True,
)
print(f'{len(names)} icons, {os.path.getsize("assets/fonts/ionicons-app.woff2") // 1024} KB')
