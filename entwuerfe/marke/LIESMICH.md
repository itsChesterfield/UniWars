# Marken-Entwürfe (Stand 20.11.2026)

Dieser Branch wird **nie gemergt**. Er bewahrt nur die Entwürfe auf, damit sie
nicht verloren gehen. Im Betrieb bleibt vorerst die Marke aus PR #109.

## Woher die Entwürfe kommen

Didis Referenzen vom 20.11.: ein ORBIT-Logoset (Gold auf warmem Schwarz, Kreis
aus mehreren feinen versetzten Linien, volle Scheiben als Gewichtskontrast) und
ein YouandLeads-Monogramm (verschränkte Formen in einem Container, Lücken an den
Kreuzungen). Übernommen sind Technik und Prinzip, nie die Komposition. Das
ORBIT-Set ist fremde Arbeit, Planet mit Ring und Kreis mit Sichel sind deren
Marken und dürfen nicht nachgebaut werden.

## Aufbau der Marke

Ring aus mehreren leicht versetzten feinen Linien, darin ein U in derselben
Technik, dazu ein oder zwei volle Trabanten auf dem Ring als Kontrast zwischen
dünner Linie und voller Fläche. Jede Datei ohne `s` ist der feine Schnitt für
die App-Symbole, jede Datei mit `s` der reduzierte Schnitt für 16 und 32 px.

## Dateien

- `L2.svg` / `L2s.svg`: erste Fassung, im Gold der Referenz.
- `L2u.svg` / `L2us.svg`: dieselbe Fassung in unseren Token (#E8BE6A auf #08090b).
- `T1`: schmaleres U, mehr Luft zum Ring.
- `T2`: größerer Ring. Verworfen, klebt am Rand der Kachel.
- `T3`: ohne Trabant. Am ruhigsten, ohne Gewichtskontrast.
- `T4`: kleinerer Trabant plus winziger Gegenpol unten links. Didis und mein Favorit.
- `T5`: vier statt drei Linien, feiner. Stärkste gezeichnete Textur.
- `T6`: Trabant oben. Verworfen, liest sich als Einschaltknopf.
- `runde18.png`, `L2final.png`: die Vergleichsbilder dazu.

## Offen, wenn es weitergeht

1. Fassung festlegen. Vorschlag war T4 mit den feineren Linien aus T5.
2. Entscheiden, ob das Gold wärmer und matter wird. Das wäre eine Token-Änderung
   in `DESIGN.md` und beträfe die ganze App, nicht nur das Symbol.
3. Erst dann Tab und alle App-Symbole in einem PR: `src/app/icon.svg`,
   `src/app/favicon.ico`, `public/app/icon.svg`, `icon-192.png`, `icon-512.png`,
   `icon-maskable-512.png`, `src/app/apple-icon.png`.
