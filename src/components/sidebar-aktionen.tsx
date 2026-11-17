"use client";

import { logout } from "@/app/logout/actions";
import { abmelden } from "@/lib/analytics";

export function AbmeldenButton() {
  return (
    <form action={logout}>
      <button type="submit" className="sidebar-logout" onClick={() => abmelden()}>
        Abmelden
      </button>
    </form>
  );
}
