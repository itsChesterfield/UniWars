#!/bin/bash
# Prüfwerkzeuge für UniVerse in der Sandbox einrichten. Aufruf aus dem Repo:
#   git fetch origin werkzeuge/pruefung && git archive origin/werkzeuge/pruefung | tar -x -C /home/claude/wz && bash /home/claude/wz/einrichten.sh
set -e
WZ=$(cd "$(dirname "$0")" && pwd)
mkdir -p /home/claude/pruefung/bilder /home/claude/ext
cp "$WZ"/pruefung/* /home/claude/pruefung/
cp -r "$WZ"/ext/fonts "$WZ"/ext/axe /home/claude/ext/
(cd /home/claude/ext/fonts && npm ci --silent) && (cd /home/claude/ext/axe && npm ci --silent)
python3 -c "import playwright" 2>/dev/null || pip install -q --break-system-packages playwright
python3 -m playwright install chromium >/dev/null 2>&1 || true
if [ ! -f ~/.claude/skills/hallmark/scripts/sloplint.mjs ]; then
  git clone -q --depth 1 https://github.com/Nutlope/hallmark.git /home/claude/ext/hallmark
  mkdir -p ~/.claude/skills && ln -sfn /home/claude/ext/hallmark/skills/hallmark ~/.claude/skills/hallmark
fi
python3 /home/claude/pruefung/cookie.py
# App gegen den Ersatz-Server (keine echten Schlüssel)
REPO=${REPO:-/home/claude/uniwars}
[ -f "$REPO/.env.local" ] || printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pruefung\n' > "$REPO/.env.local"
echo "Fertig. Weiter mit: bash /home/claude/pruefung/start.sh"
