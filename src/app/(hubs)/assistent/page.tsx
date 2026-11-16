import { Suspense } from "react";
import { AssistentSeite } from "@/components/assistent/assistent-seite";

export const metadata = { title: "UniVerse Studio · UniWars" };

/** UniVerse Studio als ganze Seite (derselbe Chat wie in der Leiste) */
export default function AssistentPage() {
  return (
    <Suspense fallback={null}>
      <AssistentSeite />
    </Suspense>
  );
}
