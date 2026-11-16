import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PodcastPlayer } from "@/components/quiz/podcast-player";
import { segmenteLesen } from "@/lib/ki/quiz";
import { audioVerfuegbar } from "@/lib/ki/audio";

export const metadata = { title: "Lern-Podcast · UniWars" };

export default async function PodcastSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: podcast } = await supabase.from("podcast").select("id, titel, skript").eq("id", id).maybeSingle();
  if (!podcast) notFound();
  return <PodcastPlayer titel={podcast.titel} segmente={segmenteLesen(podcast.skript)} vorlesen={audioVerfuegbar().vorlesen} />;
}
