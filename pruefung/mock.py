"""Ersatz-Server für Supabase (Auth + PostgREST) zur lokalen Prüfung. Liegt nur in der Sandbox.
Schalter: /__modus?w=voll|leer|kaputt, /__theme?w=HELL|DUNKEL|SYSTEM, /__langsam?ms=1500, /__einmal401?t=<tabelle>, /__leiste?w=offen|hover|zu|aus"""
import json, time, re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

UID = "00000000-0000-4000-8000-000000000001"
USER = {"id": UID, "aud": "authenticated", "role": "authenticated", "email": "didi@example.org",
        "app_metadata": {"provider": "email"}, "user_metadata": {"name": "Didi"},
        "created_at": "2026-10-01T10:00:00Z", "email_confirmed_at": "2026-10-01T10:00:00Z"}
Z = {"modus": "voll", "theme": "DUNKEL", "ms": 0, "e401": set()}
WS = {}

def settings():
    return {"user_id": UID, "theme": Z["theme"], "username": "didi", "avatar_pfad": None, "darstellung": {**({"leiste": Z["leiste"]} if Z.get("leiste") else {}), **({"klausurphase": Z["klausur"]} if Z.get("klausur") else {})},
            "symbolleiste": None, "hub_layout": None, "hochschule_frei": None, "hochschule_id": None,
            "mensa_id": None, "mensa_name": None, "ki_audio_einwilligung": None, "ki_einwilligung": None,
            "ki_gedaechtnis_an": False, "ki_kennenlernen": {}, "ki_profil": {}, "streak_count": 3,
            "streak_freezes": 0, "streak_last_active": time.strftime("%Y-%m-%d"), "work_station": WS}

def karte(i, stapel, v, r, faellig, intervall=1, wdh=0, fehler=0):
    return {"id": f"kk{i}", "user_id": UID, "stapel_id": stapel, "vorderseite": v, "rueckseite": r, "box": 1, "fehler": fehler,
            "intervall_tage": intervall, "leichtigkeit": 2.5, "wiederholungen": wdh, "ki_erzeugt": i == 2, "quelle_notiz_id": None,
            "naechste_abfrage": "2026-11-10T08:00:00Z" if faellig else "2026-12-30T08:00:00Z",
            "zuletzt_gelernt": None if wdh == 0 else "2026-11-09T08:00:00Z", "erstellt_am": f"2026-11-0{i % 9 + 1}T10:00:00Z", "geaendert_am": "2026-11-10T10:00:00Z"}

FRAGEN = [
    {"id": "qf1", "typ": "mc", "frage": "Welches Gütekriterium beschreibt die Messgenauigkeit eines Tests?", "optionen": ["Objektivität", "Reliabilität", "Validität", "Normierung"], "richtig": 1, "erklaerung": "Reliabilität ist die Zuverlässigkeit der Messung.", "beleg": "Q1 S. 4", "thema": "Reliabilität"},
    {"id": "qf2", "typ": "wf", "frage": "Ein valider Test ist immer auch reliabel.", "richtig": True, "erklaerung": "Ohne Reliabilität keine Validität.", "beleg": "Q1", "thema": "Validität"},
]

def notiz(i, titel, fach, inhalt, pin=False, datum="2026-11-04"):
    return {"id": f"no{i}", "user_id": UID, "titel": titel, "fach_id": fach, "inhalt": inhalt, "angepinnt": pin, "datei_id": None, "ki_erzeugt": False,
            "quelle_transkript_id": None, "stundenplan_eintrag_id": None, "vorlesung_datum": None, "erstellt_am": f"{datum}T10:00:00Z", "geaendert_am": f"{datum}T10:00:00Z"}

DOK = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Angststörungen gehören zu den häufigsten Störungen."}]}]}

def folie(i, layout, titel, text="", text2=""):
    return {"id": f"fo{i}", "layout": layout, "titel": titel, "text": text, "text2": text2, "bild": None}

P2 = "00000000-0000-4000-8000-000000000002"
P3 = "00000000-0000-4000-8000-000000000003"

def daten(tabelle):
    if Z["modus"] == "leer":
        return [settings()] if tabelle == "settings" else []
    heute = time.strftime("%Y-%m-%d")
    morgen = time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400))
    D = {
        "settings": [settings()],
        "fach": [{"id": "f1", "user_id": UID, "name": "Klinische Psychologie", "farbe": "#7FBFB6", "aktiv": True, "ects": 6, "semester": "1", "erstellt_am": "2026-10-01T10:00:00Z", "anwesenheitspflicht": True, "max_fehltage": 3, "fehltage_genutzt": 2},
                 {"id": "f2", "user_id": UID, "name": "Methodenlehre", "farbe": "#CFAE7A", "aktiv": True, "ects": 5, "semester": "1", "erstellt_am": "2026-10-02T10:00:00Z", "anwesenheitspflicht": False, "max_fehltage": None, "fehltage_genutzt": 0},
                 {"id": "f3", "user_id": UID, "name": "Entwicklungspsychologie des Kindes- und Jugendalters", "farbe": "#8EA3C9", "aktiv": True, "ects": None, "semester": None, "erstellt_am": "2026-10-03T10:00:00Z", "anwesenheitspflicht": True, "max_fehltage": None, "fehltage_genutzt": 1}],
        "todo": [{"id": "t1", "user_id": UID, "titel": "Kapitel 3 lesen", "erledigt": False, "parent_id": None, "fach_id": "f1", "faellig_am": None, "erstellt_am": "2026-11-10T10:00:00Z", "zugewiesen_an": None, "prioritaet": "HOCH"},
                 {"id": "t2", "user_id": UID, "titel": "Zusammenfassung Diagnostik", "erledigt": False, "parent_id": "t1", "fach_id": "f1", "faellig_am": None, "erstellt_am": "2026-11-11T10:00:00Z", "zugewiesen_an": None, "prioritaet": "MITTEL"},
                 {"id": "t3", "user_id": UID, "titel": "Literaturliste ordnen mit einem sehr langen Titel, der am Handy umbrechen muss", "erledigt": True, "parent_id": None, "fach_id": None, "faellig_am": None, "erstellt_am": "2026-11-09T10:00:00Z", "zugewiesen_an": None, "prioritaet": "NIEDRIG"}],
        "deadline": [{"id": "d1", "user_id": UID, "titel": "Hausarbeit abgeben", "faellig_am": f"{heute}T22:59:00Z", "erledigt": False, "fach_id": "f2", "erstellt_am": "2026-11-01T10:00:00Z", "zugewiesen_an": None, "beschreibung": None, "typ": "ABGABE", "kategorie": "NORMAL", "todo_id": None, "pruefung_id": None, "parent_deadline_id": None},
                     {"id": "d2", "user_id": UID, "titel": "Rückmeldung Semesterbeitrag", "faellig_am": "2026-12-20T22:59:00Z", "erledigt": False, "fach_id": None, "erstellt_am": "2026-11-01T10:00:00Z", "zugewiesen_an": None, "beschreibung": None, "typ": "FRIST", "kategorie": "SEMESTERBEITRAG", "todo_id": None, "pruefung_id": None, "parent_deadline_id": None},
                     {"id": "d3", "user_id": UID, "titel": "Gliederung schicken", "faellig_am": "2026-11-25T10:00:00Z", "erledigt": False, "fach_id": None, "erstellt_am": "2026-11-01T10:00:00Z", "zugewiesen_an": None, "beschreibung": None, "typ": "ABGABE", "kategorie": "NORMAL", "todo_id": "t1", "pruefung_id": None, "parent_deadline_id": None},
                     {"id": "d5", "user_id": UID, "titel": "Laborbericht hochladen", "faellig_am": "2026-11-18T10:00:00Z", "erledigt": False, "fach_id": "f2", "erstellt_am": "2026-11-01T10:00:00Z", "zugewiesen_an": None, "beschreibung": None, "typ": "ABGABE", "kategorie": "NORMAL", "todo_id": None, "pruefung_id": None, "parent_deadline_id": None},
                     {"id": "d4", "user_id": UID, "titel": "Exposé zur Bachelorarbeit mit Literaturliste und Zeitplan einreichen", "faellig_am": f"{morgen}T08:00:00Z", "erledigt": False, "fach_id": "f1", "erstellt_am": "2026-11-01T10:00:00Z", "zugewiesen_an": None, "beschreibung": None, "typ": "ABGABE", "kategorie": "NORMAL", "todo_id": None, "pruefung_id": None, "parent_deadline_id": None}],
        "note": [{"id": "n1", "user_id": UID, "titel": "Statistik I, Klausur", "fach_id": "f2", "wert": 1.7, "gewicht": 6, "datum": "2026-11-05", "bestanden": True},
                 {"id": "n2", "user_id": UID, "titel": "Psychopathologie, Hausarbeit mit einem langen Titel zum Umbrechen", "fach_id": "f1", "wert": 2.3, "gewicht": 4, "datum": "2026-10-28", "bestanden": True},
                 {"id": "n4", "user_id": UID, "titel": "Klausur Diagnostik", "fach_id": "f1", "wert": None, "gewicht": 6, "datum": "2026-12-15", "bestanden": None}],
        "lern_session": [{"id": "l1", "user_id": UID, "fach_id": "f1", "dauer_minuten": 95, "start": f"{heute}T08:00:00Z"},
                         {"id": "l2", "user_id": UID, "fach_id": "f2", "dauer_minuten": 50, "start": "2026-11-16T15:00:00Z"}],
        "stundenplan_eintrag": [{"id": "s1", "user_id": UID, "fach_id": "f1", "tag": "MO", "start_zeit": "08:15:00", "end_zeit": "09:45:00", "raum": "HS 1", "dozent": "Dr. Weber"},
                                {"id": "s2", "user_id": UID, "fach_id": "f2", "tag": "DI", "start_zeit": "10:00:00", "end_zeit": "11:30:00", "raum": "S 204", "dozent": None},
                                {"id": "s3", "user_id": UID, "fach_id": "f3", "tag": "DO", "start_zeit": "14:00:00", "end_zeit": "15:30:00", "raum": None, "dozent": "Prof. Lang"},
                                {"id": "s4", "user_id": UID, "fach_id": "f1", "tag": "FR", "start_zeit": "12:00:00", "end_zeit": "13:30:00", "raum": "HS 2", "dozent": None}],
        "datei": [{"id": "da1", "user_id": UID, "name": "Skript Diagnostik Kapitel 3.pdf", "fach_id": None, "groesse": 2400000, "mime_typ": "application/pdf", "speicher_pfad": "x/da1.pdf", "pdf_ordner_id": None, "erstellt_am": "2026-11-12T10:00:00Z", "geaendert_am": "2026-11-12T10:00:00Z"},
                  {"id": "da5", "user_id": UID, "name": "Vorlesung 4, Angststörungen.pdf", "fach_id": "f1", "groesse": 900000, "mime_typ": "application/pdf", "speicher_pfad": "x/da5.pdf", "pdf_ordner_id": None, "erstellt_am": "2026-11-04T10:00:00Z", "geaendert_am": "2026-11-04T10:00:00Z"}],
        "pruefung": [{"id": "p3", "user_id": UID, "titel": "Testat Methodenlehre", "datum": "2026-12-04T09:00:00Z", "fach_id": "f2", "status": "ANSTEHEND", "raum": "S 204", "erstellt_am": "2026-11-01T10:00:00Z"},
                     {"id": "p2", "user_id": UID, "titel": "Nachklausur Statistik", "datum": "2027-02-10T08:00:00Z", "fach_id": "f2", "status": "ANSTEHEND", "raum": None, "erstellt_am": "2026-11-01T10:00:00Z"},
                     {"id": "p1", "user_id": UID, "titel": "Klausur Diagnostik", "datum": "2026-12-15T09:00:00Z", "fach_id": "f1", "status": "ANSTEHEND", "raum": "Hörsaal 1", "erstellt_am": "2026-11-01T10:00:00Z"}],
        "kk_stapel": [{"id": "k1", "user_id": UID, "name": "Testgütekriterien", "fach_id": "f1", "erstellt_am": "2026-11-01T10:00:00Z", "geaendert_am": "2026-11-15T10:00:00Z"},
                      {"id": "k2", "user_id": UID, "name": "Methodenlehre Definitionen", "fach_id": "f2", "erstellt_am": "2026-11-02T10:00:00Z", "geaendert_am": "2026-11-14T10:00:00Z"}],
        "kk_karte": [dict(karte(1, "k1", "Was ist Reliabilität?", "Zuverlässigkeit.", True), stapel={"name": "Testgütekriterien", "fach_id": "f1"}),
                     dict(karte(2, "k1", "Was ist Validität?", "Gültigkeit.", True, 3, 2), stapel={"name": "Testgütekriterien", "fach_id": "f1"}),
                     dict(karte(4, "k2", "Was ist eine Stichprobe?", "Auswahl.", True, 1, 0, 2), stapel={"name": "Methodenlehre Definitionen", "fach_id": "f2"})],
        "ki_thema_stand": [{"fach_id": "f1", "thema": "Agoraphobie", "beherrschung": 0.38, "fehlerbild": "verwechselt mit Panikstörung"},
                           {"fach_id": "f1", "thema": "Panikstörung", "beherrschung": 0.6, "fehlerbild": None},
                           {"fach_id": "f1", "thema": "Exposition", "beherrschung": 0.85, "fehlerbild": None}],
        "quiz": [{"id": "q1", "user_id": UID, "titel": "Testgütekriterien", "fach_id": "f1", "fragen": FRAGEN, "einstellungen": {}, "erstellt_am": "2026-11-10T10:00:00Z", "geaendert_am": "2026-11-16T10:00:00Z", "quellen": []}],
        "quiz_versuch": [],
        "podcast": [{"id": "pc1", "user_id": UID, "titel": "Angststörungen in sechs Minuten", "fach_id": "f1", "erstellt_am": "2026-11-12T10:00:00Z", "quellen": [], "skript": [{"sprecher": 1, "text": "Heute geht es um Angststörungen."}]}],
        "notiz": [notiz(1, "Vorlesung 4: Angststörungen", "f1", "# Angststörungen\n\nPanikstörung und Agoraphobie. #angst", pin=True, datum="2026-11-14"),
                  notiz(2, "Exposition", "f1", "Konfrontation, in sensu oder in vivo.", datum="2026-11-12"),
                  notiz(3, "Regression: Annahmen und typische Fehler bei der Interpretation im Methodenkurs", "f2", "Linearität.", datum="2026-11-10")],
        "notiz_link": [],
        "dokument": [{"id": "dk1", "user_id": UID, "titel": "Hausarbeit Angststörungen", "fach_id": "f1", "inhalt": DOK, "klartext": "x", "woerter": 1240, "erstellt_am": "2026-11-01T10:00:00Z", "geaendert_am": "2026-11-15T10:00:00Z"}],
        "literatur_quelle": [{"id": "lq1", "user_id": UID, "autoren": "Margraf, J. & Schneider, S.", "titel": "Lehrbuch der Verhaltenstherapie", "jahr": 2018, "typ": "BUCH", "verlag": "Springer", "seiten": None, "url": None, "abgerufen_am": None, "datei_id": None, "fach_id": "f1", "notiz": None, "ki_erzeugt": False, "erstellt_am": "2026-11-01T10:00:00Z", "geaendert_am": "2026-11-01T10:00:00Z"}],
        "praesentation": [{"id": "pr1", "user_id": UID, "titel": "Referat Exposition", "fach_id": "f1", "design": "DUNKEL", "ki_erzeugt": False, "erstellt_am": "2026-11-05T10:00:00Z", "geaendert_am": "2026-11-15T10:00:00Z", "folien": [folie(1, "TITEL", "Exposition", "Referat")]}],
        "tabelle": [{"id": "tb1", "user_id": UID, "titel": "Notenrechnung", "fach_id": "f2", "daten": {"spalten": 5, "zeilen": 8, "zellen": {}}, "erstellt_am": "2026-11-05T10:00:00Z", "geaendert_am": "2026-11-14T10:00:00Z"}],
        "mindmap": [{"id": "mm1", "user_id": UID, "name": "Angststörungen", "fach_id": "f1", "ki_erzeugt": False, "daten": {"knoten": [], "kanten": []}, "erstellt_am": "2026-11-05T10:00:00Z", "geaendert_am": "2026-11-13T10:00:00Z"}],
        "whiteboard": [{"id": "wb1", "user_id": UID, "name": "Skizze Lernplan", "fach_id": None, "daten": {}, "erstellt_am": "2026-11-05T10:00:00Z", "geaendert_am": "2026-11-11T10:00:00Z"}],
        "transkript": [{"id": "tr1", "user_id": UID, "titel": "Vorlesung 5: Angststörungen im Jugendalter", "fach_id": "f1", "quelle": "aufnahme", "sprache": "de", "erstellt_am": "2026-11-18T10:00:00Z", "geaendert_am": "2026-11-18T11:30:00Z",
                        "text": "Heute geht es um Angststörungen. Zuerst die Panikstörung.", "absaetze": [{"start": 0, "text": "Heute geht es um Angststörungen."}, {"start": 65, "text": "Zuerst die Panikstörung, dann Agoraphobie."}],
                        "transkript_teil": [{"nr": 1, "status": "fertig", "sekunden": 2700, "gestartet_am": "2026-11-18T10:00:00Z"}]},
                       {"id": "tr2", "user_id": UID, "titel": "Sprechstunde Methodenlehre", "fach_id": None, "quelle": "datei", "sprache": "de", "erstellt_am": "2026-11-12T10:00:00Z", "geaendert_am": "2026-11-12T10:30:00Z",
                        "text": "", "absaetze": [], "transkript_teil": [{"nr": 1, "status": "laeuft", "sekunden": 600, "gestartet_am": "2026-11-12T10:00:00Z"}]}],
        "transkript_teil": [{"transkript_id": "tr1", "nr": 1, "status": "fertig", "sekunden": 2700, "gestartet_am": "2026-11-18T10:00:00Z", "text": "Heute geht es um Angststörungen."}],
        "chat_nachricht": [{"id": "m1", "chat_id": "c1", "user_id": P2, "text": "Hast du die Folien von heute?", "anhang": None, "geloescht": False, "erstellt_am": f"{heute}T08:50:00Z"},
                           {"id": "m2", "chat_id": "c1", "user_id": UID, "text": "Ja, Moment.", "anhang": None, "geloescht": False, "erstellt_am": f"{heute}T09:00:00Z"},
                           {"id": "m3", "chat_id": "c1", "user_id": UID, "text": "", "anhang": {"typ": "deadline", "id": "d1", "titel": "Hausarbeit abgeben", "faellig_am": f"{heute}T22:59:00Z"}, "geloescht": False, "erstellt_am": f"{heute}T09:05:00Z"},
                           {"id": "m4", "chat_id": "c1", "user_id": P2, "text": "Ich schick dir gleich die Folien.", "anhang": None, "geloescht": False, "erstellt_am": f"{heute}T09:12:00Z"},
                           {"id": "m5", "chat_id": "c1", "user_id": P2, "text": "", "anhang": None, "geloescht": True, "erstellt_am": f"{heute}T09:13:00Z"}],
        "nutzer_blockiert": [],
        "lernraum": [{"id": f"lr{i}", "user_id": UID, "fach_id": f"f{i}", "erstellt_am": "2026-11-01T10:00:00Z", "geaendert_am": "2026-11-12T10:00:00Z"} for i in (1, 2, 3)],
        "lernraum_quelle": [], "lernraum_nachricht": [],
        "benachrichtigung": [{"id": "b1", "user_id": UID, "text": "Hausarbeit abgeben ist heute fällig", "gelesen": False, "ref_id": "d1", "erstellt_am": f"{heute}T07:00:00Z"},
                             {"id": "b2", "user_id": UID, "text": "Gliederung schicken ist in fünf Tagen fällig", "gelesen": True, "ref_id": "d3", "erstellt_am": "2026-11-18T12:00:00Z"}],
    }
    return D.get(tabelle, [])

def chats():
    heute = time.strftime("%Y-%m-%d")
    return [{"chat_id": "c1", "deadline_id": None, "letzte_nachricht": "Ich schick dir gleich die Folien.", "letzte_nachricht_am": f"{heute}T09:12:00Z", "mitglieder": 2, "name": "lena", "partner_id": P2, "typ": "DIREKT", "ungelesen": 2},
            {"chat_id": "c2", "deadline_id": "d1", "letzte_nachricht": "Wer übernimmt die Einleitung? Ich hätte morgen Zeit, den Methodenteil zu schreiben.", "letzte_nachricht_am": "2026-11-18T17:40:00Z", "mitglieder": 3, "name": "Gruppenarbeit Methodenlehre mit einem langen Namen", "partner_id": None, "typ": "GRUPPE", "ungelesen": 0}]
RPC = {
    "chat_uebersicht": chats,
    "chat_mitglieder": lambda: [{"user_id": UID, "username": "didi"}, {"user_id": P2, "username": "lena"}, {"user_id": P3, "username": "jonas"}],
    "chat_ungelesen_gesamt": lambda: 2,
    "chat_gelesen": lambda: None,
}

def passt(z, k, v):
    if k not in z: return True
    if not v.startswith("eq."): return True
    w = v[3:]; x = z[k]
    return (str(x).lower() if isinstance(x, bool) else str(x)) == w

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def antwort(self, code, body, headers=None):
        b = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def do_OPTIONS(self): self.antwort(200, {})
    def rest(self, methode):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/__modus": Z["modus"] = q["w"][0]; return self.antwort(200, {"ok": 1})
        if u.path == "/__theme": Z["theme"] = q["w"][0]; return self.antwort(200, {"ok": 1})
        if u.path == "/__langsam": Z["ms"] = int(q["ms"][0]); return self.antwort(200, {"ok": 1})
        if u.path == "/__leiste": Z["leiste"] = q["w"][0] if q["w"][0] != "aus" else None; return self.antwort(200, {"ok": 1})
        if u.path == "/__klausur": w = q["w"][0]; Z["klausur"] = {"bis": "2026-12-15"} if w == "an" else ({"abgelehnt": "p3"} if w == "abgelehnt" else None); return self.antwort(200, {"ok": 1})
        if u.path == "/__einmal401": Z["e401"].add(q["t"][0]); return self.antwort(200, {"ok": 1})
        if u.path.startswith("/auth/v1/user"): return self.antwort(200, USER)
        if u.path.startswith("/auth/v1/"): return self.antwort(200, {})
        if u.path.startswith("/storage/v1/"): return self.antwort(200, [] if methode == "GET" else {})
        if u.path.startswith("/realtime"): return self.antwort(404, {})
        m = re.match(r"/rest/v1/(rpc/)?([\w]+)", u.path)
        if not m: return self.antwort(404, {"message": "unbekannt"})
        if Z["ms"]: time.sleep(Z["ms"] / 1000)
        if m.group(1):
            if Z["modus"] == "kaputt" and m.group(2) in RPC:
                return self.antwort(500, {"code": "XX000", "message": "kaputt (Prüfung)", "details": None, "hint": None})
            if m.group(2) in RPC:
                return self.antwort(200, [] if Z["modus"] == "leer" and isinstance(RPC[m.group(2)](), list) else RPC[m.group(2)]())
            return self.antwort(200, None if Z["modus"] == "leer" or m.group(2) != "notenschnitt" else 1.8)
        tabelle = m.group(2)
        if tabelle in Z["e401"]:
            Z["e401"].discard(tabelle)
            return self.antwort(401, {"code": "PGRST301", "message": "JWT expired", "details": None, "hint": None})
        if Z["modus"] == "kaputt" and tabelle != "settings":
            return self.antwort(500, {"code": "XX000", "message": "kaputt (Prüfung)", "details": None, "hint": None})
        if methode != "GET" and tabelle == "settings":
            return self.antwort(200, settings() if "pgrst.object" in (self.headers.get("Accept") or "") else [settings()])
        if methode != "GET":
            return self.antwort(201 if methode == "POST" else 200, [])
        zeilen = [z for z in daten(tabelle) if all(passt(z, k, v[0]) for k, v in q.items() if k not in ("select", "order", "limit", "offset"))]
        if "pgrst.object" in (self.headers.get("Accept") or ""):
            if len(zeilen) != 1:
                return self.antwort(406, {"code": "PGRST116", "message": "keine Zeile", "details": "0 rows", "hint": None})
            return self.antwort(200, zeilen[0])
        return self.antwort(200, zeilen, {"Content-Range": f"0-{max(len(zeilen)-1,0)}/{len(zeilen)}"})
    def do_GET(self): self.rest("GET")
    def do_HEAD(self): self.rest("GET")
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); self.rfile.read(n); self.rest("POST")
    def do_PATCH(self):
        n = int(self.headers.get("Content-Length") or 0); self.rfile.read(n); self.rest("PATCH")
    def do_DELETE(self): self.rest("DELETE")

ThreadingHTTPServer(("127.0.0.1", 54321), H).serve_forever()
