"""Abläufe Kleinkram nach Welle 8: Teilen-Fokus, Unterpunkt-Menü, leerer Nächster Termin, Literatur-Formular, Hub.
PREFIX=vor python3 klein.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "nach")
NUR = os.environ.get("NUR", "")
def bild(pg, n, ziel=None, voll=False):
    (ziel or pg).screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{n}.png", **({"full_page": True} if voll and not ziel else {}))
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}")
        for breite in (1440, 390):
            tag = f"{dt}-{breite}"
            if NUR and NUR not in tag: continue
            mock("/__modus?w=voll")
            ctx = kontext(b, breite); pg = ctx.new_page(); f = []
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.on("dialog", lambda d: d.dismiss())
            # Hub
            pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(1200); banner(pg)
            bild(pg, f"hub-{tag}", voll=True)
            # Aufgaben: Teilen aus dem Menü, Fokus zurück
            pg.goto(BASIS + "/aufgaben", wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
            m = pg.locator(".entry-row .entry-actions .drei-punkte > button").first
            m.click(); pg.wait_for_timeout(250)
            pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="Teilen").click(); pg.wait_for_timeout(300)
            if pg.locator(".deadline-teilen-fertig").count():
                pg.locator(".deadline-teilen-fertig").click(); pg.wait_for_timeout(200)
                if pg.evaluate("document.activeElement?.getAttribute('aria-haspopup')") != "menu": B.append(f"TEILEN {tag}: Fokus nach Fertig nicht am Menüknopf ({pg.evaluate('document.activeElement?.tagName')})")
                m.click(); pg.wait_for_timeout(250)
                pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="Teilen").click(); pg.wait_for_timeout(300)
                pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
                if pg.evaluate("document.activeElement?.getAttribute('aria-haspopup')") != "menu": B.append(f"TEILEN {tag}: Fokus nach Escape nicht am Menüknopf")
            else: B.append(f"TEILEN {tag}: kein Fertig")
            # To-Do-Unterpunkte
            u = pg.locator(".unteraufgabe-row", has_text="Zusammenfassung Diagnostik")
            if not u.count(): B.append(f"UNTERPUNKT {tag}: fehlt")
            else:
                u.first.scroll_into_view_if_needed(); bild(pg, f"unterpunkt-{tag}", u.first)
                if u.first.locator(".unteraufgabe-weg").count(): B.append(f"UNTERPUNKT {tag}: Kreuz noch da")
                k = u.first.locator(".drei-punkte > button")
                if k.count():
                    k.click(); pg.wait_for_timeout(250)
                    items = [x.strip() for x in pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]").all_inner_texts()]
                    if items != ["Löschen"]: B.append(f"UNTERPUNKT {tag}: Menü {items}")
                    pruefen(pg, f"unterpunkt-menue {tag}"); bild(pg, f"unterpunkt-menue-{tag}")
                    pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="Löschen").click(); pg.wait_for_timeout(300)
                    if pg.locator(".unteraufgabe-row", has_text="Zusammenfassung Diagnostik").count(): B.append(f"UNTERPUNKT {tag}: nicht gelöscht")
            # Literatur: Formular
            pg.goto(BASIS + "/literaturverwaltung", wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
            pg.locator(".lit-tabelle .dat-name-knopf").first.click(); pg.wait_for_timeout(400)
            d = pg.locator("dialog[open]")
            if d.count(): pruefen(pg, f"literatur-form {tag}"); bild(pg, f"literatur-form-{tag}", d.first)
            else: B.append(f"LITERATUR {tag}: kein Formular")
            ctx.close()
            # Termine leer
            mock("/__modus?w=leer")
            ctx = kontext(b, breite); pg = ctx.new_page()
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.goto(BASIS + "/termine", wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
            pruefen(pg, f"termine-leer {tag}"); bild(pg, f"termine-leer-{tag}", voll=True)
            k = pg.locator(".naechster-termin-leer .knopf")
            if k.count():
                k.click(); pg.wait_for_timeout(350)
                if not pg.locator("form.erfassen[role=dialog]").count(): B.append(f"TERMIN {tag}: Knopf öffnet Erfassen nicht")
                else: bild(pg, f"termine-leer-erfassen-{tag}")
            for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
            ctx.close()
    mock("/__modus?w=voll"); mock("/__theme?w=DUNKEL")
    b.close()
print("\n".join(B) or "keine Befunde")
