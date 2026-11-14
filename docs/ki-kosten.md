# KI-Kosten pro Nutzer (Go-live-Prüfung, Stand 14.11.2026)

> **Preise vor dem Go-live in der Mistral-Preisliste prüfen.** Die Werte unten stammen aus
> Berichten zur Voxtral-3-Ankündigung (Okt. 2026) bzw. sind Annahmen. Der EU-Endpunkt
> (`api.eu.mistral.ai`) kostet laut Berichten etwa 10 % mehr.

## Annahmen

| Posten | Preis | Quelle |
|---|---|---|
| Textmodell (`KI_MODELL`, Mistral Small) | 0,10 $ / 1 Mio. Eingabe-Tokens, 0,30 $ / 1 Mio. Ausgabe-Tokens | Annahme – prüfen |
| Transkription (Voxtral Mini Transcribe 3, Datei) | 0,0035 $ / Minute | Berichte zu Voxtral 3 |
| Vorlesen (Voxtral TTS 3) | 13 $ / 1 Mio. Zeichen | Berichte zu Voxtral 3 |
| Deutsch | ca. 3,3 Zeichen pro Token | Faustwert |

## Limits (Standardwerte, `src/lib/ki/limits.ts`)

| Kontingent | Limit | Variable |
|---|---|---|
| Text-Funktionen inkl. Tagesvorschläge | 20 Anfragen / Tag | `KI_LIMIT_TEXT_TAG` |
| Assistent | 40 Nachrichten / Tag | `KI_LIMIT_CHAT_TAG` |
| Diktieren + Transkription | 120 Minuten / Monat | `KI_LIMIT_AUDIO_MINUTEN_MONAT` |
| Vorlesen | 50.000 Zeichen / Monat | `KI_LIMIT_TTS_ZEICHEN_MONAT` |

## Schlimmster Fall: ein Nutzer schöpft jeden Tag alles aus (30 Tage)

| Kontingent | Rechnung | pro Monat |
|---|---|---|
| Text | 600 Anfragen × (8.000 Ein × 0,10 $ + 1.500 Aus × 0,30 $) / 1 Mio. | 0,75 $ |
| Assistent | 1.200 Nachrichten × (25.000 Ein × 0,10 $ + 800 Aus × 0,30 $) / 1 Mio. ¹ | 3,29 $ |
| Audio | 120 Min × 0,0035 $ | 0,42 $ |
| Vorlesen | 50.000 Zeichen × 13 $ / 1 Mio. | 0,65 $ |
| **Summe** | | **≈ 5,10 $** (mit EU-Aufschlag ≈ 5,60 $) |

¹ Pro Nachricht bis zu 5 Werkzeug-Runden; jedes Ergebnis ist auf 12.000 Zeichen begrenzt,
der Verlauf auf 12 Nachrichten plus Zusammenfassung. 25.000 Eingabe-Tokens sind ein hoher Wert.

## Realistischer Fall

Erfahrungsgemäß nutzen die meisten Nutzer 10–15 % ihrer Limits: **≈ 0,50–0,80 $ pro aktivem
Nutzer und Monat.** Der Assistent macht den größten Anteil aus; der wichtigste Hebel ist
`KI_LIMIT_CHAT_TAG`.

## Budget-Alarm im Mistral-Konto

- **Alarm:** aktive Nutzer × 1 $ pro Monat (deutlich über dem realistischen Fall).
- **Harte Grenze:** aktive Nutzer × 5,60 $ (schlimmster Fall) – darüber kann es nicht gehen,
  solange die Limits nicht erhöht werden.
- Beispiel 200 aktive Nutzer: Alarm bei 200 $, harte Grenze 1.120 $.

Den tatsächlichen Verbrauch zeigt die Tabelle `ki_nutzung` (Tokens bzw. Sekunden/Zeichen pro
Anfrage, ohne Inhalte). Nach dem ersten Monat die Annahmen hier mit echten Zahlen ersetzen.
