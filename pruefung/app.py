"""Installierbare App: Installierbarkeit (Chrome), Service Worker, Offline-Hinweis, theme-color. PREFIX=p1 python3 app.py"""
import os
from playwright.sync_api import sync_playwright
from audit import kontext, pruefen, B, mock, BASIS
PREFIX = os.environ.get("PREFIX", "p")
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt, grund in (("DUNKEL", "nacht", "#08090b"), ("HELL", "hochschule", "#ecece9")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll")
        for breite in (1440, 390):
            tag = f"{dt}-{breite}"
            ctx = kontext(b, breite); pg = ctx.new_page()
            pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(1500)
            k = pg.locator("button", has_text="Ablehnen")
            if k.count(): k.first.click()
            farben = pg.evaluate("[...document.querySelectorAll('meta[name=theme-color]')].map(m => m.content)")
            if any(f.lower() != grund for f in farben): B.append(f"THEMEFARBE {tag}: {farben}")
            if pg.evaluate("localStorage.getItem('universe-design')") != dt: B.append(f"SPEICHER {tag}: {pg.evaluate('localStorage.getItem(\"universe-design\")')}")
            if breite == 1440 and dt == "nacht":
                cdp = ctx.new_cdp_session(pg)
                fehler = cdp.send("Page.getInstallabilityErrors")["installabilityErrors"]
                if fehler: B.append(f"INSTALLIERBAR: {fehler}")
                m = cdp.send("Page.getAppManifest")
                if m.get("errors"): B.append(f"MANIFEST: {m['errors']}")
            ok = pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
            if not ok: B.append(f"SW {tag}: nicht aktiv")
            pg.wait_for_timeout(500)
            ctx.set_offline(True)
            pg.goto(BASIS + "/notizen", wait_until="load"); pg.wait_for_timeout(500)
            if "Keine Verbindung" not in pg.content(): B.append(f"OFFLINE {tag}: kein Hinweis")
            else:
                pruefen(pg, f"offline {tag}")
                pg.screenshot(path=f"/home/claude/pruefung/bilder/{PREFIX}-offline-{tag}.png")
                pg.locator("button", has_text="Erneut versuchen").click(); pg.wait_for_timeout(800)
                if "Keine Verbindung" not in pg.content(): B.append(f"OFFLINE {tag}: Erneut versuchen ohne Netz verliert den Hinweis")
            ctx.set_offline(False); pg.wait_for_timeout(2500)
            if "Keine Verbindung" in pg.content(): B.append(f"OFFLINE {tag}: lädt nicht neu, wenn das Netz zurück ist")
            ctx.close()
    mock("/__theme?w=DUNKEL"); b.close()
print("\n".join(B) or "keine Befunde")
