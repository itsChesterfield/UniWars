"""Seitenleiste „Automatisch“, Personalisierung, Zeitband mit Namen über zwei Zeilen. PREFIX=h1 python3 hub2.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "h")
def bild(pg, n, ziel=None): (ziel or pg).screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{n}.png")
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll"); mock("/__leiste?w=aus")
        for breite in (1440, 1280, 390):
            tag = f"{dt}-{breite}"
            ctx = kontext(b, breite); pg = ctx.new_page(); f = []
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.goto(BASIS + "/notizen", wait_until="load"); pg.wait_for_timeout(1200); banner(pg)
            if breite != 390:
                w = pg.locator(".rail").bounding_box()["width"]
                soll = 216 if breite >= 1440 else 64
                if round(w) != soll: B.append(f"LEISTE {tag}: {w} statt {soll}")
                bild(pg, f"leiste-{tag}")
                if breite == 1280:
                    pg.locator(".rail").hover(); pg.wait_for_timeout(300)
                    if round(pg.locator(".rail").bounding_box()["width"]) != 216: B.append(f"LEISTE {tag}: klappt beim Drüberfahren nicht aus")
                    pg.mouse.move(900, 500)
                pruefen(pg, f"leiste {tag}")
            pg.goto(BASIS + "/einstellungen/personalisierung", wait_until="load"); pg.wait_for_timeout(1000)
            z = pg.locator("[aria-label='Seitenleiste']").first
            if z.count():
                z.scroll_into_view_if_needed(); bild(pg, f"pers-{tag}", z.locator("xpath=ancestor::*[contains(@class,'zeile') or contains(@class,'p-zeile')][1]") if False else None)
                pruefen(pg, f"personalisierung {tag}")
            if breite == 1440:
                pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(1200)
                pg.get_by_role("button", name="Diese Woche").first.click(); pg.wait_for_timeout(1200)
                for t in ("Mo", "Do"):
                    pg.locator(".bue-wt", has_text=t).click(); pg.wait_for_timeout(2500)
                    bild(pg, f"band-{t}-{tag}", pg.locator(".bue-band"))
                    for e in pg.locator(".bue-kurz > b").all():
                        if e.evaluate("e => e.scrollHeight > e.clientHeight + 1"): B.append(f"BAND {tag} {t}: Name abgeschnitten: {e.inner_text()}")
            for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
            ctx.close()
    mock("/__theme?w=DUNKEL"); b.close()
print("\n".join(B) or "keine Befunde")
