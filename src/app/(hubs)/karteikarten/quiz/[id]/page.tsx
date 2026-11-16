import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizSpielen } from "@/components/quiz/quiz-spielen";
import { fragenLesen, versuchAntwortenLesen } from "@/lib/ki/quiz";
import type { QuellInfo } from "@/lib/ki/quiz-server";

export const metadata = { title: "Quiz · UniWars" };
export const maxDuration = 120;

export default async function QuizSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modus?: string }> }) {
  const [{ id }, { modus }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: quiz }, { data: versuche }] = await Promise.all([
    supabase.from("quiz").select("id, titel, fragen, quellen").eq("id", id).maybeSingle(),
    supabase.from("quiz_versuch").select("antworten").eq("quiz_id", id).order("erstellt_am", { ascending: false }).limit(10),
  ]);
  if (!quiz) notFound();
  return (
    <QuizSpielen
      quiz={{ id: quiz.id, titel: quiz.titel, fragen: fragenLesen(quiz.fragen), quellen: (Array.isArray(quiz.quellen) ? quiz.quellen : []) as unknown as QuellInfo[] }}
      versuche={(versuche ?? []).map((v) => ({ antworten: versuchAntwortenLesen(v.antworten) }))}
      startModus={modus === "schwaechen" ? "schwaechen" : null}
    />
  );
}
