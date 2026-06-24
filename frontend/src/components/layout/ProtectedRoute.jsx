import { ROLES } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";

function homeForRole(role) {
  return role === ROLES.MEMBER ? "/portal" : "/dashboard";
}

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
          <div className="auth-actions">
            <a className="btn btn-primary" href={`#${homeForRole(role)}`}>
              Go to my dashboard
            </a>
            <button className="btn btn-secondary" type="button" onClick={() => window.history.back()}>
              Go back
            </button>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
