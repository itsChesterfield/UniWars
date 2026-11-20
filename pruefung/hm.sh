#!/bin/bash
# Hallmark je Datei: hm.sh <repo-verzeichnis> <dateien...>  -> FAIL REFLEX WARN je Datei und Summe
cd "$1"; shift
tf=0; tr=0; tw=0
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "fehlt     $f"; continue; fi
  read a b c < <(node ~/.claude/skills/hallmark/scripts/sloplint.mjs --scope app --genre modern-minimal --json "$f" | python3 -c "import json,sys; s=json.load(sys.stdin)['summary']; print(s['fails'], s['reflex'], s['warns'])")
  printf "%4s %4s %4s  %s\n" "$a" "$b" "$c" "$f"
  tf=$((tf+a)); tr=$((tr+b)); tw=$((tw+c))
done
printf "%4s %4s %4s  SUMME (FAIL REFLEX WARN)\n" "$tf" "$tr" "$tw"
