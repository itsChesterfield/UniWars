"""Rückfrage-Dialog: öffnen, Fokus, axe, Escape, Klick daneben, Bestätigen. PREFIX=r1 python3 rueck.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "r")
def banner(pg):
    k = pg.locator("button", has_text="Ablehnen")
    if k.count(): k.first.click(); pg.wait_for_timeout(200)
def aktiv(pg): return pg.evaluate("(document.activeElement?.className || '') + ' ' + (document.activeElement?.textContent || '').trim().slice(0, 20)")

# (Seite, Knopf, der die Rückfrage auslöst (Locator-Funktion), Menüpunkt oder None, Zeilen-Locator zum Zählen)
# Letzter Wert: True, wenn die Zeile nach dem Bestätigen weg sein muss (Papierkorb-Fälle lädt der Ersatz-Server neu)
FAELLE = [
    ("/aufgaben", lambda pg: pg.locator("section[aria-labelledby=abschnitt-deadlines] .entry-row .entry-actions .drei-punkte > button").first, "Löschen", "section[aria-labelledby=abschnitt-deadlines] .entry-row", True),
    ("/aufgaben", lambda pg: pg.locator("section[aria-labelledby=abschnitt-todos] .entry-row .entry-actions .drei-punkte > button").first, "Löschen", "section[aria-labelledby=abschnitt-todos] .entry-row", True),
    ("/aufgaben", lambda pg: pg.locator("section[aria-labelledby=abschnitt-pruefungen] .entry-row .entry-actions .drei-punkte > button").first, "Löschen", "section[aria-labelledby=abschnitt-pruefungen] .entry-row", True),
    ("/literaturverwaltung", lambda pg: pg.locator(".lit-tabelle .drei-punkte > button.nur-symbol").first, "In den Papierkorb", ".lit-tabelle tbody tr", False),
    ("/textverarbeitung", lambda pg: pg.locator(".objekt-liste .drei-punkte > button").first, "In den Papierkorb", ".objekt-liste .entry-row", False),
    ("/karteikarten", lambda pg: pg.locator("section[aria-labelledby=kk-stapel] .drei-punkte > button").first, "In den Papierkorb", "section[aria-labelledby=kk-stapel] .entry-row", False),
    ("/transkription", lambda pg: pg.locator("li:has(> .tra-eintrag) .drei-punkte > button").first, "In den Papierkorb", "li:has(> .tra-eintrag)", False),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll")
        for breite in (1440, 390):
            tag = f"{dt}-{breite}"
            ctx = kontext(b, breite); pg = ctx.new_page(); f = []
            pg.on("pageerror", lambda e: f.append(str(e)))
            pg.on("dialog", lambda d: (B.append(f"BROWSERDIALOG {tag}: {d.message[:60]}"), d.dismiss()))
            for nr, (seite, knopf, punkt, zeilen, weg) in enumerate(FAELLE):
                name = f"{seite}#{nr} {tag}"
                pg.goto(BASIS + seite, wait_until="load"); pg.wait_for_timeout(1000); banner(pg)
                vorher = pg.locator(zeilen).count()
                if not knopf(pg).count(): B.append(f"RUECKFRAGE {name}: kein Knopf"); continue
                def oeffnen():
                    knopf(pg).click(); pg.wait_for_timeout(250)
                    if punkt: pg.locator("dialog.drei-punkte-menue[open] [role=menuitem]", has_text=punkt).click()
                    pg.wait_for_timeout(300)
                    return pg.locator("dialog.rueckfrage[open]")
                d = oeffnen()
                if not d.count(): B.append(f"RUECKFRAGE {name}: öffnet nicht"); continue
                if "Abbrechen" not in aktiv(pg): B.append(f"RUECKFRAGE {name}: Fokus {aktiv(pg)}")
                pruefen(pg, f"rueckfrage {name}")
                pg.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{seite.strip('/')}{nr}-{tag}.png")
                d.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-{seite.strip('/')}{nr}-dialog-{tag}.png")
                pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
                if pg.locator("dialog.rueckfrage[open]").count(): B.append(f"RUECKFRAGE {name}: Escape schließt nicht")
                if pg.locator(zeilen).count() != vorher: B.append(f"RUECKFRAGE {name}: nach Escape gelöscht")
                if punkt and pg.evaluate("document.activeElement?.getAttribute('aria-haspopup')") != "menu": B.append(f"RUECKFRAGE {name}: Fokus nach Escape {aktiv(pg)}")
                d = oeffnen()
                pg.mouse.click(5, 5); pg.wait_for_timeout(250)
                if pg.locator("dialog.rueckfrage[open]").count(): B.append(f"RUECKFRAGE {name}: Klick daneben schließt nicht")
                d = oeffnen()
                bx = d.bounding_box(); pg.mouse.click(bx["x"] + 8, bx["y"] + 8); pg.wait_for_timeout(200)
                if not pg.locator("dialog.rueckfrage[open]").count(): B.append(f"RUECKFRAGE {name}: Klick auf den Rand schließt")
                d.locator(".knopf.gefahr, .knopf.haupt").click(); pg.wait_for_timeout(500)
                if pg.locator("dialog.rueckfrage[open]").count(): B.append(f"RUECKFRAGE {name}: bleibt nach Bestätigen")
                if weg and pg.locator(zeilen).count() != vorher - 1: B.append(f"RUECKFRAGE {name}: Zeilen {vorher} -> {pg.locator(zeilen).count()}")
            for x in f: B.append(f"KONSOLE {tag}: {x[:200]}")
            ctx.close()
    mock("/__theme?w=DUNKEL"); b.close()
print("\n".join(B) or "keine Befunde")
