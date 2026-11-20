#!/bin/bash
# Ersatz-Server starten, App bauen (Webpack, Schriften ohne Netz) und starten. Nach Sandbox-Neustart erneut aufrufen; BAUEN=0 überspringt den Build.
REPO=${REPO:-/home/claude/uniwars}
pkill -f "python3 mock.py" ; pkill -f "next-server|next start"; sleep 1
(cd /home/claude/pruefung && python3 mock.py > mock.log 2>&1 &)
cd "$REPO"
if [ "${BAUEN:-1}" = 1 ]; then
  NEXT_TELEMETRY_DISABLED=1 NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/home/claude/ext/fonts/fonts-mock.js npx next build --webpack > /tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }
fi
(PORT=3000 npx next start > /tmp/start.log 2>&1 &)
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000/login && break; sleep 1; done
echo "App: http://localhost:3000, Ersatz-Server: http://127.0.0.1:54321"
