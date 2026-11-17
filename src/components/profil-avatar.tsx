/* eslint-disable @next/next/no-img-element -- signierte Supabase-URL, ändert sich stündlich */

/** Initialen, wie sie im Avatar ohne Bild stehen. */
export const avatarInitialen = (name: string) => name.slice(0, 2).toUpperCase();

/** Name für Knöpfe mit Avatar: Sichtbare Initialen stehen vorn, damit Sprachsteuerung sie findet (WCAG 2.5.3). */
export const avatarName = (name: string, url: string | null, rest: string) => (url ? rest : `${avatarInitialen(name)}, ${rest}`);

/** Rundes Profilbild – ohne Bild die ersten zwei Buchstaben des Namens. */
export function ProfilAvatar({ name, url, groesse = 44 }: { name: string; url: string | null; groesse?: number }) {
  return (
    <span className="avatar profil-avatar" style={{ width: groesse, height: groesse, fontSize: groesse * 0.36 }} aria-hidden>
      {url ? <img src={url} alt="" width={groesse} height={groesse} /> : avatarInitialen(name)}
    </span>
  );
}
