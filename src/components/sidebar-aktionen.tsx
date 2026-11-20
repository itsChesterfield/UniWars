"use client";

import { logout } from "@/app/logout/actions";
import { abmelden } from "@/lib/analytics";

export function AbmeldenButton() {
  return (
    <form action={logout}>
      <button type="submit" className="knopf leise" onClick={() => abmelden()}>
        Abmelden
      </button>
    </form>
  );
}
