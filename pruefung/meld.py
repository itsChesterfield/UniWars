"""Meldung und Eingabefeld: Fehler nach Löschen (Ersatz-Server lehnt den Papierkorb ab), Hinweis nach Kopieren, Umbenennen per Feld.
PREFIX=m1 python3 meld.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "m")
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
def bild(pg, n, ziel=None): (ziel or pg).screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{n}.png")
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll")
        for breite in (1440, 390):
            tag = f"{dt}-{breite}"
            ctx = kontext(b, breite); ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASIS)
            pg = ctx.new_page(); f = []
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.on("dialog", lambda d: (B.append(f"BROWSERDIALOG {tag}: {d.message[:60]}"), d.dismiss()))
            # 1 Fehler: Papierkorb schlägt im Ersatz-Server fehl
            pg.goto(BASIS + "/textverarbeitung", wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
            pg.locator(".objekt-liste .drei-punkte > button").first.click(); pg.wait_for_timeout(250)
            items = [x.strip() for x in pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]").all_inner_texts()]
            if "In den Papierkorb" not in items: B.append(f"MENUE {tag}: {items}")
            pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="In den Papierkorb").click(); pg.wait_for_timeout(300)
            pg.locator("dialog.rueckfrage[open] .knopf.gefahr").click(); pg.wait_for_timeout(1500)
            m = pg.locator(".meldung.meldung-fehler")
            if not m.count(): B.append(f"MELDUNG {tag}: kein Fehler sichtbar")
            else:
                if "nicht geklappt" not in (pg.locator("[role=alert].vh").inner_text() or ""): B.append(f"MELDUNG {tag}: Live-Region leer")
                pruefen(pg, f"meldung-fehler {tag}"); bild(pg, f"fehler-{tag}"); bild(pg, f"fehler-nah-{tag}", m)
                e = m.locator(".knopf", has_text="Erneut versuchen")
                if not e.count(): B.append(f"ERNEUT {tag}: kein Knopf")
                else:
                    e.click(); pg.wait_for_timeout(1500)
                    if pg.locator("dialog.rueckfrage[open]").count(): B.append(f"ERNEUT {tag}: fragt erneut nach")
                    m = pg.locator(".meldung.meldung-fehler")
                    if not m.count(): B.append(f"ERNEUT {tag}: kein neuer Fehler")
                    elif m.locator(".knopf[aria-busy=true]").count(): B.append(f"ERNEUT {tag}: Knopf bleibt im Laden")
                    pruefen(pg, f"erneut {tag}")
                m.hover(); pg.wait_for_timeout(10500)
                if not m.count(): B.append(f"MELDUNG {tag}: verschwindet trotz Maus darauf")
                m.locator("button[aria-label='Meldung schließen']").click(); pg.wait_for_timeout(200)
                if pg.locator(".meldung").count(): B.append(f"MELDUNG {tag}: Schließen geht nicht")
            # 2 Hinweis: Kopieren in der Literatur
            pg.goto(BASIS + "/literaturverwaltung", wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
            pg.locator(".lit-aktionen .drei-punkte > button", has_text="Zitieren").first.click(); pg.wait_for_timeout(250)
            pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="Im Text").click(); pg.wait_for_timeout(500)
            h = pg.locator(".meldung")
            if not h.count(): B.append(f"KOPIEREN {tag}: keine Meldung")
            else:
                bild(pg, f"hinweis-nah-{tag}", h)
                if "Kopiert" not in h.inner_text(): B.append(f"KOPIEREN {tag}: {h.inner_text()}")
                pg.mouse.move(1, 1); pg.wait_for_timeout(4600)
                if pg.locator(".meldung").count(): B.append(f"KOPIEREN {tag}: Hinweis bleibt stehen")
            # 3 Eingabe: Whiteboard umbenennen
            pg.goto(BASIS + "/whiteboard/wb1", wait_until="load"); pg.wait_for_timeout(1500); banner(pg)
            k = pg.locator(".drei-punkte > button").last
            k.click(); pg.wait_for_timeout(250)
            pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text="Umbenennen").click(); pg.wait_for_timeout(300)
            d = pg.locator("dialog.rueckfrage[open]")
            if not d.count(): B.append(f"EINGABE {tag}: öffnet nicht")
            else:
                if pg.evaluate("document.activeElement?.tagName") != "INPUT": B.append(f"EINGABE {tag}: Fokus nicht im Feld")
                pruefen(pg, f"eingabe {tag}"); bild(pg, f"eingabe-{tag}", d)
                pg.keyboard.press("Control+a"); pg.keyboard.press("Backspace"); pg.wait_for_timeout(100)
                if not d.locator("button[type=submit]").is_disabled(): B.append(f"EINGABE {tag}: leer nicht gesperrt")
                pg.keyboard.type("Lernplan neu"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
                if pg.locator("dialog.rueckfrage[open]").count(): B.append(f"EINGABE {tag}: Enter schließt nicht")
                if "Lernplan neu" not in pg.locator(".dashboard-main").inner_text(): B.append(f"EINGABE {tag}: Name nicht übernommen")
            for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
            ctx.close()
    mock("/__theme?w=DUNKEL"); b.close()
print("\n".join(B) or "keine Befunde")
