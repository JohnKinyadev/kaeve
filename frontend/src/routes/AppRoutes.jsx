import { useEffect, useMemo, useState } from "react";

import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { PageWrapper } from "../components/layout/PageWrapper";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { DeliveriesPage } from "../pages/deliveries/DeliveriesPage";
import { LogDeliveryPage } from "../pages/deliveries/LogDeliveryPage";
import { LoanDetailPage } from "../pages/loans/LoanDetailPage";
import { LoansPage } from "../pages/loans/LoansPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { AuthCallbackPage } from "../pages/auth/AuthCallbackPage";
import { MemberDetailPage } from "../pages/members/MemberDetailPage";
import { MemberFormPage } from "../pages/members/MemberFormPage";
import { MembersListPage } from "../pages/members/MembersListPage";
import { MemberPortalPage } from "../pages/portal/MemberPortalPage";
import { MillingPage } from "../pages/milling/MillingPage";
import { InventoryPage } from "../pages/inventory/InventoryPage";
import { UsersPage } from "../pages/users/UsersPage";
import { PayoutStatementPage } from "../pages/payouts/PayoutStatementPage";
import { PayoutsPage } from "../pages/payouts/PayoutsPage";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { SeasonDetailPage } from "../pages/seasons/SeasonDetailPage";
import { SeasonsListPage } from "../pages/seasons/SeasonsListPage";
import { ROLES } from "../utils/constants";
import { useAuth } from "../hooks/useAuth";

const routeTitles = {
  "/dashboard": "Dashboard",
  "/members": "Members",
  "/users": "Users",
  "/members/new": "Register Member",
  "/seasons": "Seasons",
  "/deliveries": "Deliveries",
  "/deliveries/log": "Log Delivery",
  "/milling": "Milling",
  "/inventory": "Inventory",
  "/loans": "Loans",
  "/payouts": "Payouts",
  "/reports": "Reports",
};

function getHashPath() {
  return window.location.hash.replace(/^#/, "") || "/dashboard";
}

function useHashPath() {
  const [path, setPath] = useState(getHashPath);

  useEffect(() => {
    function handleHashChange() {
      setPath(getHashPath());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return path;
}

function NotFound() {
  return (
    <article className="panel empty-state">
      <h2>Page not found</h2>
      <p>The requested workspace page does not exist.</p>
    </article>
  );
}

function resolveRoute(path) {
  if (path === "/login") return { public: true, element: <LoginPage /> };
  if (path === "/signup") return { public: true, element: <SignupPage /> };
  if (path.startsWith("/auth/callback")) return { public: true, element: <AuthCallbackPage /> };
  if (path === "/portal") return { title: "Member Portal", roles: [ROLES.MEMBER], element: <MemberPortalPage />, bare: true };
  if (path === "/dashboard") return { title: "Dashboard", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER], element: <DashboardPage /> };
  if (path === "/users") return { title: "Users", roles: [ROLES.ADMIN], element: <UsersPage /> };
  if (path === "/members") return { title: "Members", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER], element: <MembersListPage /> };
  if (path === "/members/new") return { title: "Register Member", roles: [ROLES.ADMIN], element: <MemberFormPage /> };
  if (path.startsWith("/members/")) return { title: "Member Detail", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER], element: <MemberDetailPage /> };
  if (path === "/seasons") return { title: "Seasons", roles: [ROLES.ADMIN, ROLES.MANAGER], element: <SeasonsListPage /> };
  if (path.startsWith("/seasons/")) return { title: "Season Detail", roles: [ROLES.ADMIN, ROLES.MANAGER], element: <SeasonDetailPage /> };
  if (path === "/deliveries") return { title: "Deliveries", roles: [ROLES.ADMIN, ROLES.FIELD_OFFICER], element: <DeliveriesPage /> };
  if (path === "/deliveries/log") return { title: "Log Delivery", roles: [ROLES.ADMIN, ROLES.FIELD_OFFICER], element: <LogDeliveryPage /> };
  if (path === "/milling") return { title: "Milling", roles: [ROLES.ADMIN, ROLES.MANAGER], element: <MillingPage /> };
  if (path === "/inventory") return { title: "Inventory", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.FIELD_OFFICER], element: <InventoryPage /> };
  if (path === "/loans") return { title: "Loans", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY], element: <LoansPage /> };
  if (path.startsWith("/loans/")) return { title: "Loan Detail", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY], element: <LoanDetailPage /> };
  if (path.startsWith("/payouts/statement")) return { title: "Payout Statement", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.MEMBER], element: <PayoutStatementPage /> };
  if (path.startsWith("/payouts/")) return { title: "Payouts", roles: [ROLES.ADMIN, ROLES.MANAGER], element: <PayoutsPage /> };
  if (path === "/reports") return { title: "Reports", roles: [ROLES.ADMIN, ROLES.MANAGER], element: <ReportsPage /> };
  return { title: "Not Found", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY, ROLES.FIELD_OFFICER, ROLES.MEMBER], element: <NotFound /> };
}

export function AppRoutes() {
  const path = useHashPath();
  const { isAuthenticated, role } = useAuth();
  const route = useMemo(() => resolveRoute(path), [path]);

  useEffect(() => {
    if (path === "/" || path === "") {
      window.location.hash = isAuthenticated && role === ROLES.MEMBER ? "#/portal" : "#/dashboard";
    }
  }, [isAuthenticated, path, role]);

  if (route.public) return route.element;

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const protectedElement = <ProtectedRoute allowedRoles={route.roles}>{route.element}</ProtectedRoute>;
  if (route.bare) return protectedElement;

  return (
    <ProtectedRoute allowedRoles={route.roles}>
      <PageWrapper title={route.title || routeTitles[path] || "Workspace"} currentPath={path}>
        {route.element}
      </PageWrapper>
    </ProtectedRoute>
  );
}
