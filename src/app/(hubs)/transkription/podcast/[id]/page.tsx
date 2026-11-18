import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PodcastPlayer } from "@/components/quiz/podcast-player";
import { segmenteLesen } from "@/lib/ki/quiz";
import { audioVerfuegbar } from "@/lib/ki/audio";

export const metadata = { title: "Lern-Podcast · UniVerse" };

export default async function PodcastSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: podcast, error } = await supabase.from("podcast").select("id, titel, skript").eq("id", id).maybeSingle();
  if (error?.code === "22P02") notFound(); // keine gültige ID
  if (error) throw new Error(error.message);
  if (!podcast) notFound();
  return <PodcastPlayer titel={podcast.titel} segmente={segmenteLesen(podcast.skript)} vorlesen={audioVerfuegbar().vorlesen} />;
}
