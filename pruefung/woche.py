import os
from playwright.sync_api import sync_playwright
from audit import kontext, mock, BASIS
PREFIX = os.environ.get("PREFIX", "vor")
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, dt in (("DUNKEL", "nacht"), ("HELL", "hochschule")):
        mock(f"/__theme?w={theme}"); mock("/__modus?w=voll")
        for breite in (1440, 390):
            ctx = kontext(b, breite); pg = ctx.new_page()
            pg.goto(BASIS + "/", wait_until="load"); pg.wait_for_timeout(1200)
            k = pg.locator("button", has_text="Ablehnen")
            if k.count(): k.first.click(); pg.wait_for_timeout(200)
            z = pg.get_by_text("Diese Woche", exact=True).first
            z.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            if breite == 1440:
                pg.get_by_role("button", name="Diese Woche").first.click() if pg.get_by_role("button", name="Diese Woche").count() else None
                pg.wait_for_timeout(3500)
            pg.screenshot(path=f"bilder/{PREFIX}-woche-{dt}-{breite}.png")
            ctx.close()
    mock("/__theme?w=DUNKEL"); b.close()
