#!/bin/sh
# after build.py: copy the mark's test pages and their inputs into out/ (build.py wipes out/)
cd "$(dirname "$0")/.." || exit 1
cp tools/eyediff.html tools/partsview.html tools/markdiff.html tools/chiplevels.html out/ 2>/dev/null
cp vendor/identity/mark/mark.svg out/mark.svg
cp vendor/identity/source/tufa_spider_white_master-original.svg out/
python3 - <<'PY'
import re
s=open('vendor/identity/source/tufa_spider_white_master-original.svg').read()
d=re.search(r' d="([^"]+)"',s).group(1); sub=['M '+p.strip() for p in d.split('M ') if p.strip()]
open('out/ref1c.svg','w').write(s[:s.index('<path')]+f'  <path d="{" ".join(sub[i] for i in (0,2,3,4,6,7))}" fill="#000" fill-rule="evenodd"/>\n</svg>\n')
PY
