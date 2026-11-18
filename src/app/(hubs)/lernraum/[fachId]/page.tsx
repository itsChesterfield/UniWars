import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Lernraum, type LernNachricht } from "@/components/lernraum/lernraum";
import { lernraumSichern, quellenListe } from "@/lib/ki/lernraum-server";
import { profilLesen } from "@/lib/ki/lernraum";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const metadata = { title: "Lernraum · UniVerse" };

export default async function LernraumSeite({ params }: { params: Promise<{ fachId: string }> }) {
  const { fachId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: fach, error } = await supabase.from("fach").select("id, name, farbe").eq("id", fachId).maybeSingle();
  if (error?.code === "22P02") notFound(); // keine gültige ID
  if (error) throw new Error(error.message);
  if (!fach) notFound();

  const lernraumId = await lernraumSichern(supabase, user.id, fach.id);
  const [quellen, { data: verlauf }, { data: settings }, { data: pdfs }, { data: notizen }, { data: kompetenz }] = await Promise.all([
    quellenListe(supabase, lernraumId, fach.id),
    supabase.from("lernraum_nachricht").select("id, rolle, inhalt, meta").eq("lernraum_id", lernraumId).order("erstellt_am", { ascending: true }).limit(100),
    supabase.from("settings").select("ki_profil").eq("user_id", user.id).maybeSingle(),
    supabase.from("datei").select("id, name, fach_id").eq("mime_typ", "application/pdf").order("name"),
    supabase.from("notiz").select("id, titel, fach_id").order("geaendert_am", { ascending: false }).limit(300),
    supabase.from("ki_thema_stand").select("thema, beherrschung, fehlerbild").eq("fach_id", fach.id).order("beherrschung", { ascending: true }).limit(40),
  ]);

  return (
    <>
      <Lernraum
        kiVerfuegbar={kiKonfiguriert()}
        lernraumId={lernraumId}
        fach={fach}
        startQuellen={quellen.map(({ art, id, titel, herkunft, aktiv, seiten }) => ({ art, id, titel, herkunft, aktiv, seiten }))}
        weitere={[
          ...(pdfs ?? []).filter((p) => p.fach_id !== fach.id).map((p) => ({ art: "pdf" as const, id: p.id, titel: p.name })),
          ...(notizen ?? []).filter((n) => n.fach_id !== fach.id).map((n) => ({ art: "notiz" as const, id: n.id, titel: n.titel || "Unbenannte Notiz" })),
        ]}
        startVerlauf={(verlauf ?? []).map((n) => ({ id: n.id, rolle: n.rolle === "ki" ? "ki" : "nutzer", inhalt: n.inhalt, meta: (n.meta ?? {}) as LernNachricht["meta"] }))}
        startProfil={profilLesen(settings?.ki_profil)}
        kompetenz={kompetenz ?? []}
      />
    </>
  );
}
