import { useEffect, useState } from "react";

import { useAuth } from "../../hooks/useAuth";

export function AuthCallbackPage() {
  const { completeSocialLogin } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    async function finishLogin() {
      const query = window.location.hash.split("?")[1] || "";
      const params = new URLSearchParams(query);
      const access = params.get("access");
      const refresh = params.get("refresh");
      const next = params.get("next");

      if (!access || !refresh) {
        setError("Social login did not return a valid session.");
        return;
      }

      try {
        await completeSocialLogin({ access, refresh });
        window.location.hash = `#${next || "/dashboard"}`;
      } catch (err) {
        setError(err.message || "Unable to complete social login.");
      }
    }

    finishLogin();
  }, [completeSocialLogin]);

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>Finishing sign in</h1>
        <p>{error || "Securing your session and loading your workspace..."}</p>
        {error && <div className="form-error">{error}</div>}
        {error && (
          <div className="auth-actions">
            <a className="btn btn-primary" href="#/signup">
              Create account
            </a>
            <a className="btn btn-secondary" href="#/login">
              Back to sign in
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
