"""Klausurphase: Vorschlag im Kapitel Heute, Kapitel Klausuren, starten und beenden. PREFIX=k1 python3 klausur.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "k")
def bild(pg, n): pg.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{n}.png")
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll"); mock("/__leiste?w=aus")
        for breite in (1440, 390):
            tag = f"{dt}-{breite}"
            mock("/__klausur?w=aus")
            ctx = kontext(b, breite); pg = ctx.new_page(); f = []
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(2500); banner(pg)
            v = pg.locator(".kp-vorschlag")
            if not v.count(): B.append(f"VORSCHLAG {tag}: fehlt")
            bild(pg, f"vorschlag-{tag}"); pruefen(pg, f"vorschlag {tag}")
            mock("/__klausur?w=an")
            pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(3000)
            if not pg.locator("section[aria-label='Klausuren']").count(): B.append(f"KAPITEL {tag}: fehlt")
            if pg.locator(".kp-vorschlag").count(): B.append(f"VORSCHLAG {tag}: steht noch da")
            bild(pg, f"kapitel-{tag}"); pruefen(pg, f"kapitel {tag}")
            if breite == 390: pg.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-kapitel-voll-{tag}.png", full_page=True)
            # Höhe: passt die Szene in den Bildschirm?
            if breite == 1440:
                h = pg.evaluate("() => { const s = document.querySelector(\"section[aria-label='Klausuren']\"); return [s.scrollHeight, s.clientHeight]; }")
                if h[0] > h[1] + 2: B.append(f"HÖHE {tag}: {h}")
            for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
            ctx.close()
    # Ablauf mit echtem Klick: starten, beenden
    mock("/__theme?w=DUNKEL"); mock("/__klausur?w=aus")
    ctx = kontext(b, 1440); pg = ctx.new_page(); pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(2500); banner(pg)
    pg.get_by_role("button", name="Klausurphase starten").click(); pg.wait_for_timeout(2500)
    if not pg.locator("section[aria-label='Klausuren']").count(): B.append("ABLAUF: Starten zeigt kein Kapitel")
    bild(pg, "ablauf-gestartet")
    pg.get_by_role("button", name="Klausurphase beenden").click(); pg.wait_for_timeout(2000)
    if pg.locator("section[aria-label='Klausuren']").count(): B.append("ABLAUF: Beenden lässt Kapitel stehen")
    if pg.locator(".kp-vorschlag").count(): B.append("ABLAUF: nach Beenden kommt der Vorschlag wieder")
    bild(pg, "ablauf-beendet")
    ctx.close(); mock("/__klausur?w=aus"); b.close()
print("\n".join(B) or "keine Befunde")
