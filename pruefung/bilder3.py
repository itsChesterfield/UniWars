"""Aufgabe 2, eigene Bilder: Fotos und Prüfungen. PREFIX=eb python3 bilder3.py
Braucht mock.py mit /__bilder und /__bildspalte."""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "eb")
OUT = "/home/claude/pruefung/bilder"
STUDIO = os.environ.get("STUDIO", "0") == "1"

def bild(pg, n, ganz=False): pg.screenshot(path=f"{OUT}/{PREFIX}-{n}.png", full_page=ganz)
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
def oeffnen(ctx, pfad, f):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: f.append(str(e)))
    pg.goto(BASIS + pfad, wait_until="load"); pg.wait_for_timeout(2600); banner(pg)
    return pg

def bild_geladen(pg, sel, prop):
    """Prüft, dass das Hintergrundbild wirklich geladen ist (nicht nur gesetzt)."""
    return pg.evaluate("""([sel, prop]) => { const e = document.querySelector(sel); if (!e) return 'fehlt';
      const bg = getComputedStyle(e, prop || null).backgroundImage; return bg.includes('url(') ? 'ok' : bg; }""", [sel, prop])

with sync_playwright() as p:
    b = p.chromium.launch()
    mock("/__modus?w=voll"); mock("/__klausur?w=aus"); mock("/__bildspalte?w=an")
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}")
        for g in ("kopf", "gross", "seite"):
            mock(f"/__bilder?w=an&g={g}")
            for breite in ((1440, 390) if g == "kopf" else (1440,)):
                mock("/__leiste?w=offen" if breite == 1440 else "/__leiste?w=aus")
                tag = f"{g}-{dt}-{breite}"
                ctx = kontext(b, breite); f = []
                for pfad, name in (("/", "hub"), ("/karteikarten", "karteikarten"), ("/aufgaben", "aufgaben")):
                    if g != "kopf" and name == "hub": continue
                    pg = oeffnen(ctx, pfad, f)
                    if breite == 1440 and bild_geladen(pg, ".rail", "") != "ok": B.append(f"LEISTE {name} {tag}: kein Bild")
                    if name != "hub" and bild_geladen(pg, ".dashboard-main", "::before") != "ok": B.append(f"BEREICH {name} {tag}: kein Bild")
                    if name == "hub" and bild_geladen(pg, ".buehne .szene", "") != "ok": B.append(f"HUB {tag}: kein Bild")
                    bild(pg, f"{name}-{tag}")
                    pruefen(pg, f"{name} {tag}")
                    pg.close()
                # Editor ohne Bereichskopf: Leiste ohne Bild (beim Lernen ausblenden)
                if g == "kopf" and breite == 1440:
                    pg = oeffnen(ctx, "/textverarbeitung/dk1", f)
                    if bild_geladen(pg, ".rail", "") == "ok" and pg.locator(".bk").count() == 0: B.append(f"LERNEN {tag}: Leiste zeigt Bild im Editor")
                    bild(pg, f"editor-{tag}"); pg.close()
                if STUDIO and g == "kopf" and breite == 1440:
                    pg = oeffnen(ctx, "/karteikarten", f)
                    pg.keyboard.press("Control+j"); pg.wait_for_timeout(1500)
                    if bild_geladen(pg, ".studio-panel", "") != "ok": B.append(f"STUDIO {tag}: kein Bild")
                    bild(pg, f"studio-{tag}"); pg.close()
                for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
                ctx.close()

        # Einstellungen: mit Bildern, ganz aufgeklappt
        mock("/__bilder?w=an"); mock("/__leiste?w=aus")
        for breite in (1440, 390):
            ctx = kontext(b, breite); f = []
            pg = oeffnen(ctx, "/einstellungen/personalisierung", f)
            s = pg.locator("section[aria-labelledby='ps-bilder']")
            if not s.count(): B.append(f"EINSTELLUNG {dt} {breite}: Abschnitt fehlt")
            else:
                pg.locator(".eb-einzeln summary").click(); pg.wait_for_timeout(200)
                s.scroll_into_view_if_needed()
                s.screenshot(path=f"{OUT}/{PREFIX}-einstellung-{dt}-{breite}.png")
                pruefen(pg, f"einstellung {dt} {breite}")
            for x in f: B.append(f"KONSOLE einstellung {dt}: {x[:200]}")
            ctx.close()

    # Ohne Migration: Seite lädt, Abschnitt fehlt, Rahmen ohne Bilder
    mock("/__theme?w=DUNKEL"); mock("/__bildspalte?w=aus")
    ctx = kontext(b, 1440); f = []
    pg = oeffnen(ctx, "/einstellungen/personalisierung", f)
    if pg.locator("section[aria-labelledby='ps-bilder']").count(): B.append("OHNE SPALTE: Abschnitt da")
    if not pg.locator("section[aria-labelledby='ps-design']").count(): B.append("OHNE SPALTE: Seite kaputt")
    pg2 = oeffnen(ctx, "/karteikarten", f)
    if pg2.evaluate("() => document.querySelector('.dashboard').hasAttribute('data-bild-leiste')"): B.append("OHNE SPALTE: Bild im Rahmen")
    for x in f: B.append(f"KONSOLE ohne-spalte: {x[:200]}")
    ctx.close(); mock("/__bildspalte?w=an")

    # Ablauf mit echten Klicks: leer, hochladen, Standard, Schleier, Bereich aus, löschen
    mock("/__bilder?w=leer"); mock("/__theme?w=HELL")
    ctx = kontext(b, 1440); f = []
    pg = oeffnen(ctx, "/einstellungen/personalisierung", f)
    bild(pg, "ablauf-0-leer")
    pg.locator(".eb-neu input").set_input_files("/home/claude/proben/hell.jpg")
    pg.wait_for_function("() => document.querySelectorAll('.eb-bild').length === 1", timeout=20000)
    pg.wait_for_timeout(1200)
    if not pg.locator(".eb-marke").count(): B.append("ABLAUF: erstes Bild nicht Standard")
    if pg.evaluate("() => !document.querySelector('.dashboard').hasAttribute('data-bild-leiste')"): B.append("ABLAUF: Leiste nach Hochladen ohne Bild")
    bild(pg, "ablauf-1-hochgeladen")
    pg.locator(".eb-neu input").set_input_files("/home/claude/proben/dunkel.jpg")
    pg.wait_for_function("() => document.querySelectorAll('.eb-bild').length === 2", timeout=20000); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Als Standard nehmen").click(); pg.wait_for_timeout(1500)
    pg.locator("[aria-label='Schleier'] button", has_text="Viel").click(); pg.wait_for_timeout(1200)
    pg.get_by_label("Bild für Studio").select_option("aus"); pg.wait_for_timeout(1500)
    bild(pg, "ablauf-2-eingestellt", True)
    pg.get_by_role("button", name="Löschen").click(); pg.wait_for_timeout(400)
    dlg = pg.locator("dialog[open], [role=alertdialog], [role=dialog]")
    bild(pg, "ablauf-3-rueckfrage")
    dlg.get_by_role("button", name="Löschen").click(); pg.wait_for_timeout(1800)
    n = pg.locator(".eb-bild").count()
    if n != 1: B.append(f"ABLAUF: nach Löschen {n} Bilder")
    bild(pg, "ablauf-4-geloescht")
    # Zu große oder falsche Datei
    open("/tmp/falsch.heic", "wb").write(b"0" * 100)
    pg.locator(".eb-neu input").set_input_files({"name": "foto.heic", "mimeType": "image/heic", "buffer": b"0" * 100})
    pg.wait_for_timeout(500)
    if not pg.get_by_text("HEIC-Fotos kann der Browser nicht lesen", exact=False).count(): B.append("ABLAUF: HEIC ohne Meldung")
    bild(pg, "ablauf-5-heic")
    for x in f: B.append(f"KONSOLE ablauf: {x[:200]}")
    ctx.close()
    mock("/__bilder?w=leer"); mock("/__leiste?w=aus")
    b.close()
print("\n".join(B) or "keine Befunde")
