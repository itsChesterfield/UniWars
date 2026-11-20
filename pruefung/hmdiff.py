"""Hallmark-Befunde vergleichen: hmdiff.py <datei> -> neue und weggefallene Befunde (Basis vs. Branch). Basis über BASIS=/tmp/main"""
import json, os, subprocess, sys, collections
SL = os.path.expanduser("~/.claude/skills/hallmark/scripts/sloplint.mjs")
BASIS = os.environ.get("BASIS", "/tmp/main")
def lauf(wo, f):
    if not os.path.exists(os.path.join(wo, f)): return collections.Counter()
    r = subprocess.run(["node", SL, "--scope", "app", "--genre", "modern-minimal", "--json", f], cwd=wo, capture_output=True, text=True)
    return collections.Counter((x["grade"], x["gate"], x["evidence"]) for x in json.loads(r.stdout)["findings"])
for f in sys.argv[1:]:
    a, b = lauf(BASIS, f), lauf("/home/claude/uniwars", f)
    for k in sorted((b - a).keys()): print("NEU ", f, (b-a)[k], k)
    for k in sorted((a - b).keys()): print("WEG ", f, (a-b)[k], k)
