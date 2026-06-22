import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <button className="icon-button" type="button" aria-label="Notifications" title="Notifications">
      <Bell size={19} />
      <span />
    </button>
  );
}

