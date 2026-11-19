import type { Metadata } from "next";
import { LandingMotion } from "./landing-motion";
import "./landing.css";

export const metadata: Metadata = {
  title: "UniVerse – Dein Uni-Alltag an einem Ort",
  description: "Organisiere deinen Uni-Alltag und erledige deine Aufgaben an einem Ort.",
};

function UniVerseLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M3.5 14.5c2.5 3.5 14.5-1.5 17-6" />
    </svg>
  );
}

function UniVerseOrbit() {
  return (
    <svg className="uni-login-orbit" viewBox="0 0 560 420" fill="none" strokeLinecap="round" aria-hidden="true">
      <ellipse cx="280" cy="210" rx="262" ry="92" transform="rotate(-16 280 210)" />
      <circle className="uni-login-planet" cx="280" cy="210" r="104" />
      <path className="uni-login-planet" d="M30 268c70 98 430 -40 500 -116" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div id="uni-landing" lang="de" data-theme="system">
      <header className="uni-site-header">
        <nav className="uni-nav uni-wrap" aria-label="Hauptnavigation">
          <a className="uni-brand" href="#uni-start"><span className="uni-mark"><UniVerseLogo /></span><span><b>Uni</b>Verse</span></a>
          <div className="uni-nav-links">
            <a href="#uni-product">Übersicht</a>
            <a href="#uni-studio">Studio</a>
            <a href="#uni-datenbank">Datenbank</a>
            <a href="#uni-werkzeuge">Werkzeuge</a>
            <a href="#uni-about">Über uns</a>
            <a href="#uni-faq">FAQ</a>
          </div>
          <a className="uni-button uni-button-secondary" href="/dashboard">Zur App</a>
        </nav>
      </header>
      <div className="uni-hero" id="uni-start" data-uni-panel tabIndex={-1}>
        <div className="uni-login-backdrop" aria-hidden="true"><UniVerseOrbit /></div>
        <div className="uni-wrap">
          <div className="uni-intro">
            <h1><span className="uni-name-accent">Uni</span>Verse</h1>
            <p>Organisiere deinen Uni-Alltag und erledige deine Aufgaben an einem Ort.</p>
            <div className="uni-actions">
              <a className="uni-button uni-button-primary" href="/dashboard">Zur App</a>
            </div>
          </div>
        </div>
      </div>

      <main>
        <section className="uni-page-section uni-showcase" id="uni-product" data-uni-panel tabIndex={-1} aria-labelledby="uni-hub-title">
          <div className="uni-wrap" data-uni-reveal>
            <h2 id="uni-hub-title" data-uni-stage="heading">Ein Semester mit UniVerse</h2>
            <figure className="uni-reel uni-shot-overview">
              <video className="uni-video" data-uni-stage="media" width="896" height="456" muted playsInline loop preload="none" poster="/universe-landing/hub.webp" src="/universe-landing/hub.mp4" aria-label="Zentraler Hub wechselt von einer Abgabefrist zu Terminen und Aufgaben" />
              <figcaption data-uni-stage="last">Im Zentralen Hub siehst du, was heute ansteht und wie weit du im Semester bist. Erinnerungen helfen dir, die nächste Frist im Blick zu behalten.</figcaption>
            </figure>
          </div>
        </section>
        <section className="uni-page-section" id="uni-studio" data-uni-panel tabIndex={-1} aria-labelledby="uni-studio-title">
            <div className="uni-wrap uni-feature" data-uni-reveal>
              <div className="uni-feature-copy"><h2 id="uni-studio-title" data-uni-stage="heading">Vom Lesen zum Lernen</h2><p data-uni-stage="copy">Wenn du im Skript hängenbleibst, frag UniVerse Studio direkt beim Lesen. Für dein nächstes Lernziel kann es dir passende Schritte für den Tag vorschlagen.</p></div>
              <figure className="uni-reel uni-reel-studio" data-uni-stage="media">
                <video className="uni-video" width="596" height="490" muted playsInline loop preload="none" poster="/universe-landing/studio.webp" src="/universe-landing/studio.mp4" aria-label="UniVerse Studio beantwortet eine Frage zur Tagesplanung und schlägt drei Lernblöcke vor" />
              </figure>
            </div>
        </section>
        <section className="uni-page-section" id="uni-datenbank" data-uni-panel tabIndex={-1} aria-labelledby="uni-datenbank-title">
            <div className="uni-wrap uni-feature uni-feature-reverse" data-uni-reveal>
              <div className="uni-feature-copy"><h2 id="uni-datenbank-title" data-uni-stage="heading">Ein Stand fürs ganze Team</h2><p data-uni-stage="copy">Beim Gruppenreferat bleiben eure Unterlagen in der gemeinsamen Datenbank zusammen. Teilt die Aufgaben dazu, damit alle wissen, wer woran arbeitet.</p></div>
              <figure className="uni-reel uni-reel-files">
                <video className="uni-video" data-uni-stage="media" width="896" height="414" muted playsInline loop preload="none" poster="/universe-landing/dateien.webp" src="/universe-landing/dateien.mp4" aria-label="Die Dateiablage wechselt von allen Dateien in die Fachordner Methodenlehre und Diagnostik" />
                <figcaption data-uni-stage="last">Die Dateiablage als Vorlage für die gemeinsame Datenbank</figcaption>
              </figure>
            </div>
        </section>
        <section className="uni-page-section uni-toolkit" id="uni-werkzeuge" data-uni-panel tabIndex={-1} aria-labelledby="uni-toolkit-title">
            <div className="uni-wrap">
              <div className="uni-section-head" data-uni-reveal><h2 id="uni-toolkit-title" data-uni-stage="heading">Alles in einer App</h2><p data-uni-stage="copy">Für ein Referat kannst du im Skript anfangen und aus deinen Notizen direkt die Folien vorbereiten.</p></div>
              <div className="uni-tools">
                <figure className="uni-tool" data-uni-reveal>
                  <video className="uni-video" data-uni-stage="media" width="600" height="360" muted playsInline loop preload="none" poster="/universe-landing/pdf.webp" src="/universe-landing/pdf.mp4" aria-label="Der PDF-Reader zeigt markierte Stellen in einem Skript über Angststörungen" />
                  <figcaption data-uni-stage="last"><strong>Im Skript anfangen</strong><span>Markiere die Stelle, auf die du dich im Referat beziehen willst.</span></figcaption>
                </figure>
                <figure className="uni-tool" data-uni-reveal>
                  <video className="uni-video" data-uni-stage="media" width="600" height="388" muted playsInline loop preload="none" poster="/universe-landing/notizen.webp" src="/universe-landing/notizen.mp4" aria-label="Mitschrift zu Angststörungen und Notiz der Lerngruppe mit Fragen für ein Fallbeispiel" />
                  <figcaption data-uni-stage="last"><strong>Gedanken ordnen</strong><span>Halte die Argumente in einer Notiz fest und verlinke die Quelle.</span></figcaption>
                </figure>
                <figure className="uni-tool" data-uni-reveal>
                  <video className="uni-video" data-uni-stage="media" width="600" height="360" muted playsInline loop preload="none" poster="/universe-landing/praesentationen.webp" src="/universe-landing/praesentationen.mp4" aria-label="Drei Folien im UniVerse-Präsentationseditor" />
                  <figcaption data-uni-stage="last"><strong>Das Referat vorbereiten</strong><span>Mach aus deiner Notiz die Folien, die du vorführst.</span></figcaption>
                </figure>
              </div>
            </div>
        </section>

        <section className="uni-page-section uni-about" id="uni-about" data-uni-panel tabIndex={-1} aria-labelledby="uni-about-title">
          <div className="uni-wrap uni-about-layout">
            <div className="uni-about-copy" data-uni-reveal>
              <h2 id="uni-about-title" data-uni-stage="heading">Über UniVerse</h2>
              <p className="uni-about-lead" data-uni-stage="copy">UniVerse ist der digitale Arbeitsbereich für deinen Uni-Alltag.</p>
              <p data-uni-stage="copy">Hier planst du dein Semester, verwaltest deine Aufgaben und arbeitest sie direkt in der App ab.</p>
              <p data-uni-stage="last">Steht ein Gruppenreferat an, könnt ihr eure Unterlagen sammeln, die Aufgaben aufteilen und im selben Arbeitsbereich die Folien vorbereiten.</p>
            </div>
            <div data-uni-reveal aria-hidden="true"><div className="uni-about-art" data-uni-stage="media"><UniVerseOrbit /></div></div>
          </div>
        </section>
        <section className="uni-page-section uni-faq" id="uni-faq" data-uni-panel tabIndex={-1} aria-labelledby="uni-faq-title">
          <div className="uni-wrap">
            <div data-uni-reveal><h2 id="uni-faq-title" data-uni-stage="heading">Häufige Fragen</h2></div>
            <div className="uni-faq-groups">
              <div className="uni-faq-group" data-uni-reveal>
                <h3 data-uni-stage="copy">Einstieg</h3>
                <details data-uni-stage="row" open><summary>Wie starte ich mit UniVerse?</summary><p>Wähle „Zur App“. Dort kannst du ein Konto erstellen oder dich anmelden. Danach öffnet sich dein Dashboard.</p></details>
                <details data-uni-stage="row"><summary>Muss ich UniVerse installieren?</summary><p>Du kannst UniVerse direkt im Browser öffnen.</p></details>
                <details data-uni-stage="row"><summary>Kann ich mein Dashboard direkt öffnen?</summary><p>Ja. Speichere den Dashboard-Link als Lesezeichen. Wenn du abgemeldet bist, kannst du dich dort anmelden.</p></details>
              </div>
              <div className="uni-faq-group" data-uni-reveal>
                <h3 data-uni-stage="copy">Im Uni-Alltag</h3>
                <details data-uni-stage="row"><summary>Wo sehe ich, was als Nächstes ansteht?</summary><p>Der Zentrale Hub zeigt dir deine Termine, offenen Aufgaben und anstehenden Abgaben.</p></details>
                <details data-uni-stage="row"><summary>Kann ich nach Fächern filtern?</summary><p>Ja. Im Hub kannst du Termine, Aufgaben und Noten nach Fach filtern. Auch Notizen lassen sich einem Fach zuordnen.</p></details>
                <details data-uni-stage="row"><summary>Kann ich im PDF-Reader auf meine Notizen zugreifen?</summary><p>Ja. Verlinke die PDF in einer Notiz. Verknüpfte Notizen erscheinen im Reader in der Seitenleiste.</p></details>
                <details data-uni-stage="row"><summary>Kann ich mit meiner Lerngruppe zusammenarbeiten?</summary><p>Ja. Ihr könnt Aufgaben und Abgaben miteinander teilen.</p></details>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="uni-footer">
        <div className="uni-wrap">
          <a className="uni-brand" href="#uni-start"><span className="uni-mark"><UniVerseLogo /></span><span><b>Uni</b>Verse</span></a>
          <a className="uni-button uni-button-secondary" href="/dashboard">Zur App</a>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
