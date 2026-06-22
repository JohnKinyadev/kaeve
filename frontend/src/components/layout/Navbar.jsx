import { LogOut, Menu } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { NotificationBell } from "../shared/NotificationBell";

export function Navbar({ title, subtitle, onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button mobile-menu" type="button" aria-label="Open menu" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <NotificationBell />
        <div className="user-chip">
          <strong>{user?.name || "User"}</strong>
          <span>{user?.role}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Logout" title="Logout" onClick={logout}>
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}

