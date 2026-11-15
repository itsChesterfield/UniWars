/* eslint-disable @next/next/no-img-element -- signierte Supabase-URL, ändert sich stündlich */

/** Rundes Profilbild – ohne Bild die ersten zwei Buchstaben des Namens. */
export function ProfilAvatar({ name, url, groesse = 44 }: { name: string; url: string | null; groesse?: number }) {
  return (
    <span className="avatar profil-avatar" style={{ width: groesse, height: groesse, fontSize: groesse * 0.36 }} aria-hidden>
      {url ? <img src={url} alt="" width={groesse} height={groesse} /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}
