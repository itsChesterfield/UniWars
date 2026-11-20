"""Rundgang: Seiten in beiden Designs bei 1440/390, axe, Querscrollen, Tippziele unter 24 px, abgeschnittene Texte.
Aufruf: PREFIX=vor python3 audit.py [/seite,/seite2]   NUR=390 oder NUR=nacht schränkt ein. Ausgabe: Befunde, Bilder in bilder/"""
import os, sys, urllib.request
from playwright.sync_api import sync_playwright
BASIS = os.environ.get("BASIS", "http://127.0.0.1:3000")
PREFIX = os.environ.get("PREFIX", "a")
NUR = os.environ.get("NUR", "")
BILDER = os.environ.get("BILDER", "1") == "1"
COOKIE = open("/home/claude/pruefung/cookie.txt").read()
AXE = open("/home/claude/ext/axe/node_modules/axe-core/axe.min.js").read()
SEITEN = sys.argv[1].split(",") if len(sys.argv) > 1 else [
    "/", "/termine", "/aufgaben", "/noten", "/fortschritt", "/faecher", "/work-station", "/karteikarten", "/notizen",
    "/pdf-reader", "/lernraum", "/dateiablage", "/literaturverwaltung", "/transkription", "/chat", "/textverarbeitung",
    "/tabellen", "/praesentationen", "/mindmap", "/whiteboard", "/einstellungen", "/einstellungen/personalisierung"]
B = []
def mock(p): urllib.request.urlopen("http://127.0.0.1:54321" + p).read()

KLEIN = """() => [...document.querySelectorAll('button, a[href], input, select, summary, [role=tab], [role=button]')]
  .filter(e => e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'color' && e.type !== 'hidden')
  .filter(e => !e.closest('.tb-raster, .md-inhalt, .ProseMirror, .folie, p, li > p'))
  .filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
     return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && cs.visibility !== 'hidden' && cs.display !== 'inline'; })
  .map(e => (typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + '" ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))"""

ABGESCHNITTEN = """() => [...document.querySelectorAll('body *')].filter(e => {
    if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const r = e.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return false;
    const x = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis';
    return x && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis';
  }).map(e => (typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) + ' "' + e.textContent.trim().slice(0, 40) + '"')"""

def axe(pg, name):
    pg.add_script_tag(content=AXE)
    r = pg.evaluate("""async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations
        .map(v => ({id: v.id, n: v.nodes.length, z: v.nodes.slice(0,3).map(x => x.target.join(' ')).join(' | ')}))""")
    for v in r: B.append(f"AXE {name}: {v['id']} ({v['n']}) {v['z'][:300]}")

def pruefen(pg, name):
    w = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    if w > 1: B.append(f"QUER {name}: {w}px")
    for k in sorted(set(pg.evaluate(KLEIN))): B.append(f"ZIEL<24 {name}: {k}")
    for k in sorted(set(pg.evaluate(ABGESCHNITTEN)))[:8]: B.append(f"ABGESCHNITTEN {name}: {k}")
    axe(pg, name)

def kontext(b, breite):
    ctx = b.new_context(viewport={"width": breite, "height": 900}, has_touch=breite < 600)
    ctx.add_cookies([{"name": "sb-127-auth-token", "value": COOKIE, "url": BASIS}])
    return ctx

if __name__ == "__main__":
    with sync_playwright() as p:
        b = p.chromium.launch()
        for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
            mock(f"/__theme?w={theme}"); mock("/__modus?w=voll")
            for breite in (1440, 390):
                tag = f"{dt}-{breite}"
                if NUR and NUR not in tag: continue
                ctx = kontext(b, breite); pg = ctx.new_page(); f = []
                pg.on("pageerror", lambda e: f.append(str(e)))
                pg.on("dialog", lambda d: d.dismiss())
                for s in SEITEN:
                    f.clear()
                    pg.goto(BASIS + s, wait_until="load"); pg.wait_for_timeout(900)
                    k = pg.locator("button", has_text="Ablehnen")
                    if k.count(): k.first.click(); pg.wait_for_timeout(200)
                    name = f"{s} {tag}"
                    if BILDER: pg.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{(s.strip('/') or 'hub').replace('/', '-')}-{tag}.png", full_page=True)
                    pruefen(pg, name)
                    for x in f: B.append(f"KONSOLE {name}: {x[:200]}")
                ctx.close()
        b.close()
    print("\n".join(B) or "keine Befunde")
