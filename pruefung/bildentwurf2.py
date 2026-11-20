"""Aufgabe 2, Runde 2: Bild in der Symbolleiste, im Studio und als Seitenhintergrund. python3 bildentwurf2.py"""
from playwright.sync_api import sync_playwright
from audit import kontext, mock, BASIS
OUT = "/home/claude/pruefung/bilder"

LEISTE = """
.rail { background: linear-gradient(var(--schleier-stark), var(--schleier-stark)), var(--bild-weich) center/cover !important; }
"""
STUDIO = """
.studio-panel { background: linear-gradient(var(--schleier-stark), var(--schleier-stark)), var(--bild) center/cover !important; }
"""
SEITE = """
.bk { position: relative; isolation: isolate; }
.bk::before { content: ""; position: absolute; inset: -32px -40px -24px; z-index: -1; border-radius: 8px;
  background: linear-gradient(180deg, transparent 0%, var(--flaeche) 100%),
              linear-gradient(var(--schleier), var(--schleier)), var(--bild) center/cover; }
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt, bild, s, stark in (("DUNKEL", "nacht", "dunkel.jpg", "rgb(8 9 11 / .35)", "rgb(8 9 11 / .62)"),
                                       ("HELL", "hochschule", "hell.jpg", "rgb(236 236 233 / .25)", "rgb(247 247 245 / .72)")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll"); mock("/__leiste?w=offen")
        for pfad, name in (("/karteikarten", "karteikarten"), ("/notizen", "notizen")):
            ctx = kontext(b, 1440)
            ctx.route("**/__probe/*", lambda r: r.fulfill(path="/home/claude/proben/" + r.request.url.rsplit("/", 1)[1], content_type="image/jpeg"))
            pg = ctx.new_page(); pg.goto(BASIS + pfad, wait_until="load"); pg.wait_for_timeout(2500)
            k = pg.locator("button", has_text="Ablehnen")
            if k.count(): k.first.click(); pg.wait_for_timeout(200)
            if name == "notizen":
                pg.keyboard.press("Control+j"); pg.wait_for_timeout(1500)
            pg.add_style_tag(content=f":root{{--bild:url('/__probe/{bild}');--bild-weich:url('/__probe/{bild.replace(".jpg","-weich.jpg")}');--schleier:{s};--schleier-stark:{stark};}}" + LEISTE + STUDIO + SEITE)
            pg.wait_for_timeout(700)
            pg.screenshot(path=f"{OUT}/b2r-{name}-{dt}.png")
            ctx.close()
    b.close()
print("fertig")
