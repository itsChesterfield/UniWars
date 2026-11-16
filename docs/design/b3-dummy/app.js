(() => {
'use strict';
document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const mqRuhig = matchMedia('(prefers-reduced-motion: reduce)');
const ruhig = () => mqRuhig.matches || document.documentElement.dataset.bewegung === 'ruhig';

/* ---------- Symbole ---------- */
const ICONS = {
  hub:'<circle cx="8" cy="8" r="2.2"/><ellipse cx="8" cy="8" rx="6.5" ry="2.6" transform="rotate(-20 8 8)"/>',
  fokus:'<circle cx="8" cy="8.5" r="5.5"/><path d="M8 5.5v3l2 1.3M6.5 1.5h3"/>',
  karten:'<rect x="2.5" y="4" width="9" height="9.5" rx="1.5"/><path d="M5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v7.5"/>',
  notiz:'<path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M9.5 2.5v3h3M5.5 8.5h5M5.5 11h3.5"/>',
  pdf:'<path d="M3.5 1.5h6l3 3v10h-9z"/><path d="M5.5 9.5h5M5.5 12h3"/>',
  ordner:'<path d="M1.5 4.5a1 1 0 0 1 1-1h3.3l1.5 1.5h6.2a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
  buch:'<path d="M2.5 3h4a1.5 1.5 0 0 1 1.5 1.5V13a1 1 0 0 0-1-1h-4.5zM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V13a1 1 0 0 1 1-1h4.5z"/>',
  mikro:'<rect x="6" y="1.5" width="4" height="8" rx="2"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5"/>',
  funke:'<path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z"/>',
  text:'<path d="M3 3.5h10M8 3.5v9.5M5.5 13h5"/>',
  tabelle:'<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M2 10h12M6.5 6.5v7"/>',
  folie:'<rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5"/><path d="M8 11v3M5.5 14h5"/>',
  mind:'<circle cx="8" cy="8" r="2"/><circle cx="2.8" cy="3.5" r="1.3"/><circle cx="13.2" cy="4" r="1.3"/><circle cx="12.5" cy="12.8" r="1.3"/><path d="M6.4 6.7 3.8 4.4M9.8 7.2l2.3-2.4M9.4 9.5l2.2 2.3"/>',
  tafel:'<path d="M2.5 13.5c2-3 3-6.5 5-6.5s1.5 4 3.5 4 2-3.5 2.5-5"/><rect x="1.5" y="1.5" width="13" height="13" rx="2"/>',
  chat:'<path d="M2.5 3.5h11v7.5h-6l-3.5 2.5V11h-1.5z"/>',
  suche:'<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
  pfeil:'<path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>',
  links:'<path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5"/>',
  plus:'<path d="M8 3v10M3 8h10"/>',
  mond:'<path d="M12.5 10A5.5 5.5 0 0 1 6 3.5a5.5 5.5 0 1 0 6.5 6.5z"/>',
  sonne:'<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
  zahnrad:'<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  haken:'<path d="m3.5 8.5 3 3 6-7"/>',
  runter:'<path d="m4 6 4 4 4-4"/>',
  play:'<path d="M5 3.5v9l7.5-4.5z"/>',
  pause:'<path d="M5.5 3.5v9M10.5 3.5v9"/>',
  zurueck:'<path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5"/>',
  hoch:'<path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7"/>',
  stift:'<path d="M10.5 2.5 13.5 5.5 6 13H3v-3z"/>',
  minus:'<path d="M3 8h10"/>',
  datei:'<path d="M4 1.5h5.5l3 3V14.5H4z"/><path d="M9.5 1.5v3h3"/>',
  achtung:'<circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4.5M8 11.2v.3"/>',
  offline:'<path d="M4.5 12.5h7a3 3 0 0 0 .6-5.9A4.5 4.5 0 0 0 4 6.2a3.2 3.2 0 0 0 .5 6.3zM2.5 2.5l11 11"/>',
  griff:'<circle cx="6" cy="4" r=".9"/><circle cx="10" cy="4" r=".9"/><circle cx="6" cy="8" r=".9"/><circle cx="10" cy="8" r=".9"/><circle cx="6" cy="12" r=".9"/><circle cx="10" cy="12" r=".9"/>',
  auge:'<path d="M2.5 8s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4-5.5-4-5.5-4z"/><path d="M3 13 13 3"/>',
  person:'<circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c.8-2.6 2.7-4 5-4s4.2 1.4 5 4"/>',
  glocke:'<path d="M4 11.5V7.5a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 13.5a1.5 1.5 0 0 0 3 0"/>',
  lernraum:'<path d="M8 2 14 5 8 8 2 5z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3"/>',
  x:'<path d="M4 4l8 8M12 4l-8 8"/>',
  gross:'<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/>',
  klein:'<path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14"/>',
  kalender:'<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/>',
  raster:'<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'
};
const ic = (n, cls = 'i', st = '') => `<svg class="${cls}" aria-hidden="true"${st ? ` style="${st}"` : ''}><use href="#i-${n}"/></svg>`;
const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
sprite.setAttribute('aria-hidden', 'true'); sprite.style.cssText = 'position:absolute;width:0;height:0';
sprite.innerHTML = Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 16 16">${v}</symbol>`).join('');
document.body.prepend(sprite);

/* ---------- Daten ---------- */
const F = { kp: ['Klinische Psychologie', 'f1', 'Klinische'], ml: ['Methodenlehre', 'f2', 'Methoden'], di: ['Diagnostik', 'f3', 'Diagnostik'], vt: ['Verhaltenstherapie', 'f4', 'VT'] };
const fach = k => `<span class="fach" style="--c:var(--${F[k][1]})"><i></i>${F[k][2]}</span>`;
const BEREICHE = [
  ['Täglich', [['hub', 'hub', 'Zentraler Hub'], ['work-station', 'fokus', 'Work Station'], ['karteikarten', 'karten', 'Karteikarten'], ['notizen', 'notiz', 'Notizen']]],
  ['Studium', [['pdf', 'pdf', 'PDF Reader'], ['lernraum', 'lernraum', 'Lernraum'], ['dateiablage', 'ordner', 'Dateiablage'], ['literatur', 'buch', 'Literatur'], ['transkription', 'mikro', 'Transkription'], ['chat', 'chat', 'Chat']]],
  ['Werkzeuge', [['textverarbeitung', 'text', 'Textverarbeitung'], ['tabellen', 'tabelle', 'Tabellen'], ['praesentationen', 'folie', 'Präsentationen'], ['mindmap', 'mind', 'MindMap'], ['whiteboard', 'tafel', 'Whiteboard']]]
];
const ALLE = BEREICHE.flatMap(([g, l]) => l.map(([s, i, n]) => ({ s, i, n, g })));
const bereich = s => ALLE.find(b => b.s === s) || EXTRA.find(b => b.s === s);

const STAPEL = [
  { id: 'testguete', n: 'Testgütekriterien', f: 'di', karten: 48, faellig: 24 },
  { id: 'angst', n: 'Angststörungen', f: 'kp', karten: 62, faellig: 9 },
  { id: 'regression', n: 'Regression', f: 'ml', karten: 30, faellig: 6 },
  { id: 'kogn', n: 'Kognitive Techniken', f: 'vt', karten: 41, faellig: 0 }
];
const KARTEN = {
  testguete: [
    ['Was unterscheidet Reliabilität von Validität?', 'Reliabilität ist die Messgenauigkeit. Validität sagt, ob der Test misst, was er messen soll.'],
    ['Was misst die Retest-Reliabilität?', 'Die Stabilität der Messwerte, wenn derselbe Test nach einer Zeit erneut vorgelegt wird.'],
    ['Was bedeutet Objektivität?', 'Die Ergebnisse hängen nicht davon ab, wer den Test durchführt, auswertet oder interpretiert.'],
    ['Was ist Konstruktvalidität?', 'Der Test erfasst das theoretische Merkmal, das er erfassen soll, und hängt mit verwandten Maßen erwartungsgemäß zusammen.'],
    ['Wofür steht Cronbachs Alpha?', 'Ein Maß der internen Konsistenz: Wie stark messen die Items einer Skala dasselbe?'],
    ['Was ist Kriteriumsvalidität?', 'Der Testwert hängt mit einem äußeren Kriterium zusammen, etwa späterem Studienerfolg.']
  ],
  angst: [['Kernmerkmal der Panikstörung?', 'Wiederkehrende, unerwartete Panikattacken und anhaltende Sorge vor weiteren Attacken.'], ['Was ist Agoraphobie?', 'Angst vor Situationen, aus denen Flucht schwierig oder Hilfe nicht erreichbar wäre.'], ['Mittel der Wahl bei spezifischer Phobie?', 'Exposition, also die schrittweise Konfrontation mit dem gefürchteten Reiz.']],
  regression: [['Was gibt der Determinationskoeffizient R² an?', 'Den Anteil der Varianz im Kriterium, der durch die Prädiktoren erklärt wird.'], ['Was ist Multikollinearität?', 'Prädiktoren hängen stark untereinander zusammen, die Schätzung der Gewichte wird unsicher.']],
  kogn: [['Was ist ein sokratischer Dialog?', 'Gezielte Fragen, mit denen Patientinnen und Patienten ihre Bewertungen selbst prüfen.']]
};

const NOTIZEN = [
  { id: 'vt-gruppe', t: 'Lerngruppe VT', f: 'vt', zeit: 'heute, 11:31', html: '<p>Sokratischer Dialog: Fragen sammeln, die die eigene Bewertung prüfen lassen, statt sie zu widerlegen.</p><h2>Fragen für das Fallbeispiel</h2><ul><li>Welche Beweise sprechen für den Gedanken, welche dagegen?</li><li>Wie würde eine gute Freundin die Lage sehen?</li><li>Was wäre das Schlimmste, das Beste, das Wahrscheinlichste?</li></ul><p>Nächstes Treffen: Fallbeispiel Panikstörung vorbereiten, Lea bringt das Arbeitsblatt mit.</p>',
    vorschlag: [['Was ist das Ziel des sokratischen Dialogs?', 'Bewertungen selbst prüfen lassen, statt sie zu widerlegen.'], ['Nenne eine Frage zur Beweislage.', 'Welche Beweise sprechen für den Gedanken, welche dagegen?'], ['Was fragt die Entkatastrophisierung?', 'Was wäre das Schlimmste, das Beste, das Wahrscheinlichste?']] },
  { id: 'angst', t: 'Vorlesung 4: Angststörungen', f: 'kp', zeit: 'gestern, 18:05', html: '<p>Angststörungen sind die häufigsten psychischen Störungen. Gemeinsam ist ihnen eine übermäßige Angstreaktion, die nicht zur tatsächlichen Gefahr passt.</p><h2>Störungsbilder</h2><ul><li>Panikstörung</li><li>Agoraphobie</li><li>Generalisierte Angststörung</li><li>Soziale Angststörung</li><li>Spezifische Phobien</li></ul><p>Behandlung der Wahl ist kognitive Verhaltenstherapie mit Exposition.</p>',
    vorschlag: [['Was ist allen Angststörungen gemeinsam?', 'Eine übermäßige Angstreaktion, die nicht zur tatsächlichen Gefahr passt.'], ['Nenne drei Angststörungen.', 'Panikstörung, Agoraphobie, generalisierte Angststörung.'], ['Behandlung der Wahl?', 'Kognitive Verhaltenstherapie mit Exposition.']] },
  { id: 'regression', t: 'Übung: Regression', f: 'ml', zeit: '12. November', html: '<p>Multiple Regression: ein Kriterium, mehrere Prädiktoren. Standardisierte Koeffizienten machen die Prädiktoren vergleichbar.</p><p>Voraussetzungen prüfen: Linearität, Normalverteilung der Residuen, Homoskedastizität, keine Multikollinearität.</p>',
    vorschlag: [['Wozu standardisierte Koeffizienten?', 'Sie machen Prädiktoren mit verschiedenen Einheiten vergleichbar.'], ['Nenne zwei Voraussetzungen der Regression.', 'Linearität und Homoskedastizität.'], ['Was prüft man bei den Residuen?', 'Ob sie normalverteilt sind.']] },
  { id: 'diagnostik', t: 'Diagnostik: Testtheorie', f: 'di', zeit: '10. November', html: '<p>Klassische Testtheorie: Jeder Messwert besteht aus wahrem Wert und Messfehler.</p><p>Gütekriterien: Objektivität, Reliabilität, Validität. Dazu Nebengütekriterien wie Normierung und Ökonomie.</p>',
    vorschlag: [['Woraus besteht ein Messwert in der klassischen Testtheorie?', 'Aus wahrem Wert und Messfehler.'], ['Die drei Hauptgütekriterien?', 'Objektivität, Reliabilität, Validität.'], ['Nenne ein Nebengütekriterium.', 'Normierung oder Ökonomie.']] }
];

const DOKS = [
  { id: 'uebung3', t: 'Übungsblatt 3, Regression', f: 'ml', seiten: [
    ['Übungsblatt 3: Multiple Regression', ['Bearbeiten Sie die folgenden Aufgaben mit dem Datensatz „pruefung.csv“. Er enthält 120 Fälle mit den Variablen Prüfungsangst, Lernzeit und Selbstwirksamkeit.', 'Aufgabe 1. Berechnen Sie die Korrelationen zwischen allen drei Variablen und beschreiben Sie die Zusammenhänge in eigenen Worten.', 'Aufgabe 2. Prüfen Sie die Voraussetzungen einer multiplen Regression. Gehen Sie auf Linearität, Normalverteilung der Residuen und Homoskedastizität ein.']],
    ['Aufgabe 3', ['Schätzen Sie ein multiples Regressionsmodell mit Prüfungsangst als Kriterium und Lernzeit sowie Selbstwirksamkeit als Prädiktoren.', 'Interpretieren Sie die standardisierten Koeffizienten. Welcher Prädiktor trägt mehr zur Vorhersage bei?', 'Berichten Sie R² und das korrigierte R² und erläutern Sie den Unterschied.']],
    ['Aufgaben 4 und 5', ['Aufgabe 4. Prüfen Sie, ob Multikollinearität vorliegt. Nutzen Sie dazu den Varianzinflationsfaktor.', 'Aufgabe 5. Fassen Sie Ihre Ergebnisse in einem kurzen Ergebnisteil im APA-Stil zusammen.', 'Abgabe als PDF bis Dienstag, 23:59, über die Lernplattform.']]
  ], mark: [[1, 1]] },
  { id: 'angst-vl', t: 'Vorlesung 4, Angststörungen', f: 'kp', seiten: [
    ['Angststörungen: Überblick', ['Angst ist eine normale und sinnvolle Reaktion auf Gefahr. Zur Störung wird sie, wenn sie übermäßig, anhaltend und beeinträchtigend ist.', 'Die Lebenszeitprävalenz von Angststörungen gehört zu den höchsten aller psychischen Störungen.']],
    ['Behandlung', ['Kognitive Verhaltenstherapie mit Exposition ist das Verfahren mit der besten Evidenz.', 'Bei der Exposition wird die Angst bewusst ausgelöst, bis sie von selbst nachlässt.']]
  ], mark: [[0, 0], [1, 0]] },
  { id: 'testguete', t: 'Testgütekriterien', f: 'di', seiten: [
    ['Hauptgütekriterien', ['Objektivität: Unabhängigkeit der Ergebnisse von der durchführenden Person.', 'Reliabilität: Genauigkeit der Messung, unabhängig davon, was gemessen wird.', 'Validität: Der Test misst das Merkmal, das er messen soll.']]
  ], mark: [] }
];

const DATEIEN = [
  { n: 'Übungsblatt 3, Regression.pdf', f: 'ml', g: '412 KB', d: 'heute, 11:42', t: 'pdf', link: '#/pdf/uebung3' },
  { n: 'pruefung.csv', f: 'ml', g: '18 KB', d: 'heute, 11:40', t: 'tabelle' },
  { n: 'Vorlesung 4, Angststörungen.pdf', f: 'kp', g: '2,1 MB', d: 'gestern, 18:02', t: 'pdf', link: '#/pdf/angst-vl' },
  { n: 'Testgütekriterien.pdf', f: 'di', g: '860 KB', d: '14. November', t: 'pdf', link: '#/pdf/testguete' },
  { n: 'Fallbeispiel Panikstörung.docx', f: 'kp', g: '96 KB', d: '13. November', t: 'text' },
  { n: 'Literaturliste Diagnostik.pdf', f: 'di', g: '120 KB', d: '9. November', t: 'pdf' }
];

let AUFGABEN = [
  { id: 1, t: 'Statistik-Übung, Aufgabe 3', f: 'ml', min: 50, fertig: false },
  { id: 2, t: 'Karteikarten Diagnostik', f: 'di', min: 18, fertig: false },
  { id: 3, t: 'Vorlesung 4 nacharbeiten', f: 'kp', min: 45, fertig: false },
  { id: 4, t: 'Karteikarten Klinische', f: 'kp', min: 20, fertig: true },
  { id: 5, t: 'Referat VT gliedern', f: 'vt', min: 30, fertig: false }
];

/* ---------- Zustand ---------- */
const S = { geladen: new Set(), timer: { modus: 'fokus', rest: 25 * 60, laeuft: false, aufgabe: 1, heute: 48 }, hubKarte: 0, notizVorschlag: null, uebernommen: {}, pdf: { zoom: 1, markieren: false, extra: {} }, uploads: [], upFehler: false };
let lern = null;

/* ---------- Schale ---------- */
const MARKE = '<svg width="24" height="24" viewBox="-20 -20 40 40" aria-hidden="true"><ellipse rx="17" ry="6.5" fill="none" stroke="var(--linie-2)" stroke-width="1.6" transform="rotate(-18)"/><path d="M-6.5 -10V2a6.5 6.5 0 0 0 13 0V-10" fill="none" stroke="var(--akzent)" stroke-width="3" stroke-linecap="round"/><circle cx="15.4" cy="-5" r="2.4" fill="var(--akzent)"/></svg>';
const BADGES = { karteikarten: 1, chat: 1 };
const KURZ = { hub: 'Hub', 'work-station': 'Fokus', karteikarten: 'Karten', notizen: 'Notizen', pdf: 'PDF', dateiablage: 'Dateien', literatur: 'Literatur', transkription: 'Aufnahme', lernraum: 'Lernraum', chat: 'Chat', textverarbeitung: 'Text', tabellen: 'Tabellen', praesentationen: 'Folien', mindmap: 'MindMap', whiteboard: 'Board' };
const EXTRA = [{ s: 'einstellungen', i: 'zahnrad', n: 'Einstellungen', g: 'Konto' }];
/* Persönliche Einstellungen: Design, Darstellung, Symbolleiste. Getrennt vom späteren Design-Rezept. */
const PERS_STD = () => ({ design: 'nacht', schrift: 'normal', dichte: 'normal', bewegung: 'system', reihe: ALLE.map(b => b.s), aus: [] });
S.pers = PERS_STD();
try { const p = JSON.parse(localStorage.getItem('uv-pers')); if (p && Array.isArray(p.reihe)) { const gueltig = p.reihe.filter(x => ALLE.some(b => b.s === x)); ALLE.forEach(b => { if (!gueltig.includes(b.s)) gueltig.push(b.s); }); S.pers = { ...S.pers, ...p, reihe: gueltig, aus: (p.aus || []).filter(x => gueltig.includes(x)) }; } else { const t = localStorage.getItem('uv-dummy-b3'); if (t) S.pers.design = t; } } catch (_) {}
const persSichern = () => { try { localStorage.setItem('uv-pers', JSON.stringify(S.pers)); } catch (_) {} };
const sichtbar = () => S.pers.reihe.filter(s => !S.pers.aus.includes(s));

function railZeichnen() {
  let h = `<span class="rmarker" aria-hidden="true" hidden></span><a class="rmarke" href="#/hub" aria-label="UniVerse, zum Zentralen Hub">${MARKE}</a>`, gruppe = null;
  sichtbar().forEach(s => {
    const b = bereich(s);
    if (gruppe && b.g !== gruppe) h += '<span class="rtrenn" aria-hidden="true"></span>';
    gruppe = b.g;
    h += `<a class="rpunkt" href="#/${s}" data-b="${s}" aria-label="${b.n}">${ic(b.i)}${BADGES[s] ? '<span class="badge" aria-hidden="true"></span>' : ''}<span class="tip" aria-hidden="true">${b.n}</span></a>`;
  });
  h += `<span class="rfuss"><button class="rpunkt" type="button" id="studioKnopf" aria-pressed="${S.studio?.offen ? 'true' : 'false'}" aria-label="UniVerse Studio">${ic('funke')}<span class="tip" aria-hidden="true">UniVerse Studio</span></button><a class="rpunkt" href="#/einstellungen" data-b="einstellungen" aria-label="Einstellungen">${ic('zahnrad')}<span class="tip" aria-hidden="true">Einstellungen</span></a><button class="avatar" type="button" id="profil" aria-haspopup="menu" aria-expanded="false" aria-label="Profil, Didi Romrod">DR</button></span>`;
  $('#rail').innerHTML = h;
  $('.mobilnav').innerHTML = sichtbar().slice(0, 4).map(s => `<a href="#/${s}" data-b="${s}">${ic(bereich(s).i)}${KURZ[s]}</a>`).join('') + `<button type="button" id="mehr">${ic('suche')}Alles</button>`;
  $('#profil').onclick = e => { e.stopPropagation(); profilMenue(); };
  $('#profilMobil') && ($('#profilMobil').onclick = e => { e.stopPropagation(); profilMenue(); });
  $('#mehr').onclick = () => auf();
  $('#studioKnopf').onclick = () => studioUmschalten();
  if (typeof letzterB !== 'undefined' && letzterB) markiere(bereich(letzterB));
}

const mqDunkel = matchMedia('(prefers-color-scheme: dark)');
const designAus = () => S.pers.design === 'system' ? (mqDunkel.matches ? 'nacht' : 'hochschule') : S.pers.design;
function darstellungAnwenden() {
  const d = document.documentElement, t = designAus();
  d.dataset.theme = t; d.dataset.schrift = S.pers.schrift; d.dataset.dichte = S.pers.dichte;
  if (S.pers.bewegung === 'ruhig') d.dataset.bewegung = 'ruhig'; else delete d.dataset.bewegung;
  $$('.wechsel button').forEach(x => x.setAttribute('aria-pressed', x.dataset.theme === t));
}
function designWahl(w) {
  const tun = () => { S.pers.design = w; persSichern(); darstellungAnwenden(); persAktualisieren(); };
  if (document.startViewTransition && !ruhig() && !document.hidden) document.startViewTransition(tun); else tun();
}
mqDunkel.addEventListener('change', () => { if (S.pers.design === 'system') darstellungAnwenden(); });
$$('.wechsel button').forEach(b => b.addEventListener('click', () => designWahl(b.dataset.theme)));
if (location.search.includes('hochschule')) S.pers.design = 'hochschule';
darstellungAnwenden();

/* Profil-Menü am Avatar: Personalisierung, Design wechseln, Einstellungen */
function profilMenue() {
  const offen = $('#profilMenue');
  if (offen) { offen.remove(); $('#profil')?.setAttribute('aria-expanded', 'false'); return; }
  const t = designAus(), anders = t === 'nacht' ? 'Hochschule' : 'Sternenhimmel';
  document.body.insertAdjacentHTML('beforeend', `<div class="menue" id="profilMenue" role="menu" aria-label="Profil">
    <p class="menue-kopf"><span class="avatar" aria-hidden="true">DR</span><span>Didi Romrod</span></p>
    <button class="zeile" type="button" role="menuitem" data-m="pers"><span class="ico">${ic('raster')}</span><span class="n">Personalisierung</span></button>
    <button class="zeile" type="button" role="menuitem" data-m="design"><span class="ico">${ic(t === 'nacht' ? 'sonne' : 'mond')}</span><span class="n">${anders} verwenden</span></button>
    <a class="zeile" href="#/einstellungen/profil" role="menuitem" data-m="einst"><span class="ico">${ic('zahnrad')}</span><span class="n">Einstellungen</span></a></div>`);
  const m = $('#profilMenue'); $('#profil').setAttribute('aria-expanded', 'true');
  const zu = () => { m.remove(); $('#profil')?.setAttribute('aria-expanded', 'false'); };
  $('[data-m="pers"]', m).onclick = () => { zu(); persOeffnen(); };
  $('[data-m="design"]', m).onclick = () => { zu(); designWahl(designAus() === 'nacht' ? 'hochschule' : 'nacht'); };
  $('[data-m="einst"]', m).onclick = zu;
  $('.zeile', m).focus();
  setTimeout(() => addEventListener('click', function weg(e) { if (!m.contains(e.target)) { zu(); removeEventListener('click', weg); } }), 0);
  m.onkeydown = e => { const z = $$('.zeile', m), i = z.indexOf(document.activeElement); if (e.key === 'Escape') { zu(); $('#profil').focus(); } if (e.key === 'ArrowDown') { e.preventDefault(); z[(i + 1) % z.length].focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); z[(i - 1 + z.length) % z.length].focus(); } };
}

/* ---------- Uhr, Countdown, Timer ---------- */
const T = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], TK = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], M = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const heuteText = () => { const d = new Date(); return `${T[d.getDay()]}, ${d.getDate()}. ${M[d.getMonth()]}`; };
function takt() {
  const d = new Date();
  $$('[data-uhr]').forEach(e => e.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`);
  $$('[data-tag]').forEach(e => e.textContent = heuteText());
  const f = new Date(d); f.setDate(f.getDate() + 1); f.setHours(23, 59, 0, 0);
  let s = Math.max(0, Math.floor((f - d) / 1000)); const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
  $$('[data-countdown]').forEach(e => e.textContent = `${p2(h)}:${p2(m)}:${p2(s)}`);
  const t = S.timer;
  if (t.laeuft) {
    t.rest--;
    if (t.modus === 'fokus' && t.rest % 60 === 0) t.heute++;
    if (t.rest <= 0) { t.laeuft = false; t.modus = t.modus === 'fokus' ? 'pause' : 'fokus'; t.rest = t.modus === 'fokus' ? 25 * 60 : 5 * 60; }
    zeichneTimer();
  }
  const tl = $('#timerStatus');
  tl.hidden = !t.laeuft || route().b === 'work-station';
  tl.innerHTML = t.laeuft ? `${ic('fokus')}<span>${t.modus === 'fokus' ? 'Fokus' : 'Pause'} <span class="zahl">${p2(Math.floor(t.rest / 60))}:${p2(t.rest % 60)}</span></span>` : '';
}
setInterval(takt, 1000);

/* ---------- Routing und Übergänge ---------- */
/* Übergang mit Richtung: Markierung gleitet, Inhalt kommt 12 px aus der Klickrichtung, Skelett erst ab 300 ms. */
const PARAM = new URLSearchParams(location.search);
let GESPEICHERT = {}; try { GESPEICHERT = JSON.parse(localStorage.getItem('uv-einstellung')) || {}; } catch (_) {}
const wahlAus = (k, erlaubt, std) => erlaubt.includes(PARAM.get(k)) ? PARAM.get(k) : erlaubt.includes(GESPEICHERT[k]) ? GESPEICHERT[k] : std;
/* Entschieden (Didi, 16.11., 22:35): Übergang mit Richtung, Anordnen im Hub, Personalisierung als eigene Seite, Design-Schalter standardmäßig aus */
const OPT = { ue: '2', last: wahlAus('last', ['schnell', 'normal', 'langsam'], 'normal'), schalter: wahlAus('schalter', ['an', 'aus'], 'aus') };
const LADEZEIT = { schnell: 80, normal: 450, langsam: 1500 }, SKELETT_AB = 300, SKELETT_MIN = 400;
function optSichern() {
  const p = new URLSearchParams(location.search); Object.entries(OPT).forEach(([k, v]) => p.set(k, v));
  try { history.replaceState(null, '', `${location.pathname}?${p}${location.hash}`); } catch (_) {}
  try { localStorage.setItem('uv-einstellung', JSON.stringify({ last: OPT.last, schalter: OPT.schalter })); } catch (_) {}
  document.documentElement.dataset.ue = OPT.ue; document.documentElement.dataset.schalter = OPT.schalter;
}
document.documentElement.dataset.ue = OPT.ue; document.documentElement.dataset.schalter = OPT.schalter;

function route() {
  const teile = (location.hash.replace(/^#\/?/, '') || 'hub').split('/');
  return { b: bereich(teile[0]) ? teile[0] : 'hub', a: teile[1], c: teile[2] };
}
const ansicht = $('#ansicht'), kontext = $('#kontext'), kMobil = $('#kontextMobil .innen-k');
const warte = ms => new Promise(r => setTimeout(r, ms));
const stdPfad = b => `${ic(b.i)}<span>${b.n}</span>`;
let letzterB = null, wechselNr = 0, aktVT = null;

function markiere(b) {
  $$('.rpunkt[data-b]').forEach(a => a.toggleAttribute('aria-current', a.dataset.b === b.s));
  $$('.mobilnav [data-b]').forEach(a => a.toggleAttribute('aria-current', a.dataset.b === b.s));
  if (BADGES[b.s]) { delete BADGES[b.s]; $(`.rpunkt[data-b="${b.s}"] .badge`)?.remove(); }
  document.title = `${b.n} · UniVerse`;
  const a = $(`.rpunkt[data-b="${b.s}"]`), m = $('.rmarker');
  if (!m) return;
  m.hidden = !a;
  if (a) { m.style.transform = `translateY(${a.offsetTop}px)`; if (!('bereit' in m.dataset)) requestAnimationFrame(() => requestAnimationFrame(() => { m.dataset.bereit = ''; })); }
}
function kontextSetzen(b, k) {
  kontext.innerHTML = `<div class="ktitel"><h2>${b.n}</h2></div><button class="suchpille breit" type="button" data-suche>${ic('suche')}<span>Suchen</span><kbd>⌘K</kbd></button>${k}`;
  kMobil.innerHTML = k;
  $('#kontextMobil summary span').textContent = KMOBIL[b.s] || 'Fächer';
}
function einsetzen(r, b, nav) {
  S.geladen.add(r.b);
  const { pfad, k, v, nach } = ansichtFuer(r, b);
  $('#pfad').innerHTML = pfad || stdPfad(b);
  kontextSetzen(b, k);
  ansicht.innerHTML = v; ansicht.removeAttribute('aria-busy');
  $('.flaeche').classList.remove('laedt');
  if (nav) { $('.flaeche').scrollTop = 0; window.scrollTo(0, 0); }
  nach && nach(); takt(); $$('[data-suche]').forEach(x => x.onclick = auf);
  steuerungAktualisieren();
  const sb = $('#studio .sd-sieht b'); if (sb) sb.textContent = studioSieht();
}
function skelettSetzen(r, b) {
  $('#pfad').innerHTML = stdPfad(b);
  kontextSetzen(b, '<div class="kskelett" aria-hidden="true"><i></i><i class="k"></i><i></i><i class="k"></i><i></i></div>');
  ansicht.innerHTML = skelettHtml(r.b); ansicht.setAttribute('aria-busy', 'true');
  $('.flaeche').classList.remove('laedt');
  $('.flaeche').scrollTop = 0; window.scrollTo(0, 0);
}
function einblenden() { ansicht.classList.remove('einblenden'); void ansicht.offsetWidth; ansicht.classList.add('einblenden'); }
function uebergang(fn, richtung = 'gleich') {
  const d = document.documentElement;
  if (OPT.ue === '0' || !document.startViewTransition || document.hidden) { fn(); if (OPT.ue !== '0' && !ruhig()) einblenden(); return; }
  d.dataset.richtung = OPT.ue === '2' ? richtung : 'gleich';
  d.toggleAttribute('data-gescrollt', ($('.flaeche').scrollTop || scrollY) > 8);
  const t = aktVT = document.startViewTransition(fn);
  t.finished.finally(() => { if (aktVT !== t) return; delete d.dataset.richtung; d.removeAttribute('data-gescrollt'); });
}
async function zeige(nav = false) {
  const r = route(), b = bereich(r.b);
  const von = letzterB ? ALLE.findIndex(x => x.s === letzterB) : -1, ziel = ALLE.indexOf(b);
  const richtung = von < 0 || ziel < 0 || von === ziel ? 'gleich' : ziel > von ? 'runter' : 'hoch';
  letzterB = r.b;
  markiere(b);
  const nr = ++wechselNr, aktuell = () => nr === wechselNr;
  if (!nav) { einsetzen(r, b, false); return; }
  const dauer = S.geladen.has(r.b) ? 0 : LADEZEIT[OPT.last];
  if (OPT.ue === '0') {
    if (dauer) { skelettSetzen(r, b); await warte(dauer); if (!aktuell()) return; }
    einsetzen(r, b, true); if (!ruhig()) einblenden(); return;
  }
  if (OPT.ue === '3' && von >= 0) {
    if (dauer) { $('#pfad').innerHTML = stdPfad(b); $('.flaeche').classList.add('laedt'); ansicht.setAttribute('aria-busy', 'true'); await warte(dauer); if (!aktuell()) return; }
    uebergang(() => einsetzen(r, b, true)); return;
  }
  if (dauer <= SKELETT_AB) {
    if (dauer) { await warte(dauer); if (!aktuell()) return; }
    uebergang(() => einsetzen(r, b, true), richtung); return;
  }
  await warte(SKELETT_AB); if (!aktuell()) return;
  uebergang(() => skelettSetzen(r, b), richtung);
  await warte(Math.max(dauer - SKELETT_AB, SKELETT_MIN)); if (!aktuell()) return;
  uebergang(() => einsetzen(r, b, true));
}
const KMOBIL = { hub: 'Hub-Bereiche, Semester und Fristen', 'work-station': 'Aufgaben nach Fach', karteikarten: 'Stapel nach Fach', notizen: 'Alle Notizen', pdf: 'Dokumente und Markierungen', dateiablage: 'Ordner', literatur: 'Sammlungen', transkription: 'Aufnahmen', lernraum: 'Quellen und Stand', chat: 'Gruppen', textverarbeitung: 'Gliederung', tabellen: 'Tabellen und Auswertung', praesentationen: 'Folien', mindmap: 'MindMaps', whiteboard: 'Boards', einstellungen: 'Einstellungen' };
addEventListener('hashchange', () => zeige(true));

/* Skelett in der Form dessen, was kommt */
const SKTYP = { hub: 'kopf', 'work-station': 'zwei', karteikarten: 'tabelle', notizen: 'text', pdf: 'blatt', dateiablage: 'tabelle', literatur: 'tabelle', transkription: 'tabelle', lernraum: 'zwei', chat: 'gespraech', textverarbeitung: 'text', tabellen: 'tabelle', praesentationen: 'blatt', mindmap: 'flaeche', whiteboard: 'flaeche', einstellungen: 'text' };
function skelettHtml(s) {
  const n = (k, cls = '') => Array.from({ length: k }, () => `<i class="${cls}"></i>`).join('');
  const kopf = '<div class="sk-gruppe"><i class="sk-titel"></i><i class="sk-kurz"></i></div>';
  const t = SKTYP[s] || 'kopf';
  const inhalt = {
    kopf: `${kopf}<i class="sk-knopf"></i><div class="sk-reihe">${n(3)}</div><div class="sk-gruppe">${n(5, 'sk-zeile')}</div>`,
    tabelle: `${kopf}<div class="sk-gruppe sk-tab">${n(6)}</div>`,
    text: `<div class="sk-spalte"><i class="sk-kurz"></i><i class="sk-titel"></i><div class="sk-gruppe">${n(6, 'sk-zeile')}</div></div>`,
    zwei: `<div class="sk-zwei"><i class="sk-rund"></i><div class="sk-gruppe sk-tab">${n(5)}</div></div>`,
    blatt: `<i class="sk-kurz"></i><i class="sk-blatt"></i>`,
    gespraech: `<div class="sk-spalte sk-chat"><i class="sk-blase ich"></i><i class="sk-blase"></i><i class="sk-blase ich"></i><i class="sk-blase lang"></i></div>`,
    flaeche: `${kopf}<i class="sk-blatt sk-breit"></i>`
  }[t];
  return `<div class="skelett sk-${t}" role="status" aria-label="Wird geladen">${inhalt}</div>`;
}

/* ---------- Bausteine ---------- */
const faecherK = (mitProzent = true) => `<section class="kgruppe" aria-label="Fächer"><h3 class="gt">Fächer</h3><ul class="kliste">${Object.entries(F).map(([k, [n, c]], i) => { const w = [72, 48, 61, 35][i]; return `<li><a class="keintrag" href="#/dateiablage/${k}" style="--c:var(--${c})"><span class="f"></span><span class="n">${n}<span class="balkenk" style="--c:var(--${c})"><i style="width:${w}%"></i></span></span>${mitProzent ? `<span class="z">${w} %</span>` : ''}</a></li>`; }).join('')}</ul></section>`;
const semesterK = () => { let w = ''; for (let i = 1; i <= 14; i++) w += `<li class="${i < 4 ? 'durch' : i === 4 ? 'jetzt' : i >= 13 ? 'pruefung' : ''}"${i === 4 ? ' aria-current="step"' : ''}><span class="zahl">${i}</span></li>`; return `<section class="semester" aria-labelledby="ks"><div class="skopf"><h3 class="gt" id="ks">Wintersemester</h3><span>Woche 4 von 14</span></div><ol class="streifen" aria-label="14 Wochen, Woche 4 läuft, Prüfungen in Woche 13 und 14">${w}</ol><p class="legende"><span><i class="l-jetzt"></i>jetzt</span><span><i class="l-pr"></i>Prüfungen</span></p></section>`; };
const fristenK = () => `<section class="kgruppe" aria-label="Fristen"><h3 class="gt">Fristen</h3><ul class="kliste">${[['ml', 'Statistik-Übung', 'morgen, 23:59', 'W4', '#/pdf/uebung3'], ['vt', 'Referat VT', '9. Dezember', 'W9', '#/notizen/vt-gruppe'], ['kp', 'Klausur Klinische', '3. Februar', 'W13', '#/karteikarten']].map(([f, t, s, w, h]) => `<li><a class="keintrag" href="${h}" style="--c:var(--${F[f][1]})"><span class="f"></span><span class="n">${t}<small>${s}</small></span><span class="z">${w}</span></a></li>`).join('')}</ul></section>`;
const seitenkopf = (h, p, rechts = '') => `<header class="seitenkopf"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>${rechts ? `<div class="rechts">${rechts}</div>` : ''}</header>`;
const woerter = (txt, start = 140) => txt.split(' ').map((w, i) => `<span style="animation-delay:${start + i * 22}ms">${esc(w)}</span>`).join(' ');

/* ---------- Ansichten ---------- */
const VIEWS = {};

const BAUSTEINE = { naechstes: 'Als Nächstes', fakten: 'Überblick', vorschlag: 'Dein Tag', heute: 'Heute', wiederholen: 'Wiederholen', woche: 'Diese Woche' };
/* Hub-Raster mit drei Spalten. Größen wie bei iOS-Widgets und Home Assistant: feste Stufen statt freiem Skalieren.
   S = ein Drittel, M = zwei Drittel, L = volle Breite. Jeder Baustein erlaubt nur Größen, in denen sein Inhalt funktioniert. */
const SPANNE = { S: 1, M: 2, L: 3 };
const GROESSEN = { naechstes: ['M', 'L'], fakten: ['M', 'L'], heute: ['M', 'L'], vorschlag: ['S', 'M', 'L'], wiederholen: ['S', 'M'], woche: ['M', 'L'] };
const GR_NAME = { S: 'schmal', M: 'mittel', L: 'breit' };
const VOREIN = {
  fokus: [['naechstes', 1, 'L'], ['heute', 1, 'M'], ['vorschlag', 1, 'S'], ['fakten', 0, 'L'], ['woche', 0, 'L'], ['wiederholen', 0, 'S']],
  ausgewogen: [['naechstes', 1, 'L'], ['fakten', 1, 'L'], ['heute', 1, 'M'], ['vorschlag', 1, 'S'], ['woche', 1, 'L'], ['wiederholen', 0, 'S']],
  alles: [['naechstes', 1, 'L'], ['fakten', 1, 'M'], ['wiederholen', 1, 'S'], ['heute', 1, 'M'], ['vorschlag', 1, 'S'], ['woche', 1, 'L']]
};
const kopie = l => l.map(x => [...x]);
const layoutLaden = () => { try { const l = JSON.parse(localStorage.getItem('uv-hub-layout-3')); if (Array.isArray(l) && l.length === 6 && l.every(x => GROESSEN[x[0]] && GROESSEN[x[0]].includes(x[2]))) return l; } catch (_) {} return kopie(VOREIN.ausgewogen); };
S.hub = layoutLaden(); S.planExtra = []; S.bearbeiten = false; S.undo = [];
const layoutSichern = () => { try { localStorage.setItem('uv-hub-layout-3', JSON.stringify(S.hub)); } catch (_) {} };
const vorher = () => { S.undo.push(JSON.stringify(S.hub)); if (S.undo.length > 30) S.undo.shift(); };
const tagesGruss = () => { const h = new Date().getHours(); return `${h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'}, Didi. Morgen ist die Statistik-Abgabe, deshalb steht Regression heute zuerst.`; };
const VORSCHLAEGE = [['15:30', '15:55', 'f2', 'Regression wiederholen', '6 Karten fällig, passt vor die Statistik-Übung'], ['17:45', '18:05', 'f3', 'Testgütekriterien, Runde 2', 'heute schon gelernt, Abstand von drei Stunden'], ['20:15', '20:40', 'f4', 'Referat VT gliedern', 'Abgabe in Woche 9, noch kein Entwurf']];

function hubBlock(id) {
  if (id === 'naechstes') return `<section class="kopf" aria-labelledby="h"><span class="bahn" aria-hidden="true"></span><span class="planet" aria-hidden="true"></span>
    <div class="kopf-text"><h1 id="h">Statistik-Übung abgeben.</h1><p class="unter"><i aria-hidden="true"></i>Methodenlehre, morgen um 23:59 fällig.</p>
    <div class="aktionen"><button class="knopf haupt" type="button" id="fokusStart">${ic('fokus')}Fokus starten</button><a class="knopf neben" href="#/pdf/uebung3">${ic('pdf')}Übungsblatt öffnen</a></div></div>
    <div class="rest"><div class="zahl" data-countdown>00:00:00</div><p>bis zur Abgabe</p></div></section>`;
  if (id === 'fakten') return `<section class="fakten" aria-label="Überblick">
      <div class="fakt" style="--c:var(--f3)"><div class="zahl">24</div><p><b>Karteikarten</b> heute fällig, davon <b>6</b> neu in Diagnostik.</p></div>
      <div class="fakt" style="--c:var(--f4)"><div class="zahl">3</div><p><b>Termine</b> heute, der nächste um <b>14:00</b> in der Bibliothek.</p></div>
      <div class="fakt" style="--c:var(--akzent)"><div class="zahl">12</div><p><b>Tage in Folge</b> gelernt, heute schon <b data-fokusheute>${S.timer.heute}</b> <b>Minuten</b>.</p></div></section>`;
  if (id === 'vorschlag') {
    const offen = VORSCHLAEGE.filter((_, i) => !S.planExtra.includes(i));
    return `<section class="vorschlag" aria-labelledby="tv"><div class="kopfzeile"><h2 id="tv">Dein Tag</h2><button class="link rechts" type="button" data-studio="Plan mit mir meinen Tag: Was sollte ich heute in welcher Reihenfolge machen, mit Zeiten?">${ic('funke')}Mit Studio planen</button></div><p class="tb-gruss">${tagesGruss()}</p>
      ${offen.length ? `<ul class="vliste">${VORSCHLAEGE.map(([a, e, c, t, w], i) => S.planExtra.includes(i) ? '' : `<li><span class="zeit">${a}<small>${e}</small></span><span class="balken" style="--c:var(--${c})"></span><div><strong>${t}</strong><span class="meta">${w}</span><button class="knopf neben klein" type="button" data-v="${i}">${ic('plus')}Einplanen</button></div></li>`).join('')}</ul>
      <div class="vfuss"><button class="knopf leise klein" type="button" id="alleEinplanen">Alle einplanen</button></div>`
      : '<p class="vleer">Alle Vorschläge sind eingeplant. Morgen früh gibt es neue.</p>'}</section>`;
  }
  if (id === 'heute') {
    const plan = [['08:30', '09:15', 'f1', 'Karteikarten Klinische', '40 Karten', 'erledigt', 'vorbei'], ['10:00', '11:30', 'f4', 'Lerngruppe VT', 'Bibliothek 2.14, mit Lea und Jonas', 'vorbei', 'vorbei'], ['14:00', '14:20', 'f3', 'Karteikarten Diagnostik', '24 fällig, etwa 18 Minuten', 'als Nächstes', 'jetzt'], ['16:00', '17:30', 'f2', 'Statistik-Übung, Aufgabe 3', 'Fokusblock in der Work Station', 'geplant', ''], ['19:00', '20:00', 'f1', 'Vorlesung nacharbeiten', 'Klinische Psychologie, Folien 12 bis 30', 'geplant', '']];
    S.planExtra.forEach(i => { const [a, e, c, t] = VORSCHLAEGE[i]; plan.push([a, e, c, t, 'aus dem Vorschlag', 'neu', 'neu']); });
    plan.sort((x, y) => x[0].localeCompare(y[0]));
    return `<section class="heute" aria-labelledby="t1"><div class="kopfzeile"><h2 id="t1">Heute</h2><span class="info" data-tag></span></div>
      <ul class="plan">${plan.map(([a, e, c, t, m, z, k]) => `<li class="${k}">${k === 'jetzt' ? '<span class="jetztlinie" aria-hidden="true"></span>' : ''}<span class="zeit">${a}<small>${e}</small></span><span class="balken" style="--c:var(--${c})"></span><div><strong>${t}</strong><span class="meta">${m}</span></div><span class="zustand">${z}</span></li>`).join('')}</ul></section>`;
  }
  if (id === 'wiederholen') return `<section class="wiederholen" aria-labelledby="t4"><div class="kopfzeile"><h2 id="t4">Wiederholen</h2><span class="info" id="hubKarteInfo"></span><a class="link rechts" href="#/karteikarten/lernen/testguete">Ganzer Stapel</a></div><div class="karte3" id="hubKarte"></div></section>`;
  if (id === 'woche') {
    const zeilen = [['08:30', [['f1', 'Klinische', 'Hörsaal 1'], 0, ['f3', 'Diagnostik', 'Raum 3.04'], 0, 0]], ['10:15', [['f4', 'Lerngruppe VT', 'Bibliothek'], ['f2', 'Methoden', 'Hörsaal 2'], 0, ['f4', 'VT', 'Seminar'], 0]], ['14:00', [['f3', 'Karteikarten', '18 min'], 0, 0, 0, ['f1', 'Klinische', 'Übung']]], ['16:00', [['f2', 'Statistik-Übung', 'Fokusblock'], 0, ['f2', 'Statistik', 'PC-Pool'], 0, 0]]];
    let raster = '<span class="k"></span>' + ['Mo 16', 'Di 17', 'Mi 18', 'Do 19', 'Fr 20'].map((t, d) => `<span class="k${d ? '' : ' heute'}">${t}</span>`).join('');
    zeilen.forEach(([z, zs]) => { raster += `<span class="t">${z}</span>` + zs.map((c, d) => c ? `<span class="z${d ? '' : ' heute'}" style="--c:var(--${c[0]})">${c[1]}<small>${c[2]}</small></span>` : `<span class="${d ? '' : 'heute'}"></span>`).join(''); });
    return `<section class="woche-ab" aria-labelledby="t5"><div class="kopfzeile"><h2 id="t5">Diese Woche</h2><span class="info">Woche 4 von 14</span><button class="knopf leise klein rechts" type="button" id="wocheAus">Ausblenden</button></div><div class="raster-rahmen"><div class="plan-raster" role="table" aria-label="Stundenplan dieser Woche">${raster}</div></div></section>`;
  }
  return '';
}
/* Raster berechnen: Spalte und Zeile je Baustein, damit Trennlinien nur zwischen Bausteinen liegen */
function rasterPlan(liste) {
  let spalte = 0, zeile = 0;
  const plan = liste.map(([id, , gr]) => { const n = SPANNE[gr]; if (spalte + n > 3) { spalte = 0; zeile++; } const p = { id, gr, spalte, zeile, n, frei: 0 }; spalte += n; if (spalte >= 3) { spalte = 0; zeile++; } return p; });
  plan.forEach((p, i) => { const naechste = plan[i + 1]; if (!naechste || naechste.zeile !== p.zeile) p.frei = 3 - p.spalte - p.n; });
  return plan;
}
function hubInhalt() {
  const an = S.hub.filter(([, a]) => a);
  if (!an.length && !S.bearbeiten) return `<div class="leer"><div><h1>Alle Bausteine sind ausgeblendet.</h1><p>Über „Anpassen“ holst du sie zurück.</p></div></div>`;
  const plan = rasterPlan(an);
  const bloecke = plan.map(p => {
    const inhalt = hubBlock(p.id);
    if (!S.bearbeiten) return `<div class="block" data-id="${p.id}" style="--span:${p.n + p.frei}" data-spalte="${p.spalte}" data-zeile="${p.zeile}">${inhalt}</div>`;
    const i = S.hub.findIndex(([id]) => id === p.id), name = BAUSTEINE[p.id], pos = an.findIndex(([id]) => id === p.id);
    return `<div class="block bearb${S.drag === p.id ? ' zieht' : ''}${S.tastatur === p.id ? ' aufgenommen' : ''}" data-id="${p.id}" style="--span:${p.n}" data-spalte="${p.spalte}" data-zeile="${p.zeile}">
      <div class="bwerk"><button class="griff" type="button" data-griff="${p.id}" aria-describedby="dndHilfe" aria-label="${name} verschieben, Position ${pos + 1} von ${an.length}">${ic('griff')}</button><span class="bname">${name}</span>
        <span class="segment gr" role="group" aria-label="Breite von ${name}">${GROESSEN[p.id].map(g => `<button type="button" data-gr="${g}" data-fuer="${p.id}" aria-pressed="${g === p.gr}" aria-label="${GR_NAME[g]}">${g}</button>`).join('')}</span>
        <span class="bwerk-rechts"><button class="symbolknopf" type="button" data-schieb="-1" data-fuer="${p.id}" aria-label="${name} nach vorn"${pos === 0 ? ' disabled' : ''}>${ic('links')}</button><button class="symbolknopf" type="button" data-schieb="1" data-fuer="${p.id}" aria-label="${name} nach hinten"${pos === an.length - 1 ? ' disabled' : ''}>${ic('pfeil')}</button><button class="symbolknopf" type="button" data-weg="${i}" aria-label="${name} ausblenden">${ic('auge')}</button></span></div>
      <div class="binhalt" inert>${inhalt}</div></div>${p.frei ? `<div class="frei" style="--span:${p.frei}"><p>Freier Platz. Im Hub wird ${name} so breit, dass die Zeile voll ist.</p></div>` : ''}`;
  }).join('');
  const raster = `<div class="hubraster${S.bearbeiten ? ' im-bearb' : ''}">${bloecke}</div>`;
  if (!S.bearbeiten) return raster;
  const aus = S.hub.filter(([, a]) => !a);
  const vor = Object.entries(VOREIN).find(([, l]) => JSON.stringify(l) === JSON.stringify(S.hub));
  return `<div class="bearbleiste"><div><strong>Hub anordnen</strong><span>Am Griff ziehen oder mit Pfeilen verschieben. Breite über S, M und L.</span></div>
      <div class="segment" role="group" aria-label="Voreinstellung">${[['fokus', 'Ruhig'], ['ausgewogen', 'Ausgewogen'], ['alles', 'Alles']].map(([k, n]) => `<button type="button" data-vor="${k}" aria-pressed="${!!vor && vor[0] === k}">${n}</button>`).join('')}</div>
      <button class="knopf leise klein" type="button" id="rueck"${S.undo.length ? '' : ' disabled'}>${ic('zurueck')}Rückgängig</button><button class="knopf haupt klein" type="button" id="fertig">Fertig</button></div>
    <p class="vh" id="dndHilfe">Leertaste nimmt den Baustein auf. Pfeiltasten verschieben ihn, Leertaste legt ihn ab, Escape bricht ab.</p>
    ${raster}
    <div class="ablage" aria-label="Ausgeblendete Bausteine"><span class="info">${aus.length ? 'Ausgeblendet' : 'Alle Bausteine sind sichtbar.'}</span>${aus.map(([id]) => `<button class="knopf leise klein" type="button" data-ein="${S.hub.findIndex(([x]) => x === id)}">${ic('plus')}${BAUSTEINE[id]}</button>`).join('')}</div>`;
}
function hubVerdrahten() {
  $('#fokusStart') && ($('#fokusStart').onclick = () => { S.timer.aufgabe = 1; S.timer.modus = 'fokus'; S.timer.laeuft = true; location.hash = '#/work-station'; });
  $$('[data-v]').forEach(b => b.onclick = () => { S.planExtra.push(+b.dataset.v); hubNeu(); });
  $('#alleEinplanen') && ($('#alleEinplanen').onclick = () => { VORSCHLAEGE.forEach((_, i) => { if (!S.planExtra.includes(i)) S.planExtra.push(i); }); hubNeu(); });
  $('#wocheAus') && ($('#wocheAus').onclick = () => { vorher(); S.hub.find(([id]) => id === 'woche')[1] = 0; layoutSichern(); umordnen(); $('#anpassenKnopf')?.focus(); ansage('Diese Woche ausgeblendet. Über „Anpassen“ holst du sie zurück.'); });
  hubKarte(); takt();
  if (!S.bearbeiten) return;
  const box = $('#hubBox');
  $$('[data-gr]', box).forEach(b => b.onclick = () => { const e = S.hub.find(([id]) => id === b.dataset.fuer); if (e[2] === b.dataset.gr) return; vorher(); e[2] = b.dataset.gr; aendern(`${BAUSTEINE[e[0]]} ist jetzt ${GR_NAME[e[2]]}.`, `[data-gr="${b.dataset.gr}"][data-fuer="${e[0]}"]`); });
  $$('[data-schieb]', box).forEach(b => b.onclick = () => { vorher(); schieben(b.dataset.fuer, +b.dataset.schieb); aendern(positionText(b.dataset.fuer), `[data-schieb="${b.dataset.schieb}"][data-fuer="${b.dataset.fuer}"]:not(:disabled)`, `[data-griff="${b.dataset.fuer}"]`); });
  $$('[data-weg]', box).forEach(b => b.onclick = () => { vorher(); const e = S.hub[+b.dataset.weg]; e[1] = 0; aendern(`${BAUSTEINE[e[0]]} ausgeblendet.`, '#fertig'); });
  $$('[data-ein]', box).forEach(b => b.onclick = () => { vorher(); const e = S.hub[+b.dataset.ein]; e[1] = 1; aendern(`${BAUSTEINE[e[0]]} wieder eingeblendet.`, `[data-griff="${e[0]}"]`); });
  $$('[data-vor]', box).forEach(b => b.onclick = () => { vorher(); S.hub = kopie(VOREIN[b.dataset.vor]); aendern(`Voreinstellung ${b.textContent}.`, `[data-vor="${b.dataset.vor}"]`); });
  $('#rueck').onclick = rueckgaengig;
  $('#fertig').onclick = bearbeitenAus;
  $$('[data-griff]', box).forEach(g => { g.onpointerdown = e => ziehStart(e, HUB_ZIEH, g.dataset.griff); g.onkeydown = e => tasteZiehen(e, HUB_ZIEH, g.dataset.griff); });
}
function hubNeu() { const box = $('#hubBox'); if (!box) return; box.innerHTML = hubInhalt(); hubVerdrahten(); }
/* Umordnen mit FLIP: Bausteine gleiten an ihren neuen Platz, statt zu springen */
function umordnen(fokus) { flip('#hubBox', '.block[data-id]', hubNeu); if (fokus) $(fokus)?.focus(); }
function aendern(text, ...fokus) { layoutSichern(); umordnen(); for (const f of fokus) { const el = $(`#hubBox ${f}`); if (el) { el.focus(); break; } } if (text) ansage(text); }
function rueckgaengig() { const z = S.undo.pop(); if (!z) return; S.hub = JSON.parse(z); aendern('Rückgängig gemacht.', '#rueck:not(:disabled)', '#fertig'); }
function schieben(id, d) {
  const an = S.hub.filter(([, a]) => a).map(([x]) => x), pos = an.indexOf(id), ziel = an[pos + d];
  if (!ziel) return false;
  const i = S.hub.findIndex(([x]) => x === id), j = S.hub.findIndex(([x]) => x === ziel);
  [S.hub[i], S.hub[j]] = [S.hub[j], S.hub[i]]; return true;
}
const positionText = id => { const an = S.hub.filter(([, a]) => a).map(([x]) => x); return `${BAUSTEINE[id]}, Position ${an.indexOf(id) + 1} von ${an.length}.`; };
function bearbeitenAn() { S.bearbeiten = true; S.undo = []; uebergang(() => { $('#pfad').innerHTML = hubPfad(); hubNeu(); $('#anpassenKnopf') && ($('#anpassenKnopf').onclick = bearbeitenAus); }); setTimeout(() => $('#hubBox [data-griff]')?.focus(), 260); ansage('Bearbeiten-Modus. Bausteine lassen sich verschieben, in der Breite ändern und ausblenden.'); }
function bearbeitenAus() { S.bearbeiten = false; S.tastatur = null; layoutSichern(); uebergang(() => { $('#pfad').innerHTML = hubPfad(); hubNeu(); $('#anpassenKnopf') && ($('#anpassenKnopf').onclick = anpassenStart); }); setTimeout(() => $('#anpassenKnopf')?.focus(), 260); ansage('Anordnung gespeichert.'); }
const hubPfad = () => S.bearbeiten ? `${ic('hub')}<span>Hub anordnen</span>` : `${ic('hub')}<span>Zentraler Hub</span><button class="knopf leise klein anp-knopf" type="button" id="anpassenKnopf" aria-label="Hub anpassen">${ic('raster')}<span>Anpassen</span></button>`;
const anpassenStart = () => bearbeitenAn();

addEventListener('keydown', e => {
  if (S.bearbeiten && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); rueckgaengig(); }
});
addEventListener('hashchange', () => { if (S.bearbeiten) { S.bearbeiten = false; S.tastatur = null; layoutSichern(); } });

VIEWS.hub = () => ({
  pfad: hubPfad(),
  k: semesterK() + faecherK() + fristenK(),
  v: `<div id="hubBox">${hubInhalt()}</div>`,
  nach: () => { hubVerdrahten(); $('#anpassenKnopf') && ($('#anpassenKnopf').onclick = S.bearbeiten ? bearbeitenAus : anpassenStart); if (S.nachHub) { S.nachHub = false; setTimeout(anpassenStart, 120); } }
});

/* ---------- Ziehen und Ablegen: eine Maschine für Hub, Panel und Symbolleiste ----------
   Maus und Touch über Pointer-Events am Griff, Tastatur über Leertaste und Pfeile (Muster von dnd-kit),
   Ansagen über eine Live-Region. Alternative ohne Ziehen: Pfeil-Knöpfe (WCAG 2.2, 2.5.7). */
const ansage = t => { const a = $('#ansage'); if (!a) return; a.textContent = ''; setTimeout(() => { a.textContent = t; }, 60); };
function flip(container, sel, fn) {
  const vor = new Map(); $$(sel, $(container) || document).forEach(el => vor.set(el.dataset.id, el.getBoundingClientRect()));
  fn();
  if (ruhig()) return;
  $$(sel, $(container) || document).forEach(el => { const a = vor.get(el.dataset.id); if (!a) return; const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return; el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.22,.9,.24,1)' }); });
}
const HUB_ZIEH = {
  name: id => BAUSTEINE[id], liste: () => S.hub.filter(([, a]) => a).map(([x]) => x),
  setzen: (id, nachId, davor) => { const i = S.hub.findIndex(([x]) => x === id), e = S.hub.splice(i, 1)[0]; let j = S.hub.findIndex(([x]) => x === nachId); if (!davor) j++; S.hub.splice(j, 0, e); },
  schritt: (id, d) => schieben(id, d), sichern: () => layoutSichern(),
  zeichnen: () => umordnen(), container: '#hubBox', sel: '.block[data-id]', achse: 'raster', merken: vorher,
  info: id => { const e = S.hub.find(([x]) => x === id); return `${BAUSTEINE[id]}, Breite ${e[2]}`; },
  laden: () => JSON.stringify(S.hub), zurueck: z => { S.hub = JSON.parse(z); }
};
function ziehStart(e, M, id) {
  if (e.button !== 0 || S.tastatur) return;
  e.preventDefault();
  const x0 = e.clientX, y0 = e.clientY, start = M.laden(); let laeuft = false, geist = null, letzte = 0, rolle = 0, px = x0, py = y0;
  const scrollFlaeche = () => { if (!laeuft) return; const f = $('.flaeche'), r = f.getBoundingClientRect(), rand = 64; const d = py < r.top + rand + 52 ? -10 : py > r.bottom - rand ? 10 : 0; if (d) { f.scrollTop += d; window.scrollBy(0, d); } rolle = requestAnimationFrame(scrollFlaeche); };
  const bewegen = ev => {
    px = ev.clientX; py = ev.clientY;
    if (!laeuft) { if (Math.hypot(px - x0, py - y0) < 5) return; laeuft = true; M.merken(); S.drag = id; M.zeichnen(); document.body.classList.add('am-ziehen'); geist = document.createElement('div'); geist.className = 'geist'; geist.setAttribute('aria-hidden', 'true'); geist.innerHTML = `${ic('griff')}<span>${M.info(id)}</span>`; document.body.append(geist); rolle = requestAnimationFrame(scrollFlaeche); ansage(`${M.name(id)} aufgenommen.`); }
    geist.style.transform = `translate(${px + 12}px,${py + 12}px)`;
    pruefen(false);
  };
  const pruefen = immer => {
    if (!immer && performance.now() - letzte < 90) return;
    const ziel = document.elementFromPoint(px, py)?.closest(M.sel);
    if (!ziel || ziel.dataset.id === id || !$(M.container)?.contains(ziel)) return;
    const r = ziel.getBoundingClientRect();
    const quer = M.achse === 'raster' && r.width < $(M.container).getBoundingClientRect().width * .9;
    const davor = quer ? px < r.left + r.width / 2 : py < r.top + r.height / 2;
    const liste = M.liste(), vorherIdx = liste.indexOf(id);
    M.setzen(id, ziel.dataset.id, davor);
    if (M.liste().indexOf(id) === vorherIdx) return;
    letzte = performance.now(); M.zeichnen();
  };
  const ende = abbruch => {
    removeEventListener('pointermove', bewegen); removeEventListener('pointerup', hoch); removeEventListener('keydown', esc, true); cancelAnimationFrame(rolle);
    geist?.remove(); document.body.classList.remove('am-ziehen');
    if (!laeuft) return;
    if (abbruch) M.zurueck(start);
    S.drag = null; M.sichern(); M.zeichnen();
    $(`${M.container} [data-griff="${id}"]`)?.focus();
    ansage(abbruch ? `Abgebrochen. ${M.name(id)} ist wieder an seinem Platz.` : `${M.name(id)} abgelegt auf Position ${M.liste().indexOf(id) + 1} von ${M.liste().length}.`);
  };
  const hoch = () => { if (laeuft) pruefen(true); ende(false); }, esc = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); ende(true); } };
  addEventListener('pointermove', bewegen); addEventListener('pointerup', hoch); addEventListener('keydown', esc, true);
}
let tastStart = null;
function tasteZiehen(e, M, id) {
  const k = e.key;
  if (!S.tastatur && (k === ' ' || k === 'Enter')) { e.preventDefault(); S.tastatur = id; tastStart = M.laden(); M.merken(); M.zeichnen(); $(`${M.container} [data-griff="${id}"]`)?.focus(); ansage(`${M.name(id)} aufgenommen. Position ${M.liste().indexOf(id) + 1} von ${M.liste().length}. Pfeiltasten verschieben, Leertaste legt ab, Escape bricht ab.`); return; }
  if (S.tastatur !== id) return;
  if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(k)) {
    e.preventDefault();
    const d = k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 1;
    if (M.schritt(id, d)) { M.zeichnen(); $(`${M.container} [data-griff="${id}"]`)?.focus(); ansage(`Position ${M.liste().indexOf(id) + 1} von ${M.liste().length}.`); }
    return;
  }
  if (k === ' ' || k === 'Enter' || k === 'Escape' || k === 'Tab') {
    if (k !== 'Tab') e.preventDefault();
    if (k === 'Escape') { e.stopPropagation(); M.zurueck(tastStart); }
    S.tastatur = null; M.sichern(); M.zeichnen(); $(`${M.container} [data-griff="${id}"]`)?.focus();
    ansage(k === 'Escape' ? `Abgebrochen. ${M.name(id)} ist wieder an seinem Platz.` : `${M.name(id)} abgelegt auf Position ${M.liste().indexOf(id) + 1} von ${M.liste().length}.`);
  }
}

function hubKarte() {
  const box = $('#hubKarte'); if (!box) return;
  const k = KARTEN.testguete, i = S.hubKarte;
  if (i >= 3) { $('#hubKarteInfo').textContent = 'Diagnostik'; box.innerHTML = `<p class="frage">Drei Karten geschafft. 21 sind heute noch fällig.</p><div class="aktionen"><a class="knopf neben klein" href="#/karteikarten/lernen/testguete">Weiter im Lernmodus</a><button class="knopf leise klein" type="button" id="hubNochmal">Von vorn</button></div>`; $('#hubNochmal').onclick = () => { S.hubKarte = 0; hubKarte(); }; return; }
  $('#hubKarteInfo').textContent = `Diagnostik, Karte ${i + 1} von 3`;
  box.innerHTML = `<p class="frage">${esc(k[i][0])}</p><button class="knopf leise klein aufdecken" type="button">Antwort zeigen<kbd>Leertaste</kbd></button><div class="bewerten" role="group" aria-label="Wie gut wusstest du es?">${['Nochmal|1 min', 'Schwer|6 min', 'Gut|1 Tag', 'Einfach|4 Tage'].map((x, j) => `<button type="button"${j === 2 ? ' class="gut"' : ''} disabled data-r="${j + 1}">${x.split('|')[0]}<small>${x.split('|')[1]}</small></button>`).join('')}</div>`;
  const auf = $('.aufdecken', box);
  auf.onclick = () => { $('.frage', box).insertAdjacentHTML('beforeend', `<span class="antwort">${esc(k[i][1])}</span>`); auf.hidden = true; $$('.bewerten button', box).forEach(b => b.disabled = false); $('.bewerten .gut', box).focus(); };
  $$('.bewerten button', box).forEach(b => b.onclick = () => { S.hubKarte++; hubKarte(); });
}

VIEWS['work-station'] = () => {
  const offen = AUFGABEN.filter(a => !a.fertig).length;
  const proFach = Object.keys(F).map(f => [f, AUFGABEN.filter(a => a.f === f && !a.fertig).length]);
  return {
    k: `<section class="kgruppe" aria-label="Offene Aufgaben nach Fach"><h3 class="gt">Offen nach Fach</h3><ul class="kliste">${proFach.map(([f, n]) => `<li><span class="keintrag" style="--c:var(--${F[f][1]})"><span class="f"></span><span class="n">${F[f][0]}</span><span class="z">${n}</span></span></li>`).join('')}</ul></section>
      <section class="kgruppe" aria-label="Diese Woche"><h3 class="gt">Fokus diese Woche</h3><ul class="kliste"><li><span class="keintrag"><span class="f" style="--c:var(--akzent)"></span><span class="n">Gesamt</span><span class="z">5 h 12 min</span></span></li><li><span class="keintrag"><span class="f" style="--c:var(--akzent)"></span><span class="n">Längster Block</span><span class="z">50 min</span></span></li></ul></section>`,
    v: `<div class="ws"><section class="ws-timer" aria-label="Fokus-Timer">
        <div class="modi" role="group" aria-label="Modus"><button type="button" data-m="fokus">Fokus 25</button><button type="button" data-m="pause">Pause 5</button></div>
        <div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" stroke-dasharray="339.3"/></svg><div class="mitte"><div><b id="tZeit" role="timer" aria-live="off">25:00</b><small id="tModus">Fokus</small></div></div></div>
        <div class="ws-aufgabe"><small>Aktuelle Aufgabe</small><strong id="tAufgabe"></strong></div>
        <div class="ws-steuer"><button class="knopf haupt" type="button" id="tStart"></button><button class="knopf leise" type="button" id="tReset">${ic('zurueck')}Zurücksetzen</button></div>
      </section>
      <section class="ws-liste" aria-labelledby="ta"><div class="kopfzeile"><h2 id="ta">Aufgaben heute</h2><span class="info">${offen} offen</span></div><ul class="aufgaben" id="aufgaben"></ul></section></div>
      <section aria-labelledby="tw"><div class="kopfzeile"><h2 id="tw">Fokus diese Woche</h2><span class="info">heute <span class="zahl" data-fokusheute>${S.timer.heute}</span> Minuten</span></div>
      <div class="wochenbalken" aria-label="Fokusminuten pro Tag">${[['Mo', 1, 48], ['Di', 0, 72], ['Mi', 0, 95], ['Do', 0, 40], ['Fr', 0, 0], ['Sa', 0, 0], ['So', 0, 57]].map(([t, h, m], i) => `<div class="${i === 0 ? 'heute' : ''}"><i style="height:${Math.max(2, m)}%"></i>${t}</div>`).join('')}</div></section>`,
    nach: () => { $$('.modi button').forEach(b => b.onclick = () => { const t = S.timer; t.laeuft = false; t.modus = b.dataset.m; t.rest = t.modus === 'fokus' ? 1500 : 300; zeichneTimer(); }); $('#tStart').onclick = () => { S.timer.laeuft = !S.timer.laeuft; zeichneTimer(); }; $('#tReset').onclick = () => { const t = S.timer; t.laeuft = false; t.rest = t.modus === 'fokus' ? 1500 : 300; zeichneTimer(); }; aufgabenListe(); zeichneTimer(); }
  };
};
function zeichneTimer() {
  const t = S.timer, z = $('#tZeit'); $$('[data-fokusheute]').forEach(e => e.textContent = t.heute); if (!z) return;
  const voll = t.modus === 'fokus' ? 1500 : 300;
  z.textContent = `${p2(Math.floor(t.rest / 60))}:${p2(t.rest % 60)}`;
  $('#tModus').textContent = t.modus === 'fokus' ? (t.laeuft ? 'Fokus läuft' : 'Fokus') : (t.laeuft ? 'Pause läuft' : 'Pause');
  $('.ring .fg').style.strokeDashoffset = (339.3 * (1 - t.rest / voll)).toFixed(1);
  $('#tStart').innerHTML = t.laeuft ? `${ic('pause')}Pausieren` : `${ic('play')}${t.rest < voll ? 'Fortsetzen' : 'Starten'}`;
  $$('.modi button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === t.modus));
  const a = AUFGABEN.find(x => x.id === t.aufgabe); $('#tAufgabe').textContent = a ? a.t : 'Keine Aufgabe gewählt';
}
function aufgabenListe() {
  const ul = $('#aufgaben'); if (!ul) return;
  ul.innerHTML = AUFGABEN.map(a => `<li class="${a.fertig ? 'fertig' : ''}${a.id === S.timer.aufgabe ? ' aktiv' : ''}"><button class="haken" type="button" aria-pressed="${a.fertig}" aria-label="${esc(a.t)} erledigt" data-id="${a.id}">${ic('haken')}</button><span class="balken" style="--c:var(--${F[a.f][1]})"></span><div><strong>${esc(a.t)}</strong><small>${F[a.f][0]}, etwa ${a.min} min</small></div>${a.fertig ? '' : `<button class="knopf leise klein waehlen" type="button" data-w="${a.id}">${a.id === S.timer.aufgabe ? 'Aktuell' : 'Als Fokus'}</button>`}</li>`).join('');
  $$('.haken', ul).forEach(b => b.onclick = () => { const a = AUFGABEN.find(x => x.id == b.dataset.id); a.fertig = !a.fertig; aufgabenListe(); });
  $$('[data-w]', ul).forEach(b => b.onclick = () => { S.timer.aufgabe = +b.dataset.w; aufgabenListe(); zeichneTimer(); });
}

VIEWS.karteikarten = r => {
  const kK = `<section class="kgruppe" aria-label="Fällig nach Fach"><h3 class="gt">Fällig nach Fach</h3><ul class="kliste">${STAPEL.map(s => `<li><a class="keintrag" href="#/karteikarten/lernen/${s.id}" style="--c:var(--${F[s.f][1]})"${r.c === s.id ? ' aria-current="page"' : ''}><span class="f"></span><span class="n">${s.n}<small>${F[s.f][0]}</small></span><span class="z${s.faellig ? ' akz' : ''}">${s.faellig}</span></a></li>`).join('')}</ul></section>`;
  if (r.a === 'lernen') return lernAnsicht(r.c, kK);
  const summe = STAPEL.reduce((a, s) => a + s.faellig, 0);
  return {
    k: kK,
    v: seitenkopf('Karteikarten', `${summe} Karten sind heute fällig, aus ${STAPEL.filter(s => s.faellig).length} Stapeln.`, `<a class="knopf haupt" href="#/karteikarten/lernen/testguete">${ic('play')}Alle fälligen lernen</a><button class="knopf leise" type="button">${ic('plus')}Neuer Stapel</button>`) +
      `<div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Stapel</th><th scope="col">Fach</th><th scope="col" class="num weg">Karten</th><th scope="col" class="num">Fällig</th><th scope="col"><span class="vh">Aktion</span></th></tr></thead><tbody>${STAPEL.map(s => `<tr class="stapelzeile"><td><span class="name"><span class="ico">${ic('karten')}</span><span>${s.n}${S.uebernommen[s.id] ? `<small>${S.uebernommen[s.id]} neu aus Notizen</small>` : ''}</span></span></td><td>${fach(s.f)}</td><td class="num weg">${s.karten}</td><td class="num">${s.faellig}</td><td style="text-align:right">${s.faellig ? `<a class="knopf neben klein" href="#/karteikarten/lernen/${s.id}">Lernen</a>` : '<span class="fach">alles erledigt</span>'}</td></tr>`).join('')}</tbody></table></div>`
  };
};
function lernAnsicht(id, kK) {
  const st = STAPEL.find(s => s.id === id) || STAPEL[0];
  if (!lern || lern.id !== st.id || lern.ende) lern = { id: st.id, karten: KARTEN[st.id].map((k, i) => ({ i, q: k[0], a: k[1] })), queue: KARTEN[st.id].map((_, i) => i), pos: 0, offen: false, antworten: 0, stufe: {}, ende: false };
  return {
    pfad: `<a class="zurueck" href="#/karteikarten">${ic('karten')}Karteikarten</a><span class="sub">/</span><span>${st.n}</span>`,
    k: kK,
    v: '<section class="lern" aria-label="Lernmodus" id="lern"></section>',
    nach: lernZeichnen
  };
}
function lernZeichnen() {
  const box = $('#lern'); if (!box || !lern) return;
  const st = STAPEL.find(s => s.id === lern.id), gesamt = lern.karten.length, sicher = Object.keys(lern.stufe).length;
  if (lern.pos >= lern.queue.length) { lern.ende = true; return lernEnde(box, st); }
  const k = lern.karten[lern.queue[lern.pos]];
  box.innerHTML = `<div class="lern-kopf"><span>${F[st.f][0]}</span><div class="fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax="${gesamt}" aria-valuenow="${sicher}" aria-label="Fortschritt"><i style="transform:scaleX(${(sicher / gesamt).toFixed(3)})"></i></div><span class="zahl">${sicher} / ${gesamt}</span></div>
    <div class="lernkarte${lern.offen ? ' offen' : ''}"><p class="meta">Frage</p><p class="q">${esc(k.q)}</p>${lern.offen ? `<p class="a" aria-live="polite">${woerter(k.a)}</p>` : ''}</div>
    <div class="lern-aktion">${lern.offen ? `<div class="bewerten" role="group" aria-label="Wie gut wusstest du es?">${['Nochmal|1 min', 'Schwer|6 min', 'Gut|1 Tag', 'Einfach|4 Tage'].map((x, j) => `<button type="button"${j === 2 ? ' class="gut"' : ''} data-r="${j + 1}">${x.split('|')[0]}<small>${x.split('|')[1]}</small><kbd>${j + 1}</kbd></button>`).join('')}</div>` : `<button class="knopf haupt gross" type="button" id="aufdecken">Antwort zeigen<kbd>Leertaste</kbd></button>`}</div>`;
  if (lern.offen) { $$('.bewerten button', box).forEach(b => b.onclick = () => bewerte(+b.dataset.r)); $('.bewerten .gut', box).focus(); }
  else { $('#aufdecken').onclick = aufdecken; $('#aufdecken').focus(); }
}
const aufdecken = () => { if (!lern || lern.offen || lern.ende) return; lern.offen = true; lernZeichnen(); };
function bewerte(r) {
  if (!lern || !lern.offen) return;
  const ki = lern.queue[lern.pos]; lern.antworten++; lern.offen = false;
  if (r === 1) lern.queue.splice(Math.min(lern.pos + 4, lern.queue.length), 0, ki);
  else lern.stufe[ki] = r;
  lern.pos++; lernZeichnen();
}
function lernEnde(box, st) {
  const n = lern.karten.length, z = [0, 0, 0, 0, 0]; Object.values(lern.stufe).forEach(r => z[r]++);
  const nochmal = lern.antworten - n, farben = { 4: 'var(--akzent)', 3: 'var(--f1)', 2: 'var(--f2)' };
  let w = 0, bogen = '';
  [4, 3, 2].forEach(r => { if (!z[r]) return; const anteil = z[r] / n * 339.3; bogen += `<circle cx="60" cy="60" r="54" fill="none" stroke="${farben[r]}" stroke-width="8" stroke-dasharray="${(anteil - 3).toFixed(1)} 339.3" stroke-dashoffset="${(-w).toFixed(1)}" transform="rotate(-90 60 60)"/>`; w += anteil; });
  box.innerHTML = `<div class="lern-ende"><svg viewBox="0 0 120 120" role="img" aria-label="${z[4]} einfach, ${z[3]} gut, ${z[2]} schwer">${bogen}<text x="60" y="58" text-anchor="middle" font-size="24" fill="var(--text)" font-family="var(--font-mono)">${n}</text><text x="60" y="76" text-anchor="middle" font-size="9" fill="var(--text-3)" font-family="var(--font-body)">Karten</text></svg>
    <h1>Runde geschafft.</h1><p>${n} Karten in ${lern.antworten} Antworten. ${z[4] + z[3]} saßen sicher${z[2] ? `, ${z[2]} ${z[2] === 1 ? 'war' : 'waren'} schwer` : ''}${nochmal > 0 ? `, ${nochmal}-mal hast du „Nochmal“ gewählt` : ''}.</p>
    <div class="aktionen"><a class="knopf haupt" href="#/karteikarten">Zu den Stapeln</a><button class="knopf leise" type="button" id="nochmalRunde">${ic('zurueck')}Noch eine Runde</button></div></div>`;
  st.faellig = Math.max(0, st.faellig - n);
  $('#nochmalRunde').onclick = () => { lern = null; zeige(); };
}
addEventListener('keydown', e => {
  if (route().a !== 'lernen' || $('#palette').classList.contains('offen')) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  if (e.code === 'Space' && lern && !lern.offen && !lern.ende) { e.preventDefault(); aufdecken(); }
  else if (lern && lern.offen && /^[1-4]$/.test(e.key)) { e.preventDefault(); bewerte(+e.key); }
});

VIEWS.notizen = r => {
  const n = NOTIZEN.find(x => x.id === r.a) || NOTIZEN[0];
  const k = `<section class="kgruppe" aria-label="Notizen"><h3 class="gt">Alle Notizen</h3><ul class="kliste">${NOTIZEN.map(x => `<li><a class="keintrag" href="#/notizen/${x.id}" style="--c:var(--${F[x.f][1]})"${x.id === n.id ? ' aria-current="page"' : ''}><span class="f"></span><span class="n">${x.t}<small>${x.zeit}</small></span></a></li>`).join('')}</ul></section>`;
  const vs = S.notizVorschlag === n.id;
  return {
    pfad: `${ic('notiz')}<span>Notizen</span><span class="sub">/</span><span class="sub">${n.t}</span>`,
    k,
    v: `<article class="notiz"><p class="meta">${fach(n.f)}<span>zuletzt ${n.zeit}</span></p><h1 contenteditable="true" spellcheck="false" aria-label="Titel">${n.t}</h1><div class="text" contenteditable="true" aria-label="Notiztext">${n.html}</div>
      <div class="notiz-werk"><button class="knopf neben klein" type="button" id="vorschlagen">${ic('karten')}Karteikarten vorschlagen</button><button class="knopf leise klein" type="button">${ic('funke')}Zusammenfassen</button></div>
      ${vs ? `<div class="vorschlaege"><p class="kopf2">${ic('funke')}Drei Karten aus dieser Notiz, für den Stapel ${STAPEL.find(s => s.f === n.f).n}.</p><ol>${n.vorschlag.map(([q, a]) => `<li><b>${esc(q)}</b><span>${esc(a)}</span></li>`).join('')}</ol><div class="fuss2">${S.uebernommen[STAPEL.find(s => s.f === n.f).id] && S.notizVorschlag === n.id && S.notizFertig ? `<span class="fach">Übernommen. Sie erscheinen morgen zum ersten Mal.</span>` : `<button class="knopf leise klein" type="button" id="vsWeg">Verwerfen</button><button class="knopf haupt klein" type="button" id="vsOk">In Stapel übernehmen</button>`}</div></div>` : ''}</article>`,
    nach: () => {
      $('#vorschlagen').onclick = () => { S.notizVorschlag = n.id; S.notizFertig = false; zeige(); };
      $('#vsWeg') && ($('#vsWeg').onclick = () => { S.notizVorschlag = null; zeige(); });
      $('#vsOk') && ($('#vsOk').onclick = () => { const s = STAPEL.find(x => x.f === n.f); s.karten += 3; S.uebernommen[s.id] = (S.uebernommen[s.id] || 0) + 3; S.notizFertig = true; zeige(); });
    }
  };
};

VIEWS.pdf = r => {
  const d = DOKS.find(x => x.id === r.a) || DOKS[0], seite = Math.min(Math.max(1, +r.c || 1), d.seiten.length);
  const marks = d.mark.concat(S.pdf.extra[d.id] || []);
  const k = `<section class="kgruppe" aria-label="Dokumente"><h3 class="gt">Dokumente</h3><ul class="kliste">${DOKS.map(x => `<li><a class="keintrag" href="#/pdf/${x.id}" style="--c:var(--${F[x.f][1]})"${x.id === d.id ? ' aria-current="page"' : ''}><span class="f"></span><span class="n">${x.t}<small>${x.seiten.length} ${x.seiten.length === 1 ? 'Seite' : 'Seiten'}</small></span></a></li>`).join('')}</ul></section>
    <section class="kgruppe markierungen" aria-label="Markierungen"><h3 class="gt">Markierungen</h3><ul class="kliste">${marks.length ? marks.map(([s, a]) => `<li><a class="keintrag" href="#/pdf/${d.id}/${s + 1}"><span class="f" style="--c:var(--f2)"></span><span class="n">${esc(d.seiten[s][1][a].slice(0, 46))}…<small>Seite ${s + 1}</small></span></a></li>`).join('') : '<li class="gt" style="margin:var(--space-1) var(--space-3)">Noch keine Markierungen. Markieren aktivieren und einen Absatz anklicken.</li>'}</ul></section>`;
  const [titel, absaetze] = d.seiten[seite - 1];
  return {
    pfad: `${ic('pdf')}<span>PDF Reader</span><span class="sub">/</span><span class="sub">${d.t}</span>`,
    k,
    v: `<div class="pdf-leiste"><a class="symbolknopf" href="#/pdf/${d.id}/${seite - 1}" aria-label="Vorige Seite"${seite === 1 ? ' aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"' : ''}>${ic('links')}</a><span>Seite <span class="zahl">${seite}</span> von ${d.seiten.length}</span><a class="symbolknopf" href="#/pdf/${d.id}/${seite + 1}" aria-label="Nächste Seite"${seite === d.seiten.length ? ' aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"' : ''}>${ic('pfeil')}</a>
        <div class="rechts"><button class="symbolknopf" type="button" id="zKlein" aria-label="Verkleinern">${ic('minus')}</button><span class="zahl" id="zWert">${Math.round(S.pdf.zoom * 100)} %</span><button class="symbolknopf" type="button" id="zGross" aria-label="Vergrößern">${ic('plus')}</button><span class="trenn" aria-hidden="true"></span><button class="symbolknopf" type="button" id="markieren" aria-pressed="${S.pdf.markieren}" aria-label="Markieren">${ic('stift')}</button></div></div>
      <div class="pdf-buehne"><div class="blatt" style="transform:scale(${S.pdf.zoom})"><h2>${titel}</h2>${absaetze.map((a, i) => { const m = marks.some(([s, x]) => s === seite - 1 && x === i); return `<p data-a="${i}">${m ? `<mark>${esc(a)}</mark>` : esc(a)}</p>`; }).join('')}<p class="seitenzahl">${seite}</p></div></div>`,
    nach: () => {
      const z = dz => { S.pdf.zoom = Math.min(1.3, Math.max(.8, +(S.pdf.zoom + dz).toFixed(2))); $('.blatt').style.transform = `scale(${S.pdf.zoom})`; $('#zWert').textContent = `${Math.round(S.pdf.zoom * 100)} %`; };
      $('#zKlein').onclick = () => z(-.1); $('#zGross').onclick = () => z(.1);
      $('#markieren').onclick = () => { S.pdf.markieren = !S.pdf.markieren; $('#markieren').setAttribute('aria-pressed', S.pdf.markieren); $('.blatt').style.cursor = S.pdf.markieren ? 'text' : ''; };
      $$('.blatt p[data-a]').forEach(p => p.onclick = () => { if (!S.pdf.markieren) return; const a = +p.dataset.a, ex = (S.pdf.extra[d.id] ||= []); const i = ex.findIndex(([s, x]) => s === seite - 1 && x === a); if (i >= 0) ex.splice(i, 1); else if (!d.mark.some(([s, x]) => s === seite - 1 && x === a)) ex.push([seite - 1, a]); zeige(); });
      if (S.pdf.markieren) $('.blatt').style.cursor = 'text';
    }
  };
};

VIEWS.dateiablage = r => {
  const ordner = r.a && F[r.a] ? r.a : 'alle';
  const k = `<section class="kgruppe" aria-label="Ordner"><h3 class="gt">Ordner</h3><ul class="kliste"><li><a class="keintrag" href="#/dateiablage"${ordner === 'alle' ? ' aria-current="page"' : ''}>${ic('ordner')}<span class="n">Alle Dateien</span><span class="z">${DATEIEN.length}</span></a></li>${Object.entries(F).map(([f, [n, c]]) => `<li><a class="keintrag" href="#/dateiablage/${f}" style="--c:var(--${c})"${ordner === f ? ' aria-current="page"' : ''}><span class="f"></span><span class="n">${n}</span><span class="z">${DATEIEN.filter(x => x.f === f).length}</span></a></li>`).join('')}</ul></section>`;
  const liste = DATEIEN.filter(x => ordner === 'alle' || x.f === ordner);
  const ueber = ordner === 'alle' ? 'Alle Dateien' : F[ordner][0];
  const upBtn = `<button class="knopf haupt" type="button" id="hochladen">${ic('hoch')}Hochladen</button>`;
  return {
    pfad: `${ic('ordner')}<span>Dateiablage</span><span class="sub">/</span><span class="sub">${ueber}</span>`,
    k,
    v: seitenkopf(ueber, liste.length ? `${liste.length} ${liste.length === 1 ? 'Datei' : 'Dateien'}, zuletzt geöffnete zuerst.` : '', liste.length ? upBtn : '') + '<div id="uploads"></div>' +
      (liste.length ? `<div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Name</th><th scope="col" class="weg">Fach</th><th scope="col" class="num weg">Größe</th><th scope="col" class="datum">Geändert</th></tr></thead><tbody>${liste.map(x => `<tr><td>${x.link ? `<a class="name" href="${x.link}">` : '<span class="name">'}<span class="ico">${ic(x.t === 'pdf' ? 'pdf' : x.t === 'tabelle' ? 'tabelle' : 'datei')}</span><span>${esc(x.n)}</span>${x.link ? '</a>' : '</span>'}</td><td class="weg">${fach(x.f)}</td><td class="num weg">${x.g}</td><td class="datum">${x.d}</td></tr>`).join('')}</tbody></table></div><p class="hinweis" style="margin-top:var(--space-4)">Im Dummy schlägt der zweite Upload absichtlich fehl, damit der Fehlerzustand sichtbar ist.</p>`
        : leerHtml('ordner', `Noch keine Dateien in ${F[ordner][0]}.`, 'Lade Skripte, Übungsblätter und Mitschriften hoch. Sie landen automatisch in diesem Fach.', upBtn)),
    nach: () => { $('#hochladen').onclick = () => hochladen(ordner); zeichneUploads(); }
  };
};
function hochladen(ordner) {
  const f = ordner === 'alle' ? 'ml' : ordner, nr = S.uploads.length;
  const u = { n: nr % 2 ? `Mitschrift ${F[f][2]}, Woche 4.pdf` : `Skript ${F[f][2]}, Kapitel ${nr + 3}.pdf`, f, p: 0, fehler: false, faellt: nr % 2 === 1 && !S.upFehler };
  S.uploads.push(u); laufe(u); zeichneUploads();
}
function laufe(u) {
  const iv = setInterval(() => {
    u.p = Math.min(100, u.p + 7 + Math.round(Math.random() * 6));
    if (u.faellt && u.p >= 62) { u.p = 62; u.fehler = true; u.faellt = false; S.upFehler = true; clearInterval(iv); }
    if (u.p >= 100) { clearInterval(iv); u.fertig = true; DATEIEN.unshift({ n: u.n, f: u.f, g: `${200 + Math.round(Math.random() * 800)} KB`, d: 'gerade eben', t: 'pdf' }); setTimeout(() => { S.uploads = S.uploads.filter(x => x !== u); if (route().b === 'dateiablage') zeige(); }, 500); }
    zeichneUploads();
  }, 120);
}
function zeichneUploads() {
  const box = $('#uploads'); if (!box) return;
  box.innerHTML = S.uploads.map((u, i) => u.fehler
    ? `<div class="upload-zeile fehler" role="alert"><span class="ico">${ic('pdf')}</span><span><b>${esc(u.n)}</b><br><span style="color:var(--text-2)">Abgebrochen bei ${u.p} %. Die Verbindung wurde unterbrochen.</span></span><button class="knopf leise klein" type="button" data-retry="${i}">${ic('zurueck')}Erneut versuchen</button></div>`
    : `<div class="upload-zeile"><span class="umlauf" style="width:16px;height:16px" aria-hidden="true"><i></i></span><span>${esc(u.n)}</span><span class="balkenk"><i style="transform:scaleX(${u.p / 100})"></i></span><span class="pz">${u.p} %</span></div>`).join('');
  $$('[data-retry]', box).forEach(b => b.onclick = () => { const u = S.uploads[+b.dataset.retry]; u.fehler = false; laufe(u); zeichneUploads(); });
}

const leerHtml = (i, h, p, aktion, art = 'leer', detail = '') => `<div class="leer${art === 'fehler' ? ' ist-fehler' : ''}"${art === 'fehler' ? ' role="alert"' : ''}><div><svg class="bahnbild" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="60" rx="52" ry="20" fill="none" stroke="${art === 'fehler' ? 'var(--color-error)' : 'var(--linie-2)'}" stroke-dasharray="${art === 'fehler' ? '6 5' : 'none'}" transform="rotate(-18 60 60)"/><circle cx="60" cy="60" r="18" fill="var(--flaeche-3)"/><use href="#i-${i}" x="50" y="50" width="20" height="20" style="color:var(--text-2)" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="108" cy="44" r="4" fill="${art === 'fehler' ? 'var(--color-error)' : 'var(--akzent)'}"/></svg><h1>${h}</h1><p>${p}</p>${aktion}${detail ? `<p class="leer-detail">${detail}</p>` : ''}</div></div>`;
const LEER = {
  literatur: ['Noch keine Quellen.', 'Füge eine Quelle per DOI oder ISBN hinzu. UniVerse formatiert sie im APA-Stil.', 'Quelle hinzufügen'],
  transkription: ['Transkription kommt bald.', 'Hier kannst du später Vorlesungen aufnehmen und als Text nachlesen.', null],
  chat: ['Noch keine Unterhaltungen.', 'Lade deine Lerngruppe ein, um Notizen und Dateien zu teilen.', 'Gruppe erstellen'],
  textverarbeitung: ['Noch kein Dokument.', 'Beginne eine Hausarbeit mit Gliederung, Zitaten und Literaturverzeichnis.', 'Neues Dokument'],
  tabellen: ['Noch keine Tabelle.', 'Für Datenauswertungen, etwa die Statistik-Übung mit pruefung.csv.', 'Neue Tabelle'],
  praesentationen: ['Noch keine Präsentation.', 'Bau Folien für dein nächstes Referat, auf Wunsch aus einer Notiz.', 'Neue Präsentation'],
  mindmap: ['Noch keine MindMap.', 'Ordne ein Thema als Karte, bevor du schreibst oder lernst.', 'Neue MindMap'],
  whiteboard: ['Noch kein Whiteboard.', 'Skizziere frei, allein oder gemeinsam mit deiner Lerngruppe.', 'Neues Whiteboard']
};
function leer(r, b) {
  const [h, p, a] = LEER[r.b] || ['Noch leer.', '', null];
  return { k: faecherK(false), v: leerHtml(b.i, h, p, a ? `<button class="knopf haupt" type="button">${ic('plus')}${a}</button>` : `<a class="knopf leise" href="#/hub">${ic('links')}Zum Hub</a>`) };
}

/* ---------- Zustände: Leer und Fehler je Bereich ---------- */
/* Seite = ganzer Bereich, Region = nur der Teil, der Daten lädt; der Rest bleibt benutzbar. */
S.zust = {}; S.offline = false;
const kLeer = (titel, text) => `<section class="kgruppe" aria-label="${titel}"><h3 class="gt">${titel}</h3><p class="kleer">${text}</p></section>`;
const fuellKnopf = (label, icon = 'plus') => `<button class="knopf haupt" type="button" data-fuellen>${ic(icon)}${label}</button>`;
const wiederKnopf = (label = 'Erneut versuchen', cls = 'haupt') => `<button class="knopf ${cls}" type="button" data-wieder>${ic('zurueck')}${label}</button>`;
const region = (art, titel, text, aktion = '') => `<div class="region-zustand z-${art}"${art === 'fehler' ? ' role="alert"' : ''}>${ic(art === 'fehler' ? 'achtung' : art === 'offline' ? 'offline' : 'haken')}<div><strong>${titel}</strong><p>${text}</p>${aktion}</div></div>`;
const seiteLeer = (i, h, p, aktion, k = '') => () => ({ k, v: leerHtml(i, h, p, aktion) });
const seiteFehler = (i, h, p, label, detail) => (r, b) => ({ k: (VIEWS[r.b] || leer)(r, b).k, v: leerHtml(i, h, p, wiederKnopf(label), 'fehler', detail) });
const mitView = (s, f) => (r, b) => { const o = VIEWS[s](r, b); return f(o, r, b) || o; };

const ZUST = {
  hub: {
    leer: seiteLeer('hub', 'Dein Semester ist noch leer.', 'Trag deinen Stundenplan ein. Danach zeigt der Hub, was heute ansteht und was als Nächstes fällig ist.', fuellKnopf('Stundenplan eintragen'), semesterK() + kLeer('Fächer', 'Fächer entstehen mit dem Stundenplan.')),
    fehler: seiteFehler('hub', 'Der Hub lässt sich gerade nicht laden.', 'Die Verbindung zum Server ist abgebrochen. Deine Daten sind davon nicht betroffen.', 'Erneut laden', 'Zuletzt geladen um 13:58.')
  },
  'work-station': {
    leer: mitView('work-station', o => { o.v = o.v.replace(/<span class="info">\d+ offen<\/span>/, '').replace('<ul class="aufgaben" id="aufgaben"></ul>', region('leer', 'Keine Aufgaben für heute.', 'Der Timer läuft auch ohne Aufgabe. Übernimm einen Vorschlag aus dem Hub oder leg selbst eine an.', `<button class="knopf neben klein" type="button" data-fuellen>${ic('plus')}Aufgabe anlegen</button>`)); }),
    fehler: mitView('work-station', o => { o.v = o.v.replace(/<span class="info">\d+ offen<\/span>/, '').replace('<ul class="aufgaben" id="aufgaben"></ul>', region('fehler', 'Aufgaben nicht geladen.', 'Der Timer läuft trotzdem. Deine Fokuszeit wird gespeichert, sobald die Liste wieder da ist.', wiederKnopf('Erneut versuchen', 'leise klein'))); })
  },
  karteikarten: {
    leer: (r, b) => r.a === 'lernen' ? VIEWS.karteikarten(r, b) : { k: kLeer('Fällig nach Fach', 'Alles erledigt. Morgen werden 18 Karten fällig.'), v: leerHtml('karten', 'Heute ist nichts fällig.', 'Morgen werden 18 Karten fällig. Wer vorlernen will, wiederholt einen Stapel freiwillig.', `<a class="knopf haupt" href="#/karteikarten/lernen/kogn">${ic('play')}Freiwillig wiederholen</a>`) },
    fehler: (r, b) => r.a === 'lernen' ? VIEWS.karteikarten(r, b) : seiteFehler('karten', 'Deine Stapel lassen sich nicht laden.', 'Dein Lernstand ist gespeichert. Bitte versuch es gleich noch einmal.')(r, b)
  },
  notizen: {
    leer: seiteLeer('notiz', 'Noch keine Notizen.', 'Schreib mit, während die Vorlesung läuft. Aus jeder Notiz schlägt UniVerse Karteikarten vor.', fuellKnopf('Neue Notiz'), kLeer('Alle Notizen', 'Hier erscheinen deine Notizen, nach Fach sortiert.')),
    fehler: mitView('notizen', o => { o.v = o.v.replace('<article class="notiz">', `<article class="notiz">${region('fehler', 'Nicht gespeichert.', 'Deine Änderungen liegen sicher auf diesem Gerät. Sie werden übertragen, sobald der Server wieder antwortet.', wiederKnopf('Erneut speichern', 'leise klein'))}`); })
  },
  pdf: {
    leer: seiteLeer('pdf', 'Noch keine PDFs.', 'Lade Skripte und Übungsblätter hoch. Markierungen und Fragen bleiben an der Seite gespeichert.', fuellKnopf('PDF hochladen', 'hoch'), kLeer('Dokumente', 'Noch keine Dokumente.')),
    fehler: mitView('pdf', o => { o.v = o.v.split('<div class="pdf-buehne">')[0] + `<div class="pdf-buehne">${leerHtml('pdf', 'Dieses PDF lässt sich nicht öffnen.', 'Die Datei ist beschädigt oder mit einem Passwort geschützt. Lade sie neu hoch, deine Markierungen bleiben erhalten.', wiederKnopf('Neu hochladen'), 'fehler')}</div>`; const n = o.nach; o.nach = () => { try { n(); } catch (_) {} }; })
  },
  dateiablage: {
    leer: seiteLeer('ordner', 'Noch keine Dateien.', 'Lade Skripte, Übungsblätter und Mitschriften hoch. Sie landen automatisch im passenden Fach.', fuellKnopf('Hochladen', 'hoch'), kLeer('Ordner', 'Für jedes Fach entsteht ein Ordner.')),
    fehler: seiteFehler('ordner', 'Die Dateiablage antwortet nicht.', 'Deine Dateien sind gespeichert, nur die Liste lässt sich gerade nicht abrufen.')
  },
  literatur: {
    leer: seiteLeer('buch', 'Noch keine Quellen.', 'Füge eine Quelle per DOI oder ISBN hinzu. UniVerse formatiert sie im APA-Stil.', fuellKnopf('Quelle hinzufügen'), kLeer('Sammlungen', 'Sammlungen entstehen mit der ersten Quelle.')),
    fehler: seiteFehler('buch', 'Die Literaturliste lässt sich nicht laden.', 'Die Zitate in deinen Texten bleiben erhalten. Versuch es gleich noch einmal.')
  },
  transkription: {
    leer: seiteLeer('mikro', 'Noch keine Aufnahmen.', 'Nimm eine Vorlesung auf. Der Text erscheint mit Zeitmarken und lässt sich durchsuchen.', fuellKnopf('Neue Aufnahme', 'mikro'), kLeer('Aufnahmen', 'Noch keine Aufnahmen.')),
    fehler: mitView('transkription', o => { o.v = o.v.replace(/<ol class="transkript"[\s\S]*?<\/ol>/, region('fehler', 'Transkription abgebrochen.', 'Die Aufnahme ist gespeichert, nur der Text fehlt noch. Bei 1 h 28 min dauert das etwa vier Minuten.', wiederKnopf('Erneut transkribieren', 'leise klein'))); })
  },
  lernraum: {
    leer: seiteLeer('lernraum', 'Noch keine Quellen in diesem Fach.', 'Lade Skripte hoch oder nimm Notizen dazu. Studio antwortet dann mit Belegen aus genau diesen Quellen.', fuellKnopf('Quellen hinzufügen'), kLeer('Fächer', 'Lernräume entstehen pro Fach.')),
    fehler: mitView('lernraum', o => { o.v = o.v.replace('<section class="lr-mitte"', `${region('fehler', 'Zwei Quellen werden noch eingelesen.', 'Studio nutzt sie, sobald sie fertig sind. Bei langen Skripten dauert das etwa eine Minute.', wiederKnopf('Erneut einlesen', 'leise klein'))}<section class="lr-mitte"`); })
  },
  chat: {
    leer: seiteLeer('chat', 'Noch keine Unterhaltungen.', 'Lade deine Lerngruppe ein. Dann teilt ihr Notizen, Dateien und Boards an einem Ort.', fuellKnopf('Gruppe erstellen'), kLeer('Gruppen', 'Noch keine Gruppen.')),
    fehler: mitView('chat', o => { o.v = o.v.replace('</div>\n    <form class="eingabe2"', `<div class="nachricht ich nicht-gesendet"><p>Ich übernehme die Entkatastrophisierung.</p></div><p class="senden-fehler" role="alert">${ic('achtung')}Nicht gesendet.<button class="link" type="button" data-wieder>Erneut senden</button></p></div>\n    <form class="eingabe2"`); })
  },
  textverarbeitung: {
    leer: seiteLeer('text', 'Noch kein Dokument.', 'Beginne eine Hausarbeit mit Gliederung, Zitaten und Literaturverzeichnis.', fuellKnopf('Neues Dokument'), kLeer('Dokumente', 'Noch keine Dokumente.')),
    fehler: seiteFehler('text', 'Das Dokument lässt sich nicht öffnen.', 'Die letzte gespeicherte Fassung ist von 11:42. Lade neu, um weiterzuschreiben.', 'Neu laden')
  },
  tabellen: {
    leer: seiteLeer('tabelle', 'Noch keine Tabelle.', 'Importiere eine CSV-Datei, etwa pruefung.csv aus der Statistik-Übung.', fuellKnopf('CSV importieren', 'hoch'), kLeer('Tabellen', 'Noch keine Tabellen.')),
    fehler: seiteFehler('tabelle', 'Die Datei hat ein unbekanntes Format.', 'UniVerse liest CSV mit Komma oder Semikolon als Trennzeichen. Prüfe die Datei und importiere sie erneut.', 'Erneut importieren')
  },
  praesentationen: {
    leer: seiteLeer('folie', 'Noch keine Präsentation.', 'Bau Folien für dein nächstes Referat, auf Wunsch aus einer Notiz.', fuellKnopf('Neue Präsentation'), kLeer('Folien', 'Noch keine Folien.')),
    fehler: seiteFehler('folie', 'Die Folien lassen sich nicht laden.', 'Deine Präsentation ist gespeichert. Versuch es gleich noch einmal.')
  },
  mindmap: {
    leer: seiteLeer('mind', 'Noch keine MindMap.', 'Ordne ein Thema als Karte, bevor du schreibst oder lernst.', fuellKnopf('Neue MindMap'), kLeer('MindMaps', 'Noch keine MindMaps.')),
    fehler: seiteFehler('mind', 'Die MindMap lässt sich nicht laden.', 'Deine Karte ist gespeichert. Versuch es gleich noch einmal.')
  },
  whiteboard: {
    leer: seiteLeer('tafel', 'Noch kein Whiteboard.', 'Skizziere frei, allein oder gemeinsam mit deiner Lerngruppe.', fuellKnopf('Neues Whiteboard'), kLeer('Boards', 'Noch keine Boards.')),
    fehler: mitView('whiteboard', o => { o.v = o.v.replace('<div class="tafel"', `${region('fehler', 'Nicht synchron.', 'Deine Zettel bleiben hier. Änderungen von Lea und Jonas erscheinen, sobald die Verbindung wieder steht.', wiederKnopf('Neu verbinden', 'leise klein'))}<div class="tafel"`); })
  }
};
const OFFLINE = {
  transkription: ['Offline.', 'Aufnehmen geht weiter. Der Text entsteht, sobald du wieder online bist.', '<div class="spieler">'],
  chat: ['Offline.', 'Neue Nachrichten werden gesendet, sobald du wieder online bist.', '<div class="chatkopf">']
};
function ansichtFuer(r, b) {
  const z = S.zust[r.b], f = z && ZUST[r.b]?.[z];
  const o = f ? f(r, b) : (VIEWS[r.b] || leer)(r, b);
  const off = S.offline && OFFLINE[r.b];
  if (off && o.v.includes(off[2])) o.v = o.v.replace(off[2], region('offline', off[0], off[1]) + off[2]);
  const nach = o.nach;
  o.nach = () => {
    nach && nach();
    $$('[data-wieder]', ansicht).forEach(btn => btn.onclick = () => wiederholen(btn, r.b));
    $$('[data-fuellen]', ansicht).forEach(btn => btn.onclick = () => { delete S.zust[r.b]; uebergang(() => einsetzen(route(), bereich(r.b), false)); });
  };
  return o;
}
function wiederholen(btn, s) {
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `<span class="umlauf mini" aria-hidden="true"><i></i></span>Wird geladen`;
  setTimeout(() => { delete S.zust[s]; if (route().b === s) uebergang(() => einsetzen(route(), bereich(s), false)); }, 900);
}

/* ---------- Vorschläge für die übrigen Hubs ---------- */
const liK = (titel, eintraege) => `<section class="kgruppe" aria-label="${titel}"><h3 class="gt">${titel}</h3><ul class="kliste">${eintraege.join('')}</ul></section>`;
const kE = ({ href, f, n, s, z, cur, icon }) => `<li><${href ? `a href="${href}"` : 'span'} class="keintrag"${f ? ` style="--c:var(--${F[f][1]})"` : ''}${cur ? ' aria-current="page"' : ''}>${icon ? ic(icon) : `<span class="f"></span>`}<span class="n">${n}${s ? `<small>${s}</small>` : ''}</span>${z != null ? `<span class="z">${z}</span>` : ''}</${href ? 'a' : 'span'}></li>`;

/* Literatur */
const QUELLEN = [
  { a: 'Beck, J. S.', j: 2011, t: 'Cognitive behavior therapy: Basics and beyond', v: 'Guilford Press', f: 'vt', typ: 'Buch', z: 3 },
  { a: 'Margraf, J., & Schneider, S.', j: 2018, t: 'Lehrbuch der Verhaltenstherapie (Bd. 1)', v: 'Springer', f: 'vt', typ: 'Buch', z: 2 },
  { a: 'Moosbrugger, H., & Kelava, A.', j: 2020, t: 'Testtheorie und Fragebogenkonstruktion', v: 'Springer', f: 'di', typ: 'Buch', z: 5 },
  { a: 'Wittchen, H.-U., & Hoyer, J.', j: 2011, t: 'Klinische Psychologie & Psychotherapie', v: 'Springer', f: 'kp', typ: 'Buch', z: 4 },
  { a: 'Field, A.', j: 2018, t: 'Discovering statistics using IBM SPSS Statistics', v: 'SAGE', f: 'ml', typ: 'Buch', z: 1 }
];
VIEWS.literatur = r => {
  const i = Math.min(Math.max(0, +r.a || 0), QUELLEN.length - 1), q = QUELLEN[i];
  return {
    k: liK('Sammlungen', [kE({ href: '#/literatur', icon: 'buch', n: 'Alle Quellen', z: QUELLEN.length, cur: true }), ...Object.keys(F).map(f => kE({ f, n: F[f][0], z: QUELLEN.filter(x => x.f === f).length }))]) + liK('Zitierstil', [kE({ icon: 'haken', n: 'APA 7', s: 'für alle Fächer' })]),
    v: seitenkopf('Literatur', `${QUELLEN.length} Quellen, ${QUELLEN.reduce((a, x) => a + x.z, 0)} Zitate in deinen Texten.`, `<button class="knopf haupt" type="button">${ic('plus')}Quelle per DOI oder ISBN</button>`) +
      `<div class="lit"><div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Titel</th><th scope="col" class="weg">Fach</th><th scope="col" class="num">Jahr</th><th scope="col" class="num weg">Zitiert</th></tr></thead><tbody>${QUELLEN.map((x, n) => `<tr${n === i ? ' class="gewaehlt"' : ''}><td><a class="name" href="#/literatur/${n}"><span class="ico">${ic('buch')}</span><span>${esc(x.t)}<small>${esc(x.a)}</small></span></a></td><td class="weg">${fach(x.f)}</td><td class="num">${x.j}</td><td class="num weg">${x.z}</td></tr>`).join('')}</tbody></table></div>
      <aside class="zitat" aria-label="Zitat"><h2>${esc(q.t)}</h2><p class="apa">${esc(q.a)} (${q.j}). <i>${esc(q.t)}</i>. ${esc(q.v)}.</p><div class="aktionen"><button class="knopf neben klein" type="button" id="kopieren">Zitat kopieren</button><button class="knopf leise klein" type="button">Im Text zitieren</button></div><p class="hinweis0" id="kopiert" aria-live="polite"></p>
      <dl class="info2"><dt>Kurzbeleg</dt><dd>(${esc(q.a.split(',')[0])}, ${q.j})</dd><dt>Verlag</dt><dd>${esc(q.v)}</dd><dt>Art</dt><dd>${q.typ}</dd></dl></aside></div>`,
    nach: () => { $('#kopieren').onclick = () => { $('#kopiert').textContent = 'Kopiert, im APA-Stil.'; }; }
  };
};

/* Transkription */
const TRANS = [['00:00', 'Willkommen zurück. Heute geht es um Angststörungen, ihre Einteilung und die Behandlung.'], ['00:42', 'Angst ist zunächst eine normale und sinnvolle Reaktion auf Gefahr.'], ['01:15', 'Zur Störung wird sie, wenn sie übermäßig, anhaltend und beeinträchtigend ist.'], ['02:03', 'Wir unterscheiden Panikstörung, Agoraphobie, generalisierte Angststörung, soziale Angststörung und spezifische Phobien.'], ['03:30', 'Das Verfahren mit der besten Evidenz ist kognitive Verhaltenstherapie mit Exposition.'], ['04:12', 'Bei der Exposition wird die Angst bewusst ausgelöst, bis sie von selbst nachlässt.']];
let transIv = null;
VIEWS.transkription = () => ({
  k: liK('Aufnahmen', [kE({ href: '#/transkription', f: 'kp', n: 'Vorlesung 4, Angststörungen', s: 'heute, 1 h 28 min', cur: true }), kE({ f: 'ml', n: 'Übung Regression', s: '12. November, 46 min' }), kE({ f: 'di', n: 'Vorlesung 3, Testtheorie', s: '10. November, 1 h 31 min' })]),
  v: seitenkopf('Vorlesung 4, Angststörungen', 'Klinische Psychologie, aufgenommen heute um 08:30, 1 h 28 min.', `<button class="knopf haupt" type="button">${ic('mikro')}Neue Aufnahme</button>`) +
    `<div class="spieler"><button class="symbolknopf gross" type="button" id="abspielen" aria-label="Abspielen">${ic('play')}</button><div class="spur" aria-hidden="true"><i id="spurI"></i></div><span class="zahl" id="spielzeit">00:00</span><span class="info">von 1:28:40</span></div>
    <ol class="transkript" id="transkript">${TRANS.map(([t, x], i) => `<li data-i="${i}"><button class="zahl tz" type="button">${t}</button><p>${esc(x)}</p></li>`).join('')}</ol>
    <div class="abschnitt-fuss"><a class="knopf neben klein" href="#/notizen/angst">${ic('notiz')}Als Notiz speichern</a><button class="knopf leise klein" type="button" id="trKarten">${ic('karten')}Karteikarten erstellen</button><span class="info" id="trInfo" aria-live="polite"></span></div>`,
  nach: () => {
    let i = -1; const setz = n => { i = n; $$('#transkript li').forEach(li => li.classList.toggle('jetzt', +li.dataset.i === i)); $('#spielzeit').textContent = TRANS[i] ? TRANS[i][0] : '00:00'; $('#spurI').style.transform = `scaleX(${(i + 1) / TRANS.length * .06})`; };
    $('#abspielen').onclick = () => { if (transIv) { clearInterval(transIv); transIv = null; $('#abspielen').innerHTML = ic('play'); return; } $('#abspielen').innerHTML = ic('pause'); transIv = setInterval(() => { if (!$('#transkript')) { clearInterval(transIv); transIv = null; return; } setz((i + 1) % TRANS.length); }, 1600); setz(Math.max(0, i)); };
    $$('#transkript .tz').forEach(b => b.onclick = () => setz(+b.parentNode.dataset.i));
    $('#trKarten').onclick = () => { STAPEL[1].karten += 4; $('#trInfo').textContent = '4 Karten im Stapel Angststörungen.'; };
  }
});

/* Chat */
S.chat = [['Lea', '10:12', 'Ich bringe das Arbeitsblatt zur Panikstörung mit.'], ['Jonas', '10:20', 'Super. Wer übernimmt die Entkatastrophisierung?'], ['Lea', '11:34', 'Didi hat seine Notiz geteilt:', 'notiz']];
VIEWS.chat = () => ({
  k: liK('Gruppen', [kE({ href: '#/chat', f: 'vt', n: 'Lerngruppe VT', s: 'Lea, Jonas und du', z: 2, cur: true }), kE({ f: 'ml', n: 'Statistik-Übung', s: '5 Personen' })]) + liK('Direkt', [kE({ icon: 'chat', n: 'Lea' }), kE({ icon: 'chat', n: 'Jonas' })]),
  v: `<div class="chatkopf"><h1>Lerngruppe VT</h1><span class="info">Lea, Jonas und du</span></div><div class="gespraech chat">${S.chat.map(([w, t, x, a]) => `<div class="nachricht${w === 'Du' ? ' ich' : ''}"><p class="wer">${w}<span>${t}</span></p><p>${esc(x)}</p>${a ? `<a class="aktionskarte" href="#/notizen/vt-gruppe"><span class="ico">${ic('notiz')}</span><div><strong>Lerngruppe VT</strong><span>Notiz, 312 Wörter</span></div></a>` : ''}</div>`).join('')}</div>
    <form class="eingabe2" id="chatForm"><label for="chatFeld" class="vh">Nachricht</label><input id="chatFeld" name="nachricht" type="text" placeholder="Nachricht an Lerngruppe VT" autocomplete="off"><button class="knopf haupt klein" type="submit">Senden</button></form>`,
  nach: () => { $('#chatForm').onsubmit = e => { e.preventDefault(); const v = $('#chatFeld').value.trim(); if (!v) return; const d = new Date(); S.chat.push(['Du', `${p2(d.getHours())}:${p2(d.getMinutes())}`, v]); zeige(); setTimeout(() => $('#chatFeld')?.focus(), 50); }; }
});

/* Textverarbeitung */
VIEWS.textverarbeitung = () => ({
  k: liK('Gliederung', ['1 Einleitung', '2 Kognitive Modelle', '2.1 Automatische Gedanken', '2.2 Grundannahmen', '3 Techniken', '4 Fazit'].map((n, i) => kE({ icon: 'text', n, cur: i === 2 }))) + liK('Dokumente', [kE({ f: 'vt', n: 'Referat: Kognitive Techniken', s: 'Abgabe 9. Dezember' }), kE({ f: 'ml', n: 'Ergebnisteil Regression', s: 'Entwurf' })]),
  v: `<div class="schreibleiste"><span class="info"><span class="zahl">642</span> von 1500 Wörtern</span><span class="balkenk ziel" aria-hidden="true"><i style="transform:scaleX(.43)"></i></span><div class="rechts"><button class="knopf leise klein" type="button" id="zitieren">${ic('buch')}Zitat einfügen</button><button class="knopf neben klein" type="button" id="feedback">${ic('funke')}Feedback</button></div></div>
    <article class="notiz dokument"><p class="meta">${fach('vt')}<span>Referat, Abgabe 9. Dezember</span></p><h1 contenteditable="true" spellcheck="false">Kognitive Techniken in der Verhaltenstherapie</h1>
    <div class="text" contenteditable="true" id="doktext"><h2>2.1 Automatische Gedanken</h2><p>Automatische Gedanken sind spontane, oft unbemerkte Bewertungen einer Situation. Sie wirken plausibel, auch wenn sie verzerrt sind (Beck, 2011).</p><p>In der Therapie werden sie zuerst sichtbar gemacht, etwa mit einem Gedankenprotokoll, und anschließend im sokratischen Dialog geprüft.</p></div>
    <div id="fb"></div></article>`,
  nach: () => {
    $('#zitieren').onclick = () => { $('#doktext').insertAdjacentHTML('beforeend', '<p>Exposition gilt bei Angststörungen als Verfahren mit der besten Evidenz (Margraf &amp; Schneider, 2018).</p>'); };
    $('#feedback').onclick = () => { $('#fb').innerHTML = `<div class="vorschlaege"><p class="kopf2">${ic('funke')}Feedback zu Abschnitt 2.1</p><ol><li><b>Beispiel ergänzen</b><span>Ein konkreter automatischer Gedanke macht die Definition greifbar.</span></li><li><b>Begriff einführen</b><span>„Gedankenprotokoll“ wird genannt, aber nicht erklärt.</span></li><li><b>Übergang</b><span>Der Schritt zu 2.2 Grundannahmen fehlt noch.</span></li></ol></div>`; };
  }
});

/* Tabellen */
const DATEN = [[1, 34, 12, 3.1], [2, 41, 6, 2.4], [3, 22, 18, 3.8], [4, 38, 9, 2.9], [5, 29, 15, 3.5], [6, 45, 4, 2.0], [7, 27, 14, 3.6], [8, 33, 11, 3.0]];
VIEWS.tabellen = () => {
  const m = j => DATEN.reduce((a, r) => a + r[j], 0) / DATEN.length;
  return {
    k: liK('Tabellen', [kE({ icon: 'tabelle', n: 'pruefung.csv', s: 'Methodenlehre, 120 Fälle', cur: true }), kE({ icon: 'tabelle', n: 'Lernzeit November', s: 'eigene Auswertung' })]) + liK('Auswertung', [kE({ icon: 'funke', n: 'Angst mit Lernzeit', z: 'r = −.42' }), kE({ icon: 'funke', n: 'Angst mit SWK', z: 'r = −.51' })]),
    v: seitenkopf('pruefung.csv', 'Erste 8 von 120 Fällen. Für die Statistik-Übung, Aufgabe 1.', `<button class="knopf neben" type="button">${ic('funke')}Korrelationen berechnen</button>`) +
      `<div class="tab-rahmen"><table class="tabelle raster2"><thead><tr><th scope="col" class="num">Fall</th><th scope="col" class="num">Prüfungsangst</th><th scope="col" class="num">Lernzeit (h)</th><th scope="col" class="num">Selbstwirksamkeit</th></tr></thead><tbody>${DATEN.map(r => `<tr>${r.map((v, j) => `<td class="num" contenteditable="${j ? 'true' : 'false'}">${String(v).replace('.', ',')}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row" class="num">Mittelwert</th>${[1, 2, 3].map(j => `<td class="num">${m(j).toFixed(j === 3 ? 2 : 1).replace('.', ',')}</td>`).join('')}</tr></tfoot></table></div>`
  };
};

/* Präsentationen */
const FOLIEN = [['Kognitive Techniken', 'Referat Verhaltenstherapie, 9. Dezember'], ['Automatische Gedanken', 'Spontan, plausibel, oft verzerrt'], ['Sokratischer Dialog', 'Fragen statt Widerlegen'], ['Fazit', 'Gedanken prüfen, nicht bekämpfen']];
VIEWS.praesentationen = r => {
  const n = Math.min(Math.max(1, +r.a || 1), FOLIEN.length);
  return {
    k: liK('Folien', FOLIEN.map(([t], i) => `<li><a class="folie-mini${i + 1 === n ? ' an' : ''}" href="#/praesentationen/${i + 1}"${i + 1 === n ? ' aria-current="page"' : ''}><span class="nr">${i + 1}</span><span class="vs"><b>${esc(t)}</b></span></a></li>`)),
    pfad: `${ic('folie')}<span>Präsentationen</span><span class="sub">/</span><span class="sub">Referat VT</span>`,
    v: `<div class="pdf-leiste"><a class="symbolknopf" href="#/praesentationen/${n - 1}" aria-label="Vorige Folie"${n === 1 ? ' aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"' : ''}>${ic('links')}</a><span>Folie <span class="zahl">${n}</span> von ${FOLIEN.length}</span><a class="symbolknopf" href="#/praesentationen/${n + 1}" aria-label="Nächste Folie"${n === FOLIEN.length ? ' aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"' : ''}>${ic('pfeil')}</a><div class="rechts"><button class="knopf leise klein" type="button">${ic('notiz')}Aus Notiz erstellen</button><button class="knopf haupt klein" type="button">${ic('play')}Vorführen</button></div></div>
      <div class="pdf-buehne"><div class="folie"><h2 contenteditable="true">${esc(FOLIEN[n - 1][0])}</h2><p contenteditable="true">${esc(FOLIEN[n - 1][1])}</p><span class="folie-marke" aria-hidden="true">${MARKE}</span></div></div>`
  };
};

/* MindMap */
const MM = { mitte: 'Angststörungen', aeste: [['Panikstörung', ['Attacken', 'Erwartungsangst']], ['Agoraphobie', ['Flucht schwierig']], ['Generalisiert', ['Sorgen']], ['Sozial', ['Bewertung']], ['Behandlung', ['KVT', 'Exposition']]] };
VIEWS.mindmap = () => {
  const cx = 450, cy = 260, R = 190; let svg = '';
  MM.aeste.forEach(([n, kinder], i) => {
    const a = (i / MM.aeste.length) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * R * 1.15, y = cy + Math.sin(a) * R * .7;
    svg += `<path class="ast" d="M${cx} ${cy} Q${(cx + x) / 2} ${cy} ${x} ${y}"/>`;
    kinder.forEach((k, j) => { const kx = x + (x >= cx ? 1 : -1) * 120, ky = y + (j - (kinder.length - 1) / 2) * 34; svg += `<path class="ast fein" d="M${x} ${y} L${kx} ${ky}"/><g class="mknoten klein" tabindex="0"><text x="${kx + (x >= cx ? 8 : -8)}" y="${ky + 4}" text-anchor="${x >= cx ? 'start' : 'end'}">${k}</text><circle cx="${kx}" cy="${ky}" r="3"/></g>`; });
    svg += `<g class="mknoten" tabindex="0" role="button" aria-label="${n}"><rect x="${x - 62}" y="${y - 17}" width="124" height="34" rx="17"/><text x="${x}" y="${y + 5}" text-anchor="middle">${n}</text></g>`;
  });
  svg += `<g class="mknoten mitte" tabindex="0"><rect x="${cx - 84}" y="${cy - 22}" width="168" height="44" rx="22"/><text x="${cx}" y="${cy + 6}" text-anchor="middle">${MM.mitte}</text></g>`;
  return {
    k: liK('MindMaps', [kE({ icon: 'mind', n: 'Angststörungen', s: 'Klinische Psychologie', cur: true }), kE({ icon: 'mind', n: 'Testgütekriterien', s: 'Diagnostik' })]),
    v: seitenkopf('Angststörungen', '5 Äste, 13 Knoten. Ein Knoten lässt sich mit einem Klick auswählen.', `<button class="knopf neben" type="button">${ic('karten')}Als Karteikarten</button>`) + `<div class="mm-rahmen"><svg class="mindmap" viewBox="0 0 900 520" role="group" aria-label="MindMap Angststörungen">${svg}</svg></div>`,
    nach: () => { $$('.mknoten').forEach(g => g.onclick = () => { $$('.mknoten').forEach(x => x.classList.remove('an')); g.classList.add('an'); }); }
  };
};

/* Whiteboard */
S.zettel = [[60, 50, 'f4', 'Fallbeispiel Panikstörung: Lea bringt Arbeitsblatt'], [330, 90, 'f2', 'Entkatastrophisierung: Schlimmstes, Bestes, Wahrscheinlichstes'], [140, 250, 'f1', 'Beweise für und gegen den Gedanken sammeln'], [420, 290, 'f3', 'Rollenspiel: Therapeutin und Patient']];
VIEWS.whiteboard = () => ({
  k: liK('Boards', [kE({ icon: 'tafel', n: 'Lerngruppe VT', s: 'mit Lea und Jonas', cur: true }), kE({ icon: 'tafel', n: 'Referat Ideen', s: 'nur du' })]) + liK('Werkzeuge', [kE({ icon: 'notiz', n: 'Zettel', s: 'Doppelklick auf die Fläche' }), kE({ icon: 'stift', n: 'Stift', s: 'bald' })]),
  v: `<div class="tafelleiste"><button class="knopf neben klein" type="button" id="zettelNeu">${ic('plus')}Zettel</button><span class="info">Zettel lassen sich ziehen. Lea und Jonas sehen Änderungen sofort.</span></div>
    <div class="tafel" id="tafel">${S.zettel.map(([x, y, c, t], i) => `<div class="zettel" style="--c:var(--${c});transform:translate(${x}px,${y}px)" data-i="${i}" tabindex="0"><p contenteditable="true">${esc(t)}</p></div>`).join('')}</div>`,
  nach: () => {
    const tafel = $('#tafel');
    $$('.zettel', tafel).forEach(z => { z.onpointerdown = e => { if (e.target.isContentEditable && document.activeElement === e.target) return; const i = +z.dataset.i, sx = e.clientX - S.zettel[i][0], sy = e.clientY - S.zettel[i][1]; z.setPointerCapture(e.pointerId); z.classList.add('zieht'); z.onpointermove = ev => { S.zettel[i][0] = Math.max(0, ev.clientX - sx); S.zettel[i][1] = Math.max(0, ev.clientY - sy); z.style.transform = `translate(${S.zettel[i][0]}px,${S.zettel[i][1]}px)`; }; z.onpointerup = () => { z.onpointermove = null; z.classList.remove('zieht'); }; }; });
    const neu = (x, y) => { S.zettel.push([x, y, 'f2', 'Neuer Zettel']); zeige(); };
    $('#zettelNeu').onclick = () => neu(40 + S.zettel.length * 20, 40 + S.zettel.length * 16);
    tafel.ondblclick = e => { if (e.target === tafel) { const r = tafel.getBoundingClientRect(); neu(e.clientX - r.left - 90, e.clientY - r.top - 30); } };
  }
});

/* PDF Reader: Markerfarben und Fragen */
const pdfAlt = VIEWS.pdf;
S.pdf.farbe = 0; S.pdf.frage = false;
VIEWS.pdf = r => {
  const o = pdfAlt(r), d = DOKS.find(x => x.id === r.a) || DOKS[0];
  const farben = ['gelb', 'grün', 'blau', 'rosa', 'violett'];
  o.v = o.v.replace('<span class="trenn" aria-hidden="true"></span><button class="symbolknopf" type="button" id="markieren"',
    `<span class="trenn" aria-hidden="true"></span><span class="farben" role="group" aria-label="Markerfarbe">${farben.map((f, i) => `<button type="button" class="farbe m${i}" aria-label="Marker ${f}" aria-pressed="${S.pdf.farbe === i}" data-farbe="${i}"></button>`).join('')}</span><button class="knopf leise klein" type="button" id="pdfFrage" aria-pressed="${S.pdf.frage}">${ic('funke')}Fragen</button><button class="symbolknopf" type="button" id="markieren"`)
    .replace('<div class="pdf-buehne">', `${S.pdf.frage ? `<div class="pdf-frage"><form id="pdfFrageForm"><label for="pfFeld" class="vh">Frage an dieses Dokument</label><input id="pfFeld" type="text" placeholder="Frag „${esc(d.t)}“" autocomplete="off"><button class="knopf haupt klein" type="submit">Fragen</button></form><div id="pfAntwort" aria-live="polite"></div></div>` : ''}<div class="pdf-buehne">`);
  const nach = o.nach;
  o.nach = () => {
    nach();
    $$('[data-farbe]').forEach(b => b.onclick = () => { S.pdf.farbe = +b.dataset.farbe; $$('[data-farbe]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.documentElement.style.setProperty('--markierung-wahl', `var(--m${S.pdf.farbe})`); });
    $('#pdfFrage').onclick = () => { S.pdf.frage = !S.pdf.frage; zeige(); };
    $('#pdfFrageForm') && ($('#pdfFrageForm').onsubmit = e => { e.preventDefault(); $('#pfAntwort').innerHTML = `<p>Laut Seite 2 sollen die standardisierten Koeffizienten interpretiert und verglichen werden. <a class="quelle" href="#/pdf/${d.id}/2">${ic('pdf')}Seite 2</a></p>`; });
  };
  return o;
};

/* ---------- Lernraum (wie NotebookLM): Quellen eines Fachs, Fragen laufen über Studio, Stand je Thema ---------- */
const LR_QUELLEN = {
  di: [['Testgütekriterien.pdf', 'pdf', 1], ['Diagnostik: Testtheorie', 'notiz', 1], ['Literaturliste Diagnostik.pdf', 'pdf', 0]],
  kp: [['Vorlesung 4, Angststörungen.pdf', 'pdf', 1], ['Vorlesung 4: Angststörungen', 'notiz', 1], ['Fallbeispiel Panikstörung.docx', 'datei', 1]],
  ml: [['Übungsblatt 3, Regression.pdf', 'pdf', 1], ['Übung: Regression', 'notiz', 1], ['pruefung.csv', 'tabelle', 0]],
  vt: [['Lerngruppe VT', 'notiz', 1], ['Beck (2011), Cognitive behavior therapy', 'buch', 1]]
};
const LR_STAND = { di: [['Objektivität', .9], ['Reliabilität', .82], ['Validität', .64], ['Normierung', .38]], kp: [['Exposition', .81], ['Panikstörung', .74], ['Agoraphobie', .52]], ml: [['Multiple Regression', .58], ['Residuen', .44], ['Multikollinearität', .31]], vt: [['Sokratischer Dialog', .7], ['Kognitive Umstrukturierung', .46]] };
S.lr = {};
VIEWS.lernraum = r => {
  const f = F[r.a] ? r.a : 'di', fn = F[f][0], q = LR_QUELLEN[f], stand = LR_STAND[f];
  S.lr[f] ||= q.map(x => x[2] === 1);
  const aktiv = S.lr[f].filter(Boolean).length, schwach = stand.reduce((a, b) => a[1] < b[1] ? a : b)[0];
  const vor = [`Fass ${fn} in fünf Sätzen zusammen`, `Erstell mir einen Lernzettel zu ${stand[0][0]}`, `Frag mich zu ${schwach} ab`];
  const icon = t => ({ notiz: 'notiz', buch: 'buch', tabelle: 'tabelle', datei: 'datei' }[t] || 'pdf');
  return {
    pfad: `${ic('lernraum')}<span>Lernraum</span><span class="sub">/</span><span class="sub">${fn}</span>`,
    k: liK('Fächer', Object.keys(F).map(k => kE({ href: `#/lernraum/${k}`, f: k, n: F[k][0], s: `${LR_QUELLEN[k].length} Quellen`, cur: k === f }))),
    v: seitenkopf(fn, `${aktiv} von ${q.length} Quellen aktiv. Studio antwortet nur aus diesen Quellen und belegt jede Aussage.`, `<button class="knopf haupt" type="button" data-studio="${esc(vor[0])}">${ic('funke')}In Studio fragen</button><button class="knopf leise" type="button">${ic('plus')}Quelle</button>`)
      + `<div class="lr"><section class="lr-quellen" aria-labelledby="lrq"><div class="kopfzeile"><h2 id="lrq">Quellen</h2><span class="info">${aktiv} aktiv</span></div><ul class="lr-liste">${q.map(([t, i], n) => `<li><label class="lr-q"><input type="checkbox" data-lrq="${n}"${S.lr[f][n] ? ' checked' : ''}><span class="ico">${ic(icon(i))}</span><span class="n">${esc(t)}</span></label><button class="symbolknopf" type="button" data-daneben="${i === 'notiz' ? 'notizen' : 'pdf'}" aria-label="${esc(t)} daneben öffnen">${ic('gross')}</button></li>`).join('')}</ul></section>
      <section class="lr-mitte" aria-labelledby="lrs"><div class="kopfzeile"><h2 id="lrs">Fragen an ${fn}</h2></div><div class="lr-vorschlaege">${vor.map(v => `<button class="quelle" type="button" data-studio="${esc(v)}">${ic('funke')}${esc(v)}</button>`).join('')}</div><p class="hinweis">Antworten, Lernzettel, FAQ und Quiz entstehen in UniVerse Studio. Erklärweise: Coach.</p>
      <div class="kopfzeile"><h2 id="lrst">Dein Stand</h2><span class="info">aus Quiz und Karteikarten</span></div><ul class="stand">${stand.map(([t, w]) => `<li><span class="n">${t}</span><span class="balkenk" style="--c:${w < .5 ? 'var(--color-error)' : w < .75 ? 'var(--f2)' : 'var(--ok)'}"><i style="width:${Math.round(w * 100)}%"></i></span><span class="zahl">${Math.round(w * 100)} %</span></li>`).join('')}</ul><div class="abschnitt-fuss"><button class="knopf neben klein" type="button" data-studio="Frag mich zu meinen schwachen Themen in ${fn} ab. Erst eine Frage, dann warten.">${ic('funke')}Schwache Themen üben</button></div></section></div>`,
    nach: () => { $$('[data-lrq]').forEach(c => c.onchange = () => { S.lr[f][+c.dataset.lrq] = c.checked; zeige(); }); }
  };
};

/* ---------- Quiz bei den Karteikarten, Lern-Podcast in der Transkription ---------- */
S.quiz = [['Testgütekriterien', 'di', 12, '9 von 12', 'gestern'], ['Angststörungen', 'kp', 10, '6 von 10', '12. November']];
S.quizForm = null;
const FRAGETYPEN = ['Multiple Choice', 'Wahr oder falsch', 'Lückentext', 'Zuordnen', 'Freitext'];
const kkAlt = VIEWS.karteikarten;
VIEWS.karteikarten = r => {
  const o = kkAlt(r); if (r.a === 'lernen') return o;
  const fm = S.quizForm;
  o.v += `<section class="quiz" aria-labelledby="qz"><div class="kopfzeile"><h2 id="qz">Quiz</h2><span class="info">Mehrere Fragetypen, Studio bewertet freie Antworten</span>${fm ? '' : `<button class="knopf neben klein rechts" type="button" id="quizNeu">${ic('plus')}Neues Quiz</button>`}</div>
    ${fm ? `<div class="formular" role="group" aria-label="Neues Quiz"><div class="p-zeile"><span class="p-label">Fach</span><div class="segment" role="group" aria-label="Fach">${Object.keys(F).map(k => `<button type="button" data-qf="${k}" aria-pressed="${fm.f === k}">${F[k][2]}</button>`).join('')}</div></div>
      <div class="p-zeile"><span class="p-label">Fragetypen</span><div class="chips" role="group" aria-label="Fragetypen">${FRAGETYPEN.map((t, i) => `<button class="chip" type="button" data-qt="${i}" aria-pressed="${fm.t.includes(i)}">${t}</button>`).join('')}</div></div>
      <div class="p-zeile"><span class="p-label">Fragen</span><div class="segment" role="group" aria-label="Anzahl">${[5, 10, 15].map(n => `<button type="button" data-qn="${n}" aria-pressed="${fm.n === n}">${n}</button>`).join('')}</div></div>
      <div class="formular-fuss"><button class="knopf leise klein" type="button" id="quizAbbr">Abbrechen</button><button class="knopf haupt klein" type="button" id="quizOk"${fm.t.length ? '' : ' disabled'}>Quiz erstellen</button></div></div>` : ''}
    <div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Quiz</th><th scope="col" class="weg">Fach</th><th scope="col" class="num">Fragen</th><th scope="col" class="num weg">Zuletzt richtig</th><th scope="col"><span class="vh">Aktion</span></th></tr></thead><tbody>${S.quiz.map(([t, f, n, e, d]) => `<tr><td><span class="name"><span class="ico">${ic('funke')}</span><span>${esc(t)}<small>${d}</small></span></span></td><td class="weg">${fach(f)}</td><td class="num">${n}</td><td class="num weg">${e}</td><td style="text-align:right"><button class="knopf leise klein" type="button" data-studio="Frag mich zu den schwachen Fragen aus dem Quiz ${esc(t)} ab.">Schwächen üben</button></td></tr>`).join('')}</tbody></table></div></section>`;
  const n = o.nach;
  o.nach = () => {
    n && n();
    $('#quizNeu') && ($('#quizNeu').onclick = () => { S.quizForm = { f: 'di', t: [0, 1, 4], n: 10 }; zeige(); $('[data-qf="di"]')?.focus(); });
    $$('[data-qf]').forEach(b => b.onclick = () => { S.quizForm.f = b.dataset.qf; zeige(); });
    $$('[data-qt]').forEach(b => b.onclick = () => { const t = S.quizForm.t, i = +b.dataset.qt; t.includes(i) ? t.splice(t.indexOf(i), 1) : t.push(i); zeige(); $(`[data-qt="${i}"]`)?.focus(); });
    $$('[data-qn]').forEach(b => b.onclick = () => { S.quizForm.n = +b.dataset.qn; zeige(); });
    $('#quizAbbr') && ($('#quizAbbr').onclick = () => { S.quizForm = null; zeige(); });
    $('#quizOk') && ($('#quizOk').onclick = e => { const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="umlauf mini" aria-hidden="true"><i></i></span>Studio schreibt Fragen'; setTimeout(() => { const fm2 = S.quizForm; S.quiz.unshift([F[fm2.f][0], fm2.f, fm2.n, 'noch offen', 'gerade eben']); S.quizForm = null; zeige(); ansage('Quiz erstellt.'); }, 1100); });
  };
  return o;
};
S.podcasts = [['Angststörungen in acht Minuten', 'kp', '8 min'], ['Regression erklärt', 'ml', '12 min']]; S.podForm = null; S.podSpielt = -1;
const trAlt = VIEWS.transkription;
VIEWS.transkription = r => {
  const o = trAlt(r), pf = S.podForm;
  o.v += `<section class="podcasts" aria-labelledby="pc"><div class="kopfzeile"><h2 id="pc">Lern-Podcasts</h2><span class="info">Dein Material als Gespräch zweier Stimmen</span>${pf ? '' : `<button class="knopf neben klein rechts" type="button" id="podNeu">${ic('plus')}Podcast erstellen</button>`}</div>
    ${pf ? `<div class="formular" role="group" aria-label="Neuer Podcast"><div class="p-zeile"><span class="p-label">Fach</span><div class="segment" role="group" aria-label="Fach">${Object.keys(F).map(k => `<button type="button" data-pf="${k}" aria-pressed="${pf.f === k}">${F[k][2]}</button>`).join('')}</div></div><div class="p-zeile"><span class="p-label">Länge</span><div class="segment" role="group" aria-label="Länge">${[['kurz', 'Kurz, 5 min'], ['mittel', 'Mittel, 10 min'], ['lang', 'Lang, 20 min']].map(([w, n]) => `<button type="button" data-pl="${w}" aria-pressed="${pf.l === w}">${n}</button>`).join('')}</div></div><div class="formular-fuss"><button class="knopf leise klein" type="button" id="podAbbr">Abbrechen</button><button class="knopf haupt klein" type="button" id="podOk">Podcast erstellen</button></div></div>` : ''}
    <ul class="pod-liste">${S.podcasts.map(([t, f, d], i) => `<li><button class="symbolknopf gross" type="button" data-pod="${i}" aria-label="${esc(t)} ${S.podSpielt === i ? 'pausieren' : 'abspielen'}">${ic(S.podSpielt === i ? 'pause' : 'play')}</button><span class="n">${esc(t)}<small>${F[f][0]}, ${d}</small></span>${S.podSpielt === i ? '<span class="spur" aria-hidden="true"><i style="transform:scaleX(.18)"></i></span>' : ''}</li>`).join('')}</ul></section>`;
  const n = o.nach;
  o.nach = () => {
    n && n();
    $('#podNeu') && ($('#podNeu').onclick = () => { S.podForm = { f: 'kp', l: 'kurz' }; zeige(); });
    $$('[data-pf]').forEach(b => b.onclick = () => { S.podForm.f = b.dataset.pf; zeige(); });
    $$('[data-pl]').forEach(b => b.onclick = () => { S.podForm.l = b.dataset.pl; zeige(); });
    $('#podAbbr') && ($('#podAbbr').onclick = () => { S.podForm = null; zeige(); });
    $('#podOk') && ($('#podOk').onclick = e => { const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="umlauf mini" aria-hidden="true"><i></i></span>Wird gesprochen'; setTimeout(() => { const p = S.podForm; S.podcasts.unshift([`${F[p.f][0]}, ${p.l === 'kurz' ? 'kurz' : p.l === 'mittel' ? 'ausführlich' : 'in der Tiefe'}`, p.f, { kurz: '5 min', mittel: '10 min', lang: '20 min' }[p.l]]); S.podForm = null; zeige(); ansage('Podcast erstellt.'); }, 1200); });
    $$('[data-pod]').forEach(b => b.onclick = () => { const i = +b.dataset.pod; S.podSpielt = S.podSpielt === i ? -1 : i; zeige(); $(`[data-pod="${i}"]`)?.focus(); });
  };
  return o;
};

/* ---------- UniVerse Studio: ein Chat für die ganze App (⌘J), kennt die aktuelle Ansicht ---------- */
S.studio = { offen: false, gross: false, privat: false, verlauf: [], markiert: '' };
const STUDIO_START = ['Plan mit mir meinen Tag', 'Erklär mir, was ich gerade sehe', 'Frag mich zu meinen schwachen Themen ab'];
function studioSieht() {
  const r = route(), b = bereich(r.b);
  if (r.b === 'notizen') return `Notiz „${(NOTIZEN.find(n => n.id === r.a) || NOTIZEN[0]).t}“`;
  if (r.b === 'pdf') { const d = DOKS.find(x => x.id === r.a) || DOKS[0]; return `${d.t}, Seite ${r.c || 1}`; }
  if (r.b === 'karteikarten' && r.a === 'lernen' && lern && !lern.ende && lern.karten[lern.queue[lern.pos]]) return `Karte „${lern.karten[lern.queue[lern.pos]].q}“`;
  if (r.b === 'lernraum') return `Lernraum ${F[r.a] ? F[r.a][0] : 'Diagnostik'}`;
  if (r.b === 'hub' && HUBSEITEN[r.a]) return `Zentraler Hub, ${HUBSEITEN[r.a][0]}`;
  return b.n;
}
function studioAntwort(frage) {
  const f = frage.toLowerCase();
  if (f.includes('tag')) return { t: ['Morgen um 23:59 ist die Statistik-Abgabe, deshalb kommt die Übung zuerst. Die fälligen Karten passen in die Lücken davor und danach.', '15:30 Regression wiederholen, 20 min. 16:00 Statistik-Übung, Aufgabe 3. 17:45 Testgütekriterien, Runde 2.'], karte: ['3 Blöcke für heute', 'landen in „Heute“ im Zentralen Hub', 'Einplanen'] };
  if (f.includes('was ich gerade') || f.includes('erklär')) return { t: [`Du siehst gerade ${studioSieht()}. Der Kern in einem Satz: Ein Test kann genau messen und trotzdem das Falsche messen.`, 'Reliabilität ist die Genauigkeit, Validität sagt, ob das richtige Merkmal gemessen wird.'], quellen: [['pdf', 'Testgütekriterien, Seite 1', '#/pdf/testguete/1'], ['notiz', 'Diagnostik: Testtheorie', '#/notizen/diagnostik']] };
  if (f.includes('ab')) return { t: ['Erste Frage: Was unterscheidet die Retest-Reliabilität von der internen Konsistenz?', 'Antworte in eigenen Worten. Ich bewerte danach und sage dir, was fehlt.'] };
  if (f.includes('zusammen') || f.includes('lernzettel')) return { t: ['Hier ist der Lernzettel, jede Aussage mit Beleg aus deinen Quellen.', 'Objektivität: Ergebnis hängt nicht von der Person ab, die testet. Reliabilität: Messgenauigkeit. Validität: misst das gemeinte Merkmal.'], quellen: [['pdf', 'Testgütekriterien, Seite 1', '#/pdf/testguete/1']], karte: ['3 Karteikarten aus diesem Lernzettel', 'für den Stapel Testgütekriterien', 'Übernehmen'] };
  return { t: ['Im Dummy antwortet Studio mit Beispielen. In der App sucht Studio in deinen Quellen, nennt die Stellen und kann Aufgaben, Karten und Notizen anlegen.'] };
}
function studioNachricht(m, i) {
  if (m.ich) return `<div class="nachricht ich"><p>${esc(m.ich)}</p></div>`;
  if (m.laedt) return `<div class="nachricht ki"><p class="wer ki-wer">${ic('funke')}Studio</p><p class="sd-schreibt"><span class="umlauf mini" aria-hidden="true"><i></i></span>Schreibt</p></div>`;
  const a = m.ki;
  return `<div class="nachricht ki"><p class="wer ki-wer">${ic('funke')}Studio</p>${a.t.map(x => `<p>${esc(x)}</p>`).join('')}${a.quellen ? `<p class="quellen">${a.quellen.map(([i2, t, h]) => `<a class="quelle" href="${h}">${ic(i2)}${esc(t)}</a>`).join('')}</p>` : ''}${a.karte ? `<div class="aktionskarte"><div><strong>${a.karte[0]}</strong><span>${a.karte[1]}</span></div>${m.erledigt ? '<span class="info">Erledigt</span>' : `<button class="knopf neben klein" type="button" data-sdkarte="${i}">${a.karte[2]}</button>`}</div>` : ''}</div>`;
}
function studioZeichnen(fokus) {
  const el = $('#studio'), app = $('.app'), o = S.studio.offen;
  app.classList.toggle('studio-offen', o); app.classList.toggle('studio-gross', o && S.studio.gross);
  $$('#studioKnopf,#studioMobil').forEach(b => b.setAttribute('aria-pressed', o));
  el.hidden = !o; if (!o) { el.innerHTML = ''; return; }
  const v = S.studio.verlauf;
  el.innerHTML = `<div class="sd-kopf"><h2 class="sd-name">${ic('funke')}UniVerse Studio</h2><span class="sd-knoepfe"><button class="symbolknopf" type="button" id="sdNeu" aria-label="Neuer Chat"${v.length ? '' : ' disabled'}>${ic('plus')}</button><button class="symbolknopf" type="button" id="sdPrivat" aria-pressed="${S.studio.privat}" aria-label="Privater Chat">${ic('auge')}</button><button class="symbolknopf nur-gross" type="button" id="sdGross" aria-pressed="${S.studio.gross}" aria-label="${S.studio.gross ? 'Studio verkleinern' : 'Studio vergrößern'}">${ic(S.studio.gross ? 'klein' : 'gross')}</button><button class="symbolknopf" type="button" id="sdZu" aria-label="Studio schließen">${ic('x')}</button></span></div>
    <p class="sd-sieht">Sieht gerade <b>${esc(studioSieht())}</b></p>
    ${S.studio.privat ? '<p class="sd-hinweis">Privater Chat. Studio lernt nichts aus diesem Gespräch.</p>' : ''}
    ${S.offline ? region('offline', 'Offline.', 'Studio braucht eine Verbindung. Deine Frage wird gesendet, sobald du wieder online bist.') : ''}
    <div class="sd-verlauf" id="sdVerlauf" aria-live="polite">${v.length ? v.map(studioNachricht).join('') : `<div class="sd-leer"><p>Frag alles zu deinen Unterlagen. Studio kennt, was du gerade siehst, belegt seine Antworten und legt auf Wunsch Aufgaben, Karten und Notizen an.</p><div class="sd-start">${STUDIO_START.map(x => `<button class="quelle" type="button" data-studio="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`}</div>
    ${S.studio.markiert ? `<p class="sd-markiert"><span>Markiert: „${esc(S.studio.markiert)}“</span><button class="symbolknopf" type="button" id="sdMarkWeg" aria-label="Markierung nicht mitnehmen">${ic('x')}</button></p>` : ''}
    <form class="sd-eingabe" id="sdForm"><label for="sdFeld" class="vh">Frage an Studio</label><input id="sdFeld" type="text" placeholder="Frag Studio" autocomplete="off"><button class="knopf haupt klein" type="submit">Senden</button></form>`;
  $('#sdZu').onclick = () => { S.studio.offen = false; studioZeichnen(); $('#studioKnopf')?.focus(); };
  $('#sdNeu').onclick = () => { S.studio.verlauf = []; studioZeichnen(); ansage('Neuer Chat. Studio behält, was es über dich weiß.'); $('#sdFeld').focus(); };
  $('#sdPrivat').onclick = () => { S.studio.privat = !S.studio.privat; studioZeichnen(); $('#sdPrivat').focus(); };
  $('#sdGross').onclick = () => { S.studio.gross = !S.studio.gross; studioZeichnen(); $('#sdGross').focus(); };
  $('#sdMarkWeg') && ($('#sdMarkWeg').onclick = () => { S.studio.markiert = ''; studioZeichnen(); $('#sdFeld').focus(); });
  $$('[data-sdkarte]', el).forEach(b => b.onclick = () => { S.studio.verlauf[+b.dataset.sdkarte].erledigt = true; if (/Einplanen/.test(b.textContent)) VORSCHLAEGE.forEach((_, i) => { if (!S.planExtra.includes(i)) S.planExtra.push(i); }); studioZeichnen(); hubNeu(); ansage('Erledigt.'); });
  $('#sdForm').onsubmit = e => { e.preventDefault(); const t = $('#sdFeld').value.trim(); if (t) studioFrage(t); };
  const vl = $('#sdVerlauf'); vl.scrollTop = vl.scrollHeight;
  if (fokus) $('#sdFeld').focus();
}
function studioFrage(t) {
  const v = S.studio.verlauf; v.push({ ich: t }); const m = { laedt: true }; v.push(m); S.studio.markiert = ''; studioZeichnen(true);
  setTimeout(() => { delete m.laedt; m.ki = studioAntwort(t); if (S.studio.offen) studioZeichnen(true); }, ruhig() ? 200 : 700);
}
function studioOeffnen(frage) {
  const sel = (getSelection?.() || '').toString().replace(/\s+/g, ' ').trim();
  if (!frage && sel && !$('#studio')?.contains(getSelection().anchorNode)) S.studio.markiert = sel.length > 90 ? sel.slice(0, 88) + '…' : sel;
  S.studio.offen = true; studioZeichnen(!frage);
  if (frage) studioFrage(frage);
}
const studioUmschalten = () => { if (S.studio.offen) { S.studio.offen = false; studioZeichnen(); } else studioOeffnen(); };
addEventListener('hashchange', () => { const b = $('#studio .sd-sieht b'); if (b) setTimeout(() => { b.textContent = studioSieht(); }, 50); });
document.addEventListener('click', e => {
  const s = e.target.closest('[data-studio]'); if (s) { e.preventDefault(); studioOeffnen(s.dataset.studio); return; }
  const d = e.target.closest('[data-daneben]'); if (d && typeof teilen === 'function') { e.preventDefault(); teilen(d.dataset.daneben); }
});
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'j') { e.preventDefault(); studioUmschalten(); } });

/* Schnell erfassen (Q) */
const schnell = document.createElement('div');
schnell.className = 'palette-hg'; schnell.id = 'schnell'; schnell.setAttribute('role', 'dialog'); schnell.setAttribute('aria-modal', 'true'); schnell.setAttribute('aria-label', 'Schnell erfassen');
schnell.innerHTML = `<div class="palette"><form class="eingabe" id="schnellForm"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg><label for="schnellFeld" class="vh">Schnell erfassen</label><input id="schnellFeld" type="text" placeholder="Aufgabe, Notiz oder Termin festhalten" autocomplete="off"><kbd>Esc</kbd></form><div class="schnell-art segment" role="group" aria-label="Art">${['Aufgabe', 'Notiz', 'Termin'].map((a, i) => `<button type="button" aria-pressed="${!i}" data-art="${a}">${a}</button>`).join('')}</div><p class="schnell-info" id="schnellInfo" aria-live="polite">Enter speichert. Taste Q öffnet das Feld in jedem Bereich.</p></div>`;
document.body.append(schnell);
let art = 'Aufgabe';
$$('[data-art]', schnell).forEach(b => b.onclick = () => { art = b.dataset.art; $$('[data-art]', schnell).forEach(x => x.setAttribute('aria-pressed', x === b)); $('#schnellFeld').focus(); });
const schnellAuf = () => { schnell.classList.add('offen'); $('#schnellFeld').value = ''; setTimeout(() => $('#schnellFeld').focus(), 30); };
const schnellZu = () => schnell.classList.remove('offen');
schnell.onclick = e => { if (e.target === schnell) schnellZu(); };
$('#schnellForm').onsubmit = e => {
  e.preventDefault(); const v = $('#schnellFeld').value.trim(); if (!v) return;
  if (art === 'Aufgabe') AUFGABEN.push({ id: Date.now(), t: v, f: 'ml', min: 25, fertig: false });
  if (art === 'Notiz') NOTIZEN.unshift({ id: 'n' + Date.now(), t: v, f: 'kp', zeit: 'gerade eben', html: '<p></p>', vorschlag: [] });
  $('#schnellInfo').textContent = `${art} gespeichert: „${v}“.`; $('#schnellFeld').value = '';
  if (['work-station', 'notizen'].includes(route().b)) zeige();
};
addEventListener('keydown', e => {
  const el = document.activeElement;
  if (e.key === 'Escape' && schnell.classList.contains('offen')) { schnellZu(); return; }
  if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT', 'TEXTAREA'].includes(el.tagName) && !el.isContentEditable && !$('#palette').classList.contains('offen') && !schnell.classList.contains('offen')) { e.preventDefault(); schnellAuf(); }
});

/* ---------- Befehlspalette ---------- */
const pal = $('#palette'), erg = $('.ergebnisse', pal), feld = $('#feld');
const E = [['Vorschläge', 'fokus', 'Fokus starten: Statistik-Übung', '25 min', () => { S.timer.aufgabe = 1; S.timer.laeuft = true; location.hash = '#/work-station'; }], ['Vorschläge', 'karten', 'Karteikarten wiederholen', '24 fällig', '#/karteikarten/lernen/testguete'], ['Vorschläge', 'pdf', 'Übungsblatt 3 öffnen', 'PDF', '#/pdf/uebung3'], ['Vorschläge', 'hoch', 'Datei hochladen', 'Befehl', '#/dateiablage'],
  ['Befehle', 'funke', 'UniVerse Studio öffnen', '⌘J', () => studioOeffnen()],
  ...ALLE.map(b => ['Daneben öffnen', b.i, `${b.n} daneben öffnen`, 'geteilte Ansicht', () => teilen(b.s)]),
  ['Befehle', 'raster', 'Personalisierung öffnen', 'Design und Anordnung', () => persOeffnen()], ['Befehle', 'mond', 'Design wechseln', 'Sternenhimmel oder Hochschule', () => designWahl(designAus() === 'nacht' ? 'hochschule' : 'nacht')], ['Befehle', 'hub', 'Hub anordnen', 'Zentraler Hub', () => hubAnordnen()],
  ...ALLE.map(b => ['Bereiche', b.i, b.n, b.g, `#/${b.s}`]), ...NOTIZEN.map(n => ['Notizen', 'notiz', n.t, F[n.f][2], `#/notizen/${n.id}`])];
let wahl = 0, treffer = [];
function liste(q = '') {
  treffer = E.filter(e => e[2].toLowerCase().includes(q.toLowerCase())); let h = '', g = '';
  treffer.forEach((e, n) => { if (e[0] !== g) { g = e[0]; h += `<p class="gt">${g}</p>`; } h += `<button class="zeile" type="button" role="option" aria-selected="${n === wahl}"><span class="ico">${ic(e[1])}</span><span class="n">${e[2]}</span><small>${e[3]}</small></button>`; });
  erg.innerHTML = h || '<p class="gt">Nichts gefunden. Versuche einen Fachnamen oder einen Bereich.</p>';
  $$('.zeile', erg).forEach((z, n) => { z.onmouseenter = () => { wahl = n; mark(); }; z.onclick = () => los(n); });
}
const mark = () => $$('.zeile', erg).forEach((z, n) => { z.setAttribute('aria-selected', n === wahl); if (n === wahl) z.scrollIntoView({ block: 'nearest' }); });
const los = n => { const e = treffer[n]; zu(); if (!e) return; typeof e[4] === 'function' ? e[4]() : (location.hash = e[4]); };
function auf() { wahl = 0; feld.value = ''; liste(); pal.classList.add('offen'); setTimeout(() => feld.focus(), 30); }
function zu() { pal.classList.remove('offen'); }
feld.oninput = e => { wahl = 0; liste(e.target.value); };
pal.onclick = e => { if (e.target === pal) zu(); };
$('#mehr').onclick = auf;
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && ['k', 'o'].includes(e.key.toLowerCase())) { e.preventDefault(); pal.classList.contains('offen') ? zu() : auf(); return; }
  if (!pal.classList.contains('offen')) return;
  const n = treffer.length;
  if (e.key === 'Escape') zu();
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); wahl = (wahl + 1) % n; mark(); }
  if (e.key === 'ArrowUp' && n) { e.preventDefault(); wahl = (wahl - 1 + n) % n; mark(); }
  if (e.key === 'Enter') { e.preventDefault(); los(wahl); }
});

/* ---------- Personalisierung: eigene Seite oder Seitenleiste ---------- */
const GRUPPEN = ['Täglich', 'Studium', 'Werkzeuge'];
function persHtml(kompakt) {
  const d = S.pers.design;
  const sek = (id, titel, text, inhalt) => `<section class="p-sek" aria-labelledby="ps-${id}${kompakt ? 'k' : ''}"><div class="p-kopf"><h2 id="ps-${id}${kompakt ? 'k' : ''}">${titel}</h2>${text ? `<p>${text}</p>` : ''}</div><div class="p-inhalt">${inhalt}</div></section>`;
  const segP = (name, wert, opts, label) => `<div class="segment" role="group" aria-label="${label}">${opts.map(([w, n]) => `<button type="button" data-p-${name}="${w}" aria-pressed="${wert === w}">${n}</button>`).join('')}</div>`;
  const zeile = (label, ctrl, info = '') => `<div class="p-zeile"><div><span class="p-label">${label}</span>${info ? `<span class="p-info">${info}</span>` : ''}</div>${ctrl}</div>`;
  const vorschau = (t, mini) => mini ? `<span class="dvorschau mini" data-vorschau="${t}" aria-hidden="true"><span class="dv-flaeche"><i class="dv-titel"></i><i></i><i class="dv-knopf"></i></span></span>`
    : `<span class="dvorschau" data-vorschau="${t}" aria-hidden="true"><span class="dv-rail"><i></i><i></i><i></i></span><span class="dv-kontext"><i></i><i></i><i></i></span><span class="dv-flaeche"><i class="dv-titel"></i><i></i><i></i><i class="dv-knopf"></i></span></span>`;
  const karte = (w, name, info, bild) => `<button class="designkarte" type="button" data-p-design="${w}" aria-pressed="${d === w}">${bild}<span class="dk-name">${name}</span><span class="dk-info">${info}</span></button>`;
  const vor = Object.entries(VOREIN).find(([, l]) => JSON.stringify(l) === JSON.stringify(S.hub));
  const railListe = GRUPPEN.map(g => `<p class="p-gruppe-t" id="pg-${g}${kompakt ? 'k' : ''}">${g}</p><ol class="p-liste" aria-labelledby="pg-${g}${kompakt ? 'k' : ''}">${S.pers.reihe.filter(s => bereich(s).g === g).map(s => {
    const b = bereich(s), aus = S.pers.aus.includes(s), fest = s === 'hub', grp = S.pers.reihe.filter(x => bereich(x).g === g), i = grp.indexOf(s);
    return `<li data-id="${s}" class="${S.drag === s ? 'zieht' : ''}${S.tastatur === s ? ' aufgenommen' : ''}"><button class="griff" type="button" data-griff="${s}" aria-describedby="dndHilfeR" aria-label="${b.n} verschieben">${ic('griff')}</button>${ic(b.i, 'i b')}<span class="p-n${aus ? ' aus' : ''}">${b.n}${fest ? '<small>immer sichtbar</small>' : aus ? '<small>über die Suche erreichbar</small>' : ''}</span><button class="symbolknopf" type="button" data-p-schieb="-1" data-fuer="${s}" aria-label="${b.n} nach oben"${i === 0 ? ' disabled' : ''}>${ic('hoch')}</button><button class="symbolknopf" type="button" data-p-schieb="1" data-fuer="${s}" aria-label="${b.n} nach unten"${i === grp.length - 1 ? ' disabled' : ''}>${ic('runter')}</button><button class="schalter" type="button" role="switch" aria-checked="${!aus}" data-p-zeigen="${s}"${fest ? ' disabled' : ''}><span class="vh">${b.n} in der Symbolleiste zeigen</span></button></li>`;
  }).join('')}</ol>`).join('');
  return sek('design', 'Design', 'Zwei ruhige Designs. Mit „Wie das System“ wechselt UniVerse mit deinem Gerät zwischen hell und dunkel.',
    `<div class="designkarten">${karte('nacht', 'Sternenhimmel', 'Dunkel, Akzent Gold', vorschau('nacht'))}${karte('hochschule', 'Hochschule', 'Hell, Akzent Blau', vorschau('hochschule'))}${karte('system', 'Wie das System', 'Hell Hochschule, dunkel Sternenhimmel', `<span class="dv-paar">${vorschau('hochschule', 1)}${vorschau('nacht', 1)}</span>`)}</div>
     ${zeile('Design-Schalter in der Kopfleiste', `<button class="schalter" type="button" role="switch" aria-checked="${OPT.schalter === 'an'}" id="pSchalter"><span class="vh">Design-Schalter in der Kopfleiste zeigen</span></button>`, 'Sonst wechselst du über das Profil oder die Suche.')}`)
    + sek('hub', 'Zentraler Hub', 'Welche Bausteine der Hub zeigt, in welcher Reihenfolge und wie breit.',
      zeile('Voreinstellung', segP('vor', vor && vor[0], [['fokus', 'Ruhig'], ['ausgewogen', 'Ausgewogen'], ['alles', 'Alles']], 'Voreinstellung des Hubs'))
      + zeile('Eigene Anordnung', `<button class="knopf neben klein" type="button" id="pAnordnen">${ic('raster')}Hub anordnen</button>`, 'Verschieben, Breite ändern, ausblenden. Direkt im Hub.'))
    + sek('leiste', 'Symbolleiste', 'Reihenfolge innerhalb der Gruppen und welche Bereiche sichtbar sind. Die ersten vier stehen am Handy in der Tab-Leiste.',
      `<p class="vh" id="dndHilfeR">Leertaste nimmt den Bereich auf. Pfeiltasten verschieben ihn innerhalb der Gruppe, Leertaste legt ihn ab, Escape bricht ab.</p><div id="railListe">${railListe}</div>`)
    + sek('darst', 'Darstellung', 'Gilt nur für dich, auch wenn du später ein geteiltes Design übernimmst.',
      zeile('Schriftgröße', segP('schrift', S.pers.schrift, [['normal', 'Normal'], ['gross', 'Groß']], 'Schriftgröße'))
      + zeile('Dichte', segP('dichte', S.pers.dichte, [['normal', 'Normal'], ['kompakt', 'Kompakt']], 'Dichte'))
      + zeile('Bewegung', segP('bewegung', S.pers.bewegung, [['system', 'Wie das System'], ['ruhig', 'Reduziert']], 'Bewegung'), 'Reduziert heißt: nur Überblenden, nichts gleitet.'))
    + sek('spaeter', 'Mit dem Baukasten', 'Diese Ebenen kommen später dazu. Die Grundlage steht in der Recherche.',
      `<ul class="spaeter">${[['Eigene Farben', 'Grund, Akzent und Kontrast. Lesbarkeit garantiert der Generator.'], ['Hintergrund', 'Muster oder eigenes Bild, auch pro Bereich.'], ['Sticker', 'An festen Plätzen, beim Lernen automatisch ausgeblendet.'], ['Teilen', 'Per Link, im Chat mit „Design übernehmen“.']].map(([t, x]) => `<li><span><b>${t}</b><br><span>${x}</span></span><em>später</em></li>`).join('')}</ul>`);
}
function fokusMerken(root) {
  const a = document.activeElement; if (!a || !root?.contains(a)) return () => {};
  const k = Object.keys(a.dataset).find(x => x !== 'id'), v = k && a.dataset[k], id = a.id;
  return () => { const r = $('#persBox'); const ziel = id ? $(`#${id}`) : k ? $(`[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${v}"]`, r) : null; ziel?.focus(); };
}
function persNeu() {
  const box = $('#persBox'); if (!box) return; const zurueck = fokusMerken(box); box.innerHTML = persHtml(false); persVerdrahten(box); zurueck();
}
const persAktualisieren = () => persNeu();
const RAIL_ZIEH = {
  name: s => bereich(s).n, liste: () => S.pers.reihe,
  setzen: (id, nachId, davor) => { if (bereich(id).g !== bereich(nachId).g) return; const r = S.pers.reihe, i = r.indexOf(id); r.splice(i, 1); let j = r.indexOf(nachId); if (!davor) j++; r.splice(j, 0, id); },
  schritt: (id, d) => { const r = S.pers.reihe, i = r.indexOf(id), j = i + d; if (!r[j] || bereich(r[j]).g !== bereich(id).g) return false; [r[i], r[j]] = [r[j], r[i]]; return true; },
  sichern: () => { persSichern(); railZeichnen(); }, zeichnen: () => flip('#railListe', 'li[data-id]', persNeu),
  container: '#railListe', sel: 'li[data-id]', achse: 'y', merken: () => {}, info: s => bereich(s).n,
  laden: () => JSON.stringify(S.pers.reihe), zurueck: z => { S.pers.reihe = JSON.parse(z); }
};
function persVerdrahten(box) {
  $$('[data-p-design]', box).forEach(b => b.onclick = () => designWahl(b.dataset.pDesign));
  $$('[data-p-vor]', box).forEach(b => b.onclick = () => { S.hub = kopie(VOREIN[b.dataset.pVor]); layoutSichern(); hubNeu(); persNeu(); ansage(`Hub: ${b.textContent}.`); });
  ['schrift', 'dichte', 'bewegung'].forEach(k => $$(`[data-p-${k}]`, box).forEach(b => b.onclick = () => { S.pers[k] = b.dataset['p' + k[0].toUpperCase() + k.slice(1)]; persSichern(); darstellungAnwenden(); persNeu(); }));
  $$('[data-p-zeigen]', box).forEach(b => b.onclick = () => { const s = b.dataset.pZeigen, a = S.pers.aus; a.includes(s) ? a.splice(a.indexOf(s), 1) : a.push(s); persSichern(); railZeichnen(); persNeu(); ansage(`${bereich(s).n} ${a.includes(s) ? 'ausgeblendet' : 'wieder sichtbar'}.`); });
  $$('[data-p-schieb]', box).forEach(b => b.onclick = () => { if (RAIL_ZIEH.schritt(b.dataset.fuer, +b.dataset.pSchieb)) { persSichern(); railZeichnen(); RAIL_ZIEH.zeichnen(); } });
  $$('[data-griff]', box).forEach(g => { g.onpointerdown = e => ziehStart(e, RAIL_ZIEH, g.dataset.griff); g.onkeydown = e => tasteZiehen(e, RAIL_ZIEH, g.dataset.griff); });
  $('#pSchalter', box) && ($('#pSchalter', box).onclick = () => { OPT.schalter = OPT.schalter === 'an' ? 'aus' : 'an'; optSichern(); persNeu(); steuerungAktualisieren(); });
  $('#pAnordnen', box) && ($('#pAnordnen', box).onclick = hubAnordnen);
}
function hubAnordnen() { if (route().b === 'hub') anpassenStart(); else { S.nachHub = true; location.hash = '#/hub'; } }
function persOeffnen() { location.hash = '#/einstellungen/personalisierung'; }
const EINST = { profil: ['Profil', 'person'], konto: ['Konto', 'zahnrad'], personalisierung: ['Personalisierung', 'raster'], datenschutz: ['Datenschutz und KI', 'achtung'], gedaechtnis: ['Studio und Gedächtnis', 'funke'] };
VIEWS.einstellungen = r => {
  const sub = EINST[r.a] ? r.a : 'personalisierung', [titel] = EINST[sub];
  return {
    pfad: `${ic('zahnrad')}<span>Einstellungen</span><span class="sub">/</span><span class="sub">${titel}</span>`,
    k: liK('Einstellungen', Object.entries(EINST).map(([k, [n, i]]) => kE({ href: `#/einstellungen/${k}`, icon: i, n, cur: k === sub }))),
    v: sub === 'personalisierung'
      ? seitenkopf('Personalisierung', 'So sieht UniVerse für dich aus. Jede Änderung gilt sofort.') + `<div id="persBox" class="pers">${persHtml(false)}</div>`
      : seitenkopf(titel, '') + `<div class="pers">${EINST_SEITE[sub]()}</div>`,
    nach: () => {
      $('#persBox') && persVerdrahten($('#persBox'));
      $$('[data-art]').forEach(b => b.onclick = () => { S.studioArt = b.dataset.art; zeige(); $(`[data-art="${b.dataset.art}"]`)?.focus(); });
      $$('[data-vergiss]').forEach(b => b.onclick = () => { S.gedaechtnis.splice(+b.dataset.vergiss, 1); zeige(); ansage('Vergessen.'); });
      $('#alleVergessen') && ($('#alleVergessen').onclick = () => { S.gedaechtnis = []; zeige(); ansage('Studio hat alles vergessen.'); });
      $('#dsKi') && ($('#dsKi').onclick = () => { S.kiAn = !S.kiAn; zeige(); $('#dsKi').focus(); });
      $('#dsAn') && ($('#dsAn').onclick = () => { S.analyticsAn = !S.analyticsAn; zeige(); $('#dsAn').focus(); });
      $('#kAbmelden') && ($('#kAbmelden').onclick = abgemeldet);
    }
  };
};

/* ---------- Zentraler Hub: Unterseiten wie Max' Notch (Übersicht, Termine, Aufgaben, Noten, Fortschritt, Fächer) ---------- */
const HUBSEITEN = {
  termine: ['Termine', 'kalender', 'Heute, Stundenplan und Kalender.'],
  aufgaben: ['Aufgaben', 'haken', 'Deadlines, To-dos und Prüfungen.'],
  noten: ['Noten', 'tabelle', 'Notenschnitt, Prognose und Rechner.'],
  fortschritt: ['Fortschritt', 'fokus', 'Lernzeit, Anwesenheit und Streak.'],
  faecher: ['Fächer', 'ordner', 'Deine Fächer in diesem Semester.']
};
S.fachFilter = 'alle';
const hubNav = cur => liK('Zentraler Hub', [kE({ href: '#/hub', icon: 'hub', n: 'Übersicht', cur: !cur }), ...Object.entries(HUBSEITEN).map(([k, [n, i]]) => kE({ href: `#/hub/${k}`, icon: i, n, cur: cur === k }))]);
const fachFilter = () => `<div class="chips filter" role="group" aria-label="Nach Fach filtern"><button class="chip" type="button" data-ff="alle" aria-pressed="${S.fachFilter === 'alle'}">Alle Fächer</button>${Object.keys(F).map(k => `<button class="chip" type="button" data-ff="${k}" aria-pressed="${S.fachFilter === k}" style="--c:var(--${F[k][1]})"><i></i>${F[k][2]}</button>`).join('')}</div>`;
const passt = f => S.fachFilter === 'alle' || S.fachFilter === f;
const AUFG = [['Statistik-Übung abgeben', 'ml', 'Abgabe', 'morgen, 23:59', 0], ['Vorlesung 4 nacharbeiten', 'kp', 'To-do', 'heute', 0], ['Literatur fürs Referat suchen', 'vt', 'To-do', 'diese Woche', 0], ['Karteikarten Klinische', 'kp', 'To-do', 'heute', 1], ['Referat VT', 'vt', 'Abgabe', '9. Dezember', 0], ['Klausur Klinische Psychologie', 'kp', 'Prüfung', '3. Februar', 0], ['Klausur Diagnostik', 'di', 'Prüfung', '10. Februar', 0]];
const NOTEN = [['ml', 'Statistik I, Klausur', 1.7, 6], ['di', 'Testtheorie, Hausarbeit', 1.3, 5], ['kp', 'Psychopathologie, Klausur', 2.0, 6], ['vt', 'Gesprächsführung, Referat', 1.7, 4]];
S.rechner = { note: '1,3', ects: '6' };
const schnitt = liste => { const e = liste.reduce((a, x) => a + x[1], 0); return liste.reduce((a, x) => a + x[0] * x[1], 0) / e; };
const komma = (n, d = 1) => n.toFixed(d).replace('.', ',');
const HUBSEITE = {
  termine: () => fachFilter() + `<div class="hubraster">${['heute', 'woche'].map((id, i) => `<div class="block" data-id="${id}" style="--span:3" data-spalte="0" data-zeile="${i}">${hubBlock(id).replace(/<button class="knopf leise klein rechts" type="button" id="wocheAus">Ausblenden<\/button>/, '')}</div>`).join('')}</div><p class="hinweis pad">Mit Google Kalender verbunden, zuletzt abgeglichen um <span class="zahl" data-uhr>22:40</span>.</p>`,
  aufgaben: () => fachFilter() + `<div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Aufgabe</th><th scope="col" class="weg">Fach</th><th scope="col">Art</th><th scope="col" class="datum">Fällig</th></tr></thead><tbody>${AUFG.map((a, i) => passt(a[1]) ? `<tr class="${a[4] ? 'erledigt' : ''}"><td><span class="name">${a[2] === 'To-do' ? `<button class="haken" type="button" aria-pressed="${!!a[4]}" data-todo="${i}" aria-label="${esc(a[0])} erledigt">${ic('haken')}</button>` : `<span class="ico">${ic(a[2] === 'Prüfung' ? 'karten' : 'datei')}</span>`}<span>${esc(a[0])}</span></span></td><td class="weg">${fach(a[1])}</td><td>${a[2]}</td><td class="datum">${a[3]}</td></tr>` : '').join('') || '<tr><td colspan="4" class="leerzeile">In diesem Fach steht gerade nichts an.</td></tr>'}</tbody></table></div>`,
  noten: () => {
    const l = NOTEN.filter(n => passt(n[0])), s = l.length ? schnitt(l.map(n => [n[2], n[3]])) : null;
    const rn = parseFloat(S.rechner.note.replace(',', '.')), re = parseInt(S.rechner.ects, 10), gueltig = rn >= 1 && rn <= 5 && re > 0 && re <= 30;
    const neu = gueltig ? schnitt(NOTEN.map(n => [n[2], n[3]]).concat([[rn, re]])) : null;
    return fachFilter() + `<div class="noten"><div class="noten-kopf"><div class="zahl gross-zahl">${s ? komma(s) : '–'}</div><p>${S.fachFilter === 'alle' ? 'Notenschnitt aus 21 ECTS.' : `Schnitt in ${F[S.fachFilter][0]}.`} Gewichtet nach ECTS.</p></div>
      <div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Leistung</th><th scope="col" class="weg">Fach</th><th scope="col" class="num">ECTS</th><th scope="col" class="num">Note</th></tr></thead><tbody>${l.map(([f, t, n, e]) => `<tr><td>${esc(t)}</td><td class="weg">${fach(f)}</td><td class="num">${e}</td><td class="num">${komma(n)}</td></tr>`).join('')}</tbody></table></div>
      <section class="rechner" aria-labelledby="rch"><h2 id="rch">Rechner</h2><p class="hinweis0">Was passiert mit dem Schnitt, wenn die nächste Prüfung so ausgeht?</p><form id="rechner" class="rechner-feld"><label>Note<input name="note" inputmode="decimal" value="${esc(S.rechner.note)}" aria-describedby="rchErg"></label><label>ECTS<input name="ects" inputmode="numeric" value="${esc(S.rechner.ects)}" aria-describedby="rchErg"></label></form><p id="rchErg" class="rechner-erg" aria-live="polite">${gueltig ? `Neuer Schnitt <b class="zahl">${komma(neu, 2)}</b>` : 'Note zwischen 1,0 und 5,0 und ECTS bis 30 eingeben.'}</p></section></div>`;
  },
  fortschritt: () => `<div class="fortschritt-seite"><section aria-labelledby="fl"><div class="kopfzeile"><h2 id="fl">Lernzeit diese Woche</h2><span class="info">5 h 12 min, 12 Tage in Folge</span></div><div class="wochenbalken" aria-label="Lernminuten pro Tag">${[['Mo', 48], ['Di', 72], ['Mi', 95], ['Do', 40], ['Fr', 0], ['Sa', 0], ['So', 57]].map(([t, m], i) => `<div class="${i === 0 ? 'heute' : ''}"><i style="height:${Math.max(2, m)}%"></i>${t}</div>`).join('')}</div></section>
    <section aria-labelledby="fa"><div class="kopfzeile"><h2 id="fa">Anwesenheit</h2><span class="info">aus dem Stundenplan</span></div><ul class="faecher">${Object.entries(F).map(([k, [n, c]], i) => { const w = [92, 75, 100, 83][i]; return `<li style="--c:var(--${c})"><span class="f"></span><span><strong>${n}</strong><span class="balkenf"><i style="width:${w}%"></i></span></span><span class="wert">${w} %</span></li>`; }).join('')}</ul></section>
    <section aria-labelledby="fb"><div class="kopfzeile"><h2 id="fb">Bachelorarbeit</h2><span class="info">ab 120 ECTS</span></div><div class="gesperrt"><p>Der Tracker für die Bachelorarbeit öffnet sich ab 120 ECTS. Du hast 84.</p><span class="balkenk" style="--c:var(--text-3)"><i style="width:70%"></i></span></div></section></div>`,
  faecher: () => `<div class="tab-rahmen"><table class="tabelle"><thead><tr><th scope="col">Fach</th><th scope="col" class="num weg">ECTS</th><th scope="col" class="num">Lernstand</th><th scope="col" class="num weg">Termine pro Woche</th></tr></thead><tbody>${Object.entries(F).map(([k, [n, c]], i) => `<tr><td>${fach(k).replace(F[k][2], n)}</td><td class="num weg">${[6, 6, 5, 4][i]}</td><td class="num">${[72, 48, 61, 35][i]} %</td><td class="num weg">${[2, 2, 1, 2][i]}</td></tr>`).join('')}</tbody></table></div><div class="abschnitt-fuss"><button class="knopf haupt klein" type="button" data-fuellen-nicht>${ic('plus')}Fach hinzufügen</button><span class="info">Farbe, ECTS und Termine kommen aus dem Stundenplan.</span></div>`
};
const hubUebersicht = VIEWS.hub;
VIEWS.hub = r => {
  if (!HUBSEITEN[r.a]) { const o = hubUebersicht(r); o.k = hubNav() + o.k; return o; }
  const [n, , unter] = HUBSEITEN[r.a];
  return {
    pfad: `${ic('hub')}<span>Zentraler Hub</span><span class="sub">/</span><span class="sub">${n}</span>`,
    k: hubNav(r.a) + semesterK(),
    v: seitenkopf(n, unter, r.a === 'aufgaben' ? `<button class="knopf haupt" type="button" id="aufgabeNeu">${ic('plus')}Aufgabe</button>` : '') + `<div class="hubseite">${HUBSEITE[r.a]()}</div>`,
    nach: () => {
      $$('[data-ff]').forEach(b => b.onclick = () => { S.fachFilter = b.dataset.ff; zeige(); $(`[data-ff="${b.dataset.ff}"]`)?.focus(); });
      $$('[data-todo]').forEach(b => b.onclick = () => { const a = AUFG[+b.dataset.todo]; a[4] = a[4] ? 0 : 1; zeige(); $(`[data-todo="${b.dataset.todo}"]`)?.focus(); });
      $('#aufgabeNeu') && ($('#aufgabeNeu').onclick = () => schnellAuf());
      $('#rechner') && ($('#rechner').oninput = e => { S.rechner[e.target.name] = e.target.value; const p = e.target.selectionStart; zeige(); const f = $(`#rechner [name="${e.target.name}"]`); f.focus(); f.setSelectionRange(p, p); });
      $('#rechner') && ($('#rechner').onsubmit = e => e.preventDefault());
    }
  };
};

/* ---------- Geteilte Ansicht: zwei Bereiche nebeneinander oder übereinander (wie im Repo) ----------
   Ziehen aus der Symbolleiste an einen Rand, oder ohne Ziehen über ⌘K „Daneben öffnen“ (WCAG 2.5.7). */
const EINGEBETTET = PARAM.has('eingebettet');
if (EINGEBETTET) document.documentElement.dataset.eingebettet = '';
S.split = null;
function teilen(s, quer = true) {
  if (EINGEBETTET || matchMedia('(max-width:60rem)').matches) { location.hash = `#/${s}`; return; }
  S.split = { s, quer, teil: S.split?.teil || 50 }; teilenZeichnen(); ansage(`${bereich(s).n} ${quer ? 'daneben' : 'darunter'} geöffnet.`);
}
function teilenZeichnen() {
  const a = $('#arbeit'); $('#zweite')?.remove(); $('#trenner')?.remove();
  a.classList.toggle('geteilt', !!S.split); a.classList.toggle('uebereinander', !!S.split && !S.split.quer);
  if (!S.split) { a.style.gridTemplateColumns = a.style.gridTemplateRows = ''; return; }
  const { s, quer, teil } = S.split, b = bereich(s);
  a.style[quer ? 'gridTemplateColumns' : 'gridTemplateRows'] = `minmax(0,${teil}fr) 8px minmax(0,${100 - teil}fr)`;
  a.style[quer ? 'gridTemplateRows' : 'gridTemplateColumns'] = '';
  a.insertAdjacentHTML('beforeend', `<div class="trenner" id="trenner" role="separator" tabindex="0" aria-orientation="${quer ? 'vertical' : 'horizontal'}" aria-valuemin="25" aria-valuemax="75" aria-valuenow="${teil}" aria-label="Größe der beiden Ansichten ändern"></div>
    <section class="zweite" id="zweite" aria-label="Zweite Ansicht: ${b.n}"><div class="zw-kopf">${ic(b.i)}<label class="vh" for="zwWahl">Bereich der zweiten Ansicht</label><select id="zwWahl" class="zw-wahl">${ALLE.map(x => `<option value="${x.s}"${x.s === s ? ' selected' : ''}>${x.n}</option>`).join('')}</select>
      <span class="zw-knoepfe"><button class="symbolknopf" type="button" id="zwDreh" aria-label="${quer ? 'Übereinander anzeigen' : 'Nebeneinander anzeigen'}">${ic('raster')}</button><button class="symbolknopf" type="button" id="zwHaupt" aria-label="Als Hauptansicht öffnen">${ic('gross')}</button><button class="symbolknopf" type="button" id="zwZu" aria-label="Zweite Ansicht schließen">${ic('x')}</button></span></div>
      <iframe class="zw-frame" src="index.html?eingebettet=1&last=schnell#/${s}" title="${b.n}"></iframe></section>`);
  $('#zwWahl').onchange = e => { S.split.s = e.target.value; teilenZeichnen(); $('#zwWahl').focus(); };
  $('#zwDreh').onclick = () => { S.split.quer = !S.split.quer; teilenZeichnen(); $('#zwDreh').focus(); };
  $('#zwHaupt').onclick = () => { const z = S.split.s; S.split = null; teilenZeichnen(); location.hash = `#/${z}`; };
  $('#zwZu').onclick = () => { S.split = null; teilenZeichnen(); ansage('Zweite Ansicht geschlossen.'); };
  const t = $('#trenner'), setz = w => { S.split.teil = Math.round(Math.min(75, Math.max(25, w))); a.style[S.split.quer ? 'gridTemplateColumns' : 'gridTemplateRows'] = `minmax(0,${S.split.teil}fr) 8px minmax(0,${100 - S.split.teil}fr)`; t.setAttribute('aria-valuenow', S.split.teil); };
  t.ondblclick = () => setz(50);
  t.onkeydown = e => { const d = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[e.key]; if (d) { e.preventDefault(); setz(S.split.teil + d); } if (e.key === 'Home') setz(25); if (e.key === 'End') setz(75); };
  t.onpointerdown = e => { e.preventDefault(); t.setPointerCapture(e.pointerId); a.classList.add('zieht-trenner'); const r = a.getBoundingClientRect(); t.onpointermove = ev => setz(S.split.quer ? (ev.clientX - r.left) / r.width * 100 : (ev.clientY - r.top) / r.height * 100); t.onpointerup = () => { t.onpointermove = null; a.classList.remove('zieht-trenner'); }; };
  try { const f = $('.zw-frame'); f.onload = () => { try { const d = f.contentDocument.documentElement, h = document.documentElement; ['theme', 'schrift', 'dichte'].forEach(k => { d.dataset[k] = h.dataset[k]; }); } catch (_) {} }; } catch (_) {}
}
/* Ziehen aus der Symbolleiste: Ablagezonen am rechten und unteren Rand */
document.addEventListener('dragstart', e => {
  const r = e.target.closest?.('.rpunkt[data-b]'); if (!r || !bereich(r.dataset.b) || EINGEBETTET) return;
  e.dataTransfer.setData('text/uv-bereich', r.dataset.b); e.dataTransfer.effectAllowed = 'copy';
  const a = $('#arbeit'); a.insertAdjacentHTML('beforeend', `<div class="zonen" id="zonen" aria-hidden="true"><div class="zone rechts" data-zone="rechts">Daneben öffnen</div><div class="zone unten" data-zone="unten">Darunter öffnen</div></div>`);
  $$('#zonen .zone').forEach(z => { z.ondragover = ev => { ev.preventDefault(); z.classList.add('an'); }; z.ondragleave = () => z.classList.remove('an'); z.ondrop = ev => { ev.preventDefault(); const s = ev.dataTransfer.getData('text/uv-bereich'); $('#zonen')?.remove(); if (s) teilen(s, z.dataset.zone === 'rechts'); }; });
});
document.addEventListener('dragend', () => $('#zonen')?.remove());

/* ---------- Benachrichtigungen ---------- */
S.meldungen = [{ art: 'einladung', t: 'Lea lädt dich in die Gruppe „Statistik-Übung“ ein.', z: 'vor 12 Minuten', neu: 1 }, { art: 'frist', t: 'Statistik-Übung ist morgen um 23:59 fällig.', z: 'heute, 08:00', neu: 1, href: '#/hub/aufgaben' }, { art: 'board', t: 'Jonas hat das Board „Lerngruppe VT“ geändert.', z: 'gestern', neu: 0, href: '#/whiteboard' }];
function glockeZeichnen() {
  const n = S.meldungen.filter(m => m.neu).length;
  $$('.glocke').forEach(g => { g.setAttribute('aria-label', n ? `Benachrichtigungen, ${n} neu` : 'Benachrichtigungen'); g.querySelector('.badge')?.toggleAttribute('hidden', !n); });
}
function glockeAuf(knopf) {
  if ($('#meldungen')) { $('#meldungen').remove(); knopf.setAttribute('aria-expanded', 'false'); return; }
  document.body.insertAdjacentHTML('beforeend', `<div class="menue meldungen" id="meldungen" role="dialog" aria-label="Benachrichtigungen"><p class="menue-kopf"><span>Benachrichtigungen</span></p><ul>${S.meldungen.map((m, i) => `<li class="${m.neu ? 'neu' : ''}"><p>${esc(m.t)}</p><span class="info">${m.z}</span>${m.art === 'einladung' && !m.erledigt ? `<span class="aktionen"><button class="knopf neben klein" type="button" data-ml="${i}" data-a="ja">Annehmen</button><button class="knopf leise klein" type="button" data-ml="${i}" data-a="nein">Ablehnen</button></span>` : m.erledigt ? `<span class="info">${m.erledigt}</span>` : m.href ? `<a class="link" href="${m.href}">Öffnen</a>` : ''}</li>`).join('')}</ul></div>`);
  const p = $('#meldungen'), r = knopf.getBoundingClientRect(); p.style.top = `${r.bottom + 8}px`; p.style.left = 'auto'; p.style.right = `${Math.max(12, innerWidth - r.right)}px`; p.style.bottom = 'auto';
  knopf.setAttribute('aria-expanded', 'true'); S.meldungen.forEach(m => { if (m.art !== 'einladung') m.neu = 0; }); glockeZeichnen();
  $$('[data-ml]', p).forEach(b => b.onclick = () => { const m = S.meldungen[+b.dataset.ml]; m.erledigt = b.dataset.a === 'ja' ? 'Angenommen' : 'Abgelehnt'; m.neu = 0; p.remove(); glockeAuf(knopf); glockeZeichnen(); });
  p.onkeydown = e => { if (e.key === 'Escape') { p.remove(); knopf.setAttribute('aria-expanded', 'false'); knopf.focus(); } };
  setTimeout(() => addEventListener('click', function weg(e) { if (!p.contains(e.target) && !knopf.contains(e.target)) { p.remove(); knopf.setAttribute('aria-expanded', 'false'); removeEventListener('click', weg); } }), 0);
  p.querySelector('button, a')?.focus();
}
$$('.glocke').forEach(g => g.onclick = e => { e.stopPropagation(); glockeAuf(g); });
$('#studioMobil') && ($('#studioMobil').onclick = () => studioUmschalten());
glockeZeichnen();

/* ---------- Automatisch abmelden: Hinweis 30 Sekunden vorher (wie im Repo nach 5 Minuten ohne Eingabe) ---------- */
let abmeldeUhr = null;
function abmeldeHinweis() {
  $('#abmelden')?.remove(); clearInterval(abmeldeUhr); let rest = 30;
  document.body.insertAdjacentHTML('beforeend', `<div class="abmelde-hinweis" id="abmelden" role="alertdialog" aria-labelledby="abmH" aria-describedby="abmT"><div><strong id="abmH">Gleich wirst du abgemeldet.</strong><p id="abmT">Seit fast fünf Minuten keine Eingabe. In <span class="zahl" id="abmRest">30</span> Sekunden meldet UniVerse dich ab. Alles ist gespeichert.</p></div><button class="knopf haupt" type="button" id="abmBleiben">Angemeldet bleiben</button></div>`);
  $('#abmBleiben').focus();
  $('#abmBleiben').onclick = () => { clearInterval(abmeldeUhr); $('#abmelden').remove(); ansage('Du bleibst angemeldet.'); };
  abmeldeUhr = setInterval(() => { rest--; const z = $('#abmRest'); if (z) z.textContent = rest; if (rest <= 0) { clearInterval(abmeldeUhr); $('#abmelden')?.remove(); abgemeldet(); } }, ruhig() ? 1000 : 1000);
}
function abgemeldet() {
  document.body.insertAdjacentHTML('beforeend', `<div class="abgemeldet" id="abgemeldet" role="dialog" aria-modal="true" aria-labelledby="abgH"><div class="abg-karte">${MARKE}<h1 id="abgH">Du wurdest abgemeldet.</h1><p>Nach fünf Minuten ohne Eingabe meldet UniVerse dich zum Schutz deiner Daten ab. Ein laufender Timer, eine Aufnahme oder Wiedergabe hält dich angemeldet.</p><button class="knopf haupt" type="button" id="abgWieder">Wieder anmelden</button></div></div>`);
  $('#abgWieder').focus(); $('#abgWieder').onclick = () => $('#abgemeldet').remove();
}

/* ---------- Einstellungen: Profil, Konto, Datenschutz und KI, Gedächtnis von Studio ---------- */
S.gedaechtnis = ['Studiert Klinische Psychologie und Psychotherapie im Master.', 'Lernt abends am besten, morgens lieber Karteikarten.', 'Mag Erklärungen mit einem Beispiel aus der Praxis.', 'Schreibt im Dezember ein Referat zu kognitiven Techniken.'];
S.studioArt = 'coach'; S.kiAn = true; S.analyticsAn = true;
const ART = { kumpel: ['Lernbuddy', 'Locker, herzlich, mit einer Prise Humor, wie jemand aus dem Semester, der den Stoff draufhat.'], coach: ['Coach', 'Motivierend und strukturiert. Hält dich auf Kurs und gibt dir klare nächste Schritte.'], sachlich: ['Sachlich', 'Knapp und genau. Erst die Antwort, dann die Belege.'] };
const eZeile = (label, ctrl, info = '') => `<div class="p-zeile"><div><span class="p-label">${label}</span>${info ? `<span class="p-info">${info}</span>` : ''}</div>${ctrl}</div>`;
const eSek = (id, titel, text, inhalt) => `<section class="p-sek" aria-labelledby="es-${id}"><div class="p-kopf"><h2 id="es-${id}">${titel}</h2>${text ? `<p>${text}</p>` : ''}</div><div class="p-inhalt">${inhalt}</div></section>`;
const EINST_SEITE = {
  profil: () => eSek('pr', 'Profil', 'So sehen dich andere, zum Beispiel beim Teilen von Fristen und im Chat.', eZeile('Profilbild', `<span class="p-avatar"><span class="avatar gross-av" aria-hidden="true">DR</span><button class="knopf leise klein" type="button">Bild ändern</button></span>`) + eZeile('<label for="pName">Anzeigename</label>', '<input class="feld" id="pName" value="Didi Romrod" autocomplete="name">') + eZeile('<label for="pUser">Benutzername</label>', '<input class="feld" id="pUser" value="didi" autocomplete="username">', 'Andere finden dich darüber für Gruppen und geteilte Fristen.')),
  konto: () => eSek('ko', 'Konto', 'E-Mail-Adresse und Passwort für die Anmeldung.', eZeile('<label for="kMail">E-Mail</label>', '<input class="feld" id="kMail" type="email" value="didi@beispiel.de" autocomplete="email">') + eZeile('Passwort', '<button class="knopf leise klein" type="button">Passwort ändern</button>', 'Zuletzt geändert am 2. Oktober.') + eZeile('Abmelden', '<button class="knopf leise klein" type="button" id="kAbmelden">Abmelden</button>', 'Nach fünf Minuten ohne Eingabe meldet UniVerse dich automatisch ab.'))
    + eSek('lo', 'Konto löschen', 'Löscht alle Fächer, Notizen, Dateien und Karten. Das lässt sich nicht rückgängig machen.', eZeile('Endgültig löschen', '<button class="knopf leise klein gefahr" type="button">Konto löschen</button>')),
  datenschutz: () => eSek('ds', 'Datenschutz und KI', 'Was UniVerse nutzen darf. Du kannst alles jederzeit ändern.', eZeile('KI-Funktionen', `<button class="schalter" type="button" role="switch" aria-checked="${S.kiAn}" id="dsKi"><span class="vh">KI-Funktionen erlauben</span></button>`, 'Studio, Quiz, Podcast, Diktat und Vorlesen. Deine Inhalte werden dafür an den KI-Anbieter übertragen.') + eZeile('Nutzungsstatistik', `<button class="schalter" type="button" role="switch" aria-checked="${S.analyticsAn}" id="dsAn"><span class="vh">Nutzungsstatistik erlauben</span></button>`, 'Hilft uns zu sehen, welche Bereiche genutzt werden. Ohne Inhalte.') + eZeile('KI-Kontingent', '<span class="p-wert"><span class="zahl">12</span> von <span class="zahl">50</span> Anfragen heute</span>') + eZeile('KI-Verlauf', '<button class="knopf leise klein" type="button" id="dsVerlauf">Verlauf löschen</button>', 'Löscht alle Gespräche mit Studio. Das Gedächtnis bleibt.')),
  gedaechtnis: () => eSek('ar', 'Wie Studio mit dir spricht', 'Gilt für Studio, den Lernraum und Erklärungen bei den Karteikarten.', `<div class="designkarten">${Object.entries(ART).map(([k, [n, b]]) => `<button class="designkarte" type="button" data-art="${k}" aria-pressed="${S.studioArt === k}"><span class="dk-name">${n}</span><span class="dk-info">${b}</span></button>`).join('')}</div>`)
    + eSek('gd', 'Was Studio über dich weiß', 'Studio merkt sich nur, was beim Lernen hilft. Ein privater Chat bleibt außen vor.', S.gedaechtnis.length ? `<ul class="gedaechtnis">${S.gedaechtnis.map((g, i) => `<li><span>${esc(g)}</span><button class="knopf leise klein" type="button" data-vergiss="${i}">Vergessen</button></li>`).join('')}</ul><div><button class="knopf leise klein" type="button" id="alleVergessen">Alles vergessen</button></div>` : '<p class="hinweis0">Studio weiß noch nichts über dich. Das entsteht beim Lernen und im Gespräch.</p>')
};

/* ---------- Synchron, Abgleich, Offline ---------- */
function syncZeichnen(z) {
  const el = $('#sync'); if (!el) return;
  el.dataset.z = z;
  el.innerHTML = z === 'offline' ? `${ic('offline')}<span>Offline<span class="lang">, Änderungen bleiben auf diesem Gerät</span></span>`
    : z === 'abgleich' ? '<span class="umlauf mini" aria-hidden="true"><i></i></span><span>Wird abgeglichen</span>'
    : `${ic('haken')}<span>Synchron</span>`;
}
function offlineSetzen(an) {
  if (S.offline === an) return;
  S.offline = an;
  if (an) syncZeichnen('offline');
  else { syncZeichnen('abgleich'); setTimeout(() => { if (!S.offline) syncZeichnen('ok'); }, 1200); }
  if (OFFLINE[route().b]) zeige();
  steuerungAktualisieren();
}
addEventListener('offline', () => offlineSetzen(true));
addEventListener('online', () => offlineSetzen(false));
syncZeichnen('ok');

/* ---------- Dummy-Steuerung: Varianten vergleichen ---------- */
const steuerung = document.createElement('details');
steuerung.className = 'steuerung'; steuerung.id = 'steuerung';
const seg = (name, werte, label) => `<div class="segment" role="group" aria-label="${label}">${werte.map(([w, n]) => `<button type="button" data-${name}="${w}">${n}</button>`).join('')}</div>`;
steuerung.innerHTML = `<summary>${ic('raster')}<span>Testwerkzeuge</span></summary><div class="st-innen">
  <div class="st-gruppe"><p class="st-t">Ladezeit beim ersten Öffnen</p>${seg('last', [['schnell', '80 ms'], ['normal', '450 ms'], ['langsam', '1,5 s']], 'Ladezeit')}<button class="knopf leise klein st-neu" type="button" id="stCache">${ic('zurueck')}Alle Bereiche neu laden lassen</button></div>
  <div class="st-gruppe"><p class="st-t" id="stZt">Zustand dieses Bereichs</p>${seg('zust', [['voll', 'Voll'], ['leer', 'Leer'], ['fehler', 'Fehler']], 'Zustand')}<p class="st-info">Laden ist der erste Besuch, siehe Ladezeit.</p></div>
  <div class="st-gruppe"><p class="st-t">Automatisch abmelden</p><button class="knopf leise klein" type="button" id="stAbm">${ic('person')}Hinweis 30 Sekunden vorher zeigen</button></div>
  <div class="st-gruppe st-zeile"><span id="stOffT">Offline</span><button class="schalter" type="button" role="switch" aria-labelledby="stOffT" id="stOff"></button></div>
</div>`;
document.body.append(steuerung);
function steuerungAktualisieren() {
  const b = bereich(route().b);
  $$('[data-last]', steuerung).forEach(x => x.setAttribute('aria-pressed', x.dataset.last === OPT.last));
  $$('[data-zust]', steuerung).forEach(x => x.setAttribute('aria-pressed', x.dataset.zust === (S.zust[b.s] || 'voll')));
  $('#stZt').textContent = `Zustand von ${b.n}`;
  $('#stOff').setAttribute('aria-checked', S.offline);
}
$$('[data-last]', steuerung).forEach(x => x.onclick = () => { OPT.last = x.dataset.last; optSichern(); steuerungAktualisieren(); });
$$('[data-zust]', steuerung).forEach(x => x.onclick = () => { const s = route().b; if (x.dataset.zust === 'voll') delete S.zust[s]; else S.zust[s] = x.dataset.zust; uebergang(() => einsetzen(route(), bereich(s), false)); });
$('#stCache').onclick = () => { S.geladen.clear(); S.geladen.add(route().b); $('#stCache').innerHTML = `${ic('haken')}Beim nächsten Öffnen wird geladen`; setTimeout(() => { $('#stCache').innerHTML = `${ic('zurueck')}Alle Bereiche neu laden lassen`; }, 1800); };
$('#stOff').onclick = () => offlineSetzen(!S.offline);
$('#stAbm').onclick = () => { steuerung.open = false; abmeldeHinweis(); };

railZeichnen();
zeige(true);
if (location.search.includes('suche')) auf();
})();
