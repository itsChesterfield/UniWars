import type { Tables } from "@/lib/supabase/types";

export type FachOption = Pick<Tables<"fach">, "id" | "name" | "farbe">;
