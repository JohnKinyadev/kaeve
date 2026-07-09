import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <a className="icon-button" href="#/notifications" aria-label="Notifications" title="Notifications">
      <Bell size={19} />
      <span />
    </a>
  );
}
