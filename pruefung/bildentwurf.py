"""Aufgabe 2, Entwürfe: eigenes Bild an drei Stellen, per eingespritztem CSS. PREFIX=b2 python3 bildentwurf.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, mock, BASIS
PREFIX = os.environ.get("PREFIX", "b2")
OUT = "/home/claude/pruefung/bilder"

GEMEINSAM = """
:root { --bild-schleier-nacht: rgb(8 9 11 / .55); --bild-schleier-hell: rgb(236 236 233 / .45); }
"""
# V1 Bühnenbild: Bild nur in der ersten Szene des Hubs, läuft nach rechts und unten in die Fläche aus
V1 = """
.szene:first-of-type { background:
  linear-gradient(90deg, transparent 0%, var(--flaeche) 46%),
  linear-gradient(180deg, transparent 40%, var(--flaeche) 62%),
  linear-gradient(var(--schleier), var(--schleier)),
  var(--bild) left top/cover no-repeat !important; border-radius: 8px; }
@media (max-width: 760px) { .szene:first-of-type { background:
  linear-gradient(180deg, transparent 0%, var(--flaeche) 30%),
  linear-gradient(var(--schleier), var(--schleier)), var(--bild) center top/cover no-repeat !important; } }
"""
# V2 Durchscheinen: Bild hinter allem, abgedunkelt; Arbeitsfläche bleibt Fläche mit 90 % Deckkraft
V2 = """
.dashboard { background: linear-gradient(var(--schleier), var(--schleier)), var(--bild) center/cover fixed !important; }
.arbeitsflaeche { background: color-mix(in oklab, var(--flaeche) 90%, transparent) !important; }
.arbeitsflaeche { background: color-mix(in oklab, var(--flaeche) 86%, transparent) !important; }
.rail { background: color-mix(in oklab, var(--grund) 72%, transparent) !important; }
"""
# V3 Rahmen: Bild nur im Grund, Arbeitsfläche deckend und weiter eingerückt
V3 = """
.dashboard { background: var(--bild) center/cover fixed !important; }
.arbeitsflaeche { margin: 20px 20px 20px 4px !important; }
.rail { background: color-mix(in oklab, var(--grund) 72%, transparent) !important; }
@media (max-width: 760px) { .arbeitsflaeche { margin: 10px !important; } }
"""

def einsetzen(pg, css, bild, schleier, kopf=False):
    pg.add_style_tag(content=f":root{{--bild:url('{bild}');--schleier:{schleier};}}" + GEMEINSAM + css)
    if kopf:
        pg.evaluate("""() => { const k = document.querySelector('.kopfleiste'); if (!k) return;
          const d = document.createElement('div'); d.className = 'k-kopfbild'; d.setAttribute('aria-hidden','true'); k.after(d); }""")
    pg.wait_for_timeout(600)

with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt, bild, schleier in (("DUNKEL", "nacht", "/__probe/dunkel.jpg", "rgb(8 9 11 / .35)"),
                                      ("HELL", "hochschule", "/__probe/hell.jpg", "rgb(236 236 233 / .25)")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll"); mock("/__leiste?w=aus")
        for breite in (1440, 390):
            for name, css, kopf in (("v1-buehnenbild", V1, False), ("v2-durchscheinen", V2, False), ("v3-rahmen", V3, False)):
                ctx = kontext(b, breite)
                ctx.route("**/__probe/*", lambda r: r.fulfill(path="/home/claude/proben/" + r.request.url.rsplit("/", 1)[1], content_type="image/jpeg"))
                pg = ctx.new_page()
                pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(2500)
                k = pg.locator("button", has_text="Ablehnen")
                if k.count(): k.first.click(); pg.wait_for_timeout(200)
                einsetzen(pg, css, bild, schleier, kopf)
                pg.screenshot(path=f"{OUT}/{PREFIX}-{name}-{dt}-{breite}.png")
                ctx.close()
    b.close()
print("fertig")
