import { Banknote, BarChart3, Boxes, Factory, Home, Leaf, Scale, UserCog, Users, WalletCards } from "lucide-react";

import { ROLES } from "../../utils/constants";
import { classNames } from "../../utils/helpers";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: Home, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER, ROLES.MEMBER] },
  { label: "Complete Registration", path: "/complete-registration", icon: UserCog, roles: [ROLES.MEMBER] },
  { label: "Users", path: "/users", icon: UserCog, roles: [ROLES.ADMIN] },
  { label: "Members", path: "/members", icon: Users, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER] },
  { label: "Seasons", path: "/seasons", icon: Leaf, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { label: "Deliveries", path: "/deliveries", icon: Scale, roles: [ROLES.ADMIN, ROLES.SECRETARY, ROLES.FIELD_OFFICER] },
  { label: "Milling", path: "/milling", icon: Factory, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { label: "Inventory", path: "/inventory", icon: Boxes, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.FIELD_OFFICER] },
  { label: "Loans", path: "/loans", icon: Banknote, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY] },
  { label: "Payouts", path: "/payouts/main-2026", icon: WalletCards, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { label: "Reports", path: "/reports", icon: BarChart3, roles: [ROLES.ADMIN, ROLES.MANAGER] },
];

export function Sidebar({ currentPath, role }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#/dashboard">
        <span className="brand-mark">KC</span>
        <span>
          <strong>Kaeve Coffee</strong>
          <small>Cooperative system</small>
        </span>
      </a>

      <nav className="nav-list" aria-label="Primary">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const Icon = item.icon;
            return (
              <a className={classNames(currentPath.startsWith(item.path) && "active")} href={`#${item.path}`} key={item.path}>
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
      </nav>
    </aside>
  );
}
