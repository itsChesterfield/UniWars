import { logout } from "@/app/logout/actions";

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">UniWars</div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-active">Übersicht</span>
        {/* Weitere Hubs (Notizen, Karteikarten, …) kommen hier additiv dazu */}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-user">{email}</span>
        <form action={logout}>
          <button type="submit" className="sidebar-logout">
            Abmelden
          </button>
        </form>
      </div>
    </aside>
  );
}
