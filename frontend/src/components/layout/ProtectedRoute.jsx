import { ROLES } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";

export function ProtectedRoute({ allowedRoles = Object.values(ROLES), children }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>Access restricted</h1>
          <p>Your account does not have permission to view this workspace.</p>
        </section>
      </main>
    );
  }

  return children;
}
