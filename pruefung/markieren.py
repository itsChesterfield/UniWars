"""Aufgabe 4: Vorschläge direkt in die Seiten einzeichnen. python3 markieren.py → bilder/m4-*.png"""
from playwright.sync_api import sync_playwright
from audit import kontext, mock, BASIS
OUT = "/home/claude/pruefung/bilder"

HELFER = r"""
window.__m = (els, label) => {
  els = [...els].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  els.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${r.left + scrollX - 3}px;top:${r.top + scrollY - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;
      border:2px solid #ff4d7a;border-radius:6px;background:rgb(255 77 122 / .12);z-index:99999;pointer-events:none`;
    document.body.appendChild(d);
    if (i === 0) {
      const t = document.createElement('div');
      t.textContent = label;
      t.style.cssText = `position:absolute;left:${r.left + scrollX - 3}px;top:${r.top + scrollY - 24}px;background:#ff4d7a;color:#fff;
        font:600 12px/1 system-ui;padding:4px 6px;border-radius:4px;z-index:100000;white-space:nowrap`;
      document.body.appendChild(t);
    }
  });
};
window.__t = (txt, sel = 'a,button,span,p,div,h2,h3,b') => [...document.querySelectorAll(sel)]
  .filter(e => e.textContent.trim() === txt && ![...e.children].some(c => c.textContent.trim() === txt));
window.__tb = (txt, sel = 'p,div,span') => [...document.querySelectorAll(sel)]
  .filter(e => e.textContent.trim().startsWith(txt) && ![...e.children].some(c => c.textContent.trim().startsWith(txt)));
window.__q = (s) => document.querySelectorAll(s);
"""

# Seite, ganze Seite?, Markierungen (JS-Ausdruck, Beschriftung)
SEITEN = [
  ("aufgaben", "/aufgaben", True, [
    ("[...__t('Unteraufgabe'), ...__t('Unterpunkte')].map(e => e.closest('button,a') || e)", "B1 Unteraufgabe/Unterpunkte ins ⋯-Menü"),
    ("__tb('Schnell erfassen', 'button').slice(0,1)", "A4 Knopf passend zur Seite: „Aufgabe“"),
    ("[document.querySelector('.bk-name')]", "A1 Name doppelt zur Kopfleiste"),
  ]),
  ("noten", "/noten", True, [
    ("[...__q('.bk-unter')]", "A2 Erklärsatz"),
    ("__tb('Notenschnitt aus').map(e => e.closest('section,div').parentElement)", "B2 Schnitt steht doppelt"),
    ("[...__t('Bearbeiten','button'), ...__t('Löschen','button')]", "B2 ins ⋯-Menü"),
    ("__t('Rechner','h2,h3').map(e => e.nextElementSibling)", "B2 Karte → Trennlinien, zugeklappt"),
  ]),
  ("karteikarten", "/karteikarten", True, [
    ("__t('Jetzt lernen','h2,h3,div,span').map(e => e.closest('section') || e)", "B3 doppelt zu „Stapel“: eine Liste"),
    ("[...__q('button.gefahr')]", "B3 Mülleimer ins ⋯-Menü"),
    ("[document.querySelector('.bk-name')]", "A1"),
  ]),
  ("transkription", "/transkription", True, [
    ("__tb('Die Aufnahme landet', 'p,div,span')", "B4 Hinweis steht oben schon"),
    ("[...__q('button.gefahr')]", "B4 Mülleimer ins ⋯-Menü"),
    ("[document.querySelector('.bk-name')]", "A1"),
    ("[...__q('.bk-unter')]", "A2 Erklärsatz"),
  ]),
  ("faecher", "/faecher", False, [
    ("[...__t('Bearbeiten','button'), ...__t('Archivieren','button')]", "B5 ins ⋯-Menü"),
    ("__t('Fach hinzufügen','button')", "B5 einer der beiden Knöpfe reicht"),
    ("[document.querySelector('.bk-zahl-block')]", "A1 Zahl ohne Aussage"),
  ]),
  ("lernraum", "/lernraum", False, [
    ("__t('Öffnen','a,span,button').map(e=>e.closest('a,button'))", "B6 ganze Zeile klickbar"),
    ("[...__q('.bk-unter')]", "A2 Erklärsatz"),
    ("[document.querySelector('.bk-zahl-block')]", "A1 Zahl ohne Aussage"),
  ]),
  ("notizen", "/notizen", False, [
    ("[...__t('Öffnen','a,span,button').map(e=>e.closest('a,button')), ...__t('Aus Vorlage','button,a')]", "B7 in „Neue Notiz“ und Suche"),
    ("[...__q('button[aria-label$=\"anpinnen\"]')]", "B7 Pin nur wenn angeheftet"),
    ("[...__q('.bk-unter')]", "A2 Erklärsatz"),
  ]),
  ("hub", "/", False, [
    ("[document.elementFromPoint(250,104)?.closest('p,div,span')]", "B8 Position dreifach"),
    ("[...__q('.buehne-weiter')]", "B8"),
    ("[document.querySelector('.kopfleiste .heute')]", "A5 Datum steht im Hub groß"),
  ]),
  ("dateiablage", "/dateiablage", False, [
    ("[...__t('Leseliste','button,a'), ...__t('Mit mir geteilt','button,a'), ...__t('Papierkorb','button,a')]", "B9 als Ordner-Einträge"),
  ]),
  ("work-station", "/work-station", False, [
    ("__tb('Zieh den Punkt', 'p,div,span')", "B10 nur beim ersten Mal"),
  ]),
  ("tabellen", "/tabellen", False, [
    ("[document.querySelector('.bk-zahl-block')]", "A1 „1 Tabelle“ sagt nichts"),
    ("[...__q('.bk-unter')]", "A2 Erklärsatz bei jedem Besuch"),
    ("__q('.chip, [role=group] button').length ? [document.querySelector('.chip, [role=group]')?.parentElement] : []", "A3 Fach-Filter bei 1 Eintrag"),
  ]),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    mock("/__theme?w=DUNKEL"); mock("/__modus?w=voll"); mock("/__leiste?w=aus"); mock("/__klausur?w=aus")
    for name, pfad, ganz, marken in SEITEN:
        ctx = kontext(b, 1440); pg = ctx.new_page()
        pg.goto(BASIS + pfad, wait_until="load"); pg.wait_for_timeout(2800)
        k = pg.locator("button", has_text="Ablehnen")
        if k.count(): k.first.click(); pg.wait_for_timeout(200)
        pg.evaluate(HELFER)
        for ausdruck, label in marken:
            n = pg.evaluate(f"() => {{ try {{ const e = ({ausdruck}).filter(Boolean); __m(e, {label!r}); return e.length; }} catch (x) {{ return 'FEHLER ' + x; }} }}")
            print(name, label[:20], n)
        pg.screenshot(path=f"{OUT}/m4-{name}.png", full_page=ganz)
        ctx.close()
    b.close()
