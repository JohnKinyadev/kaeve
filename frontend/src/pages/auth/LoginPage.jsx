import { useState } from "react";
import { Coffee } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SocialAuthButtons } from "../../components/shared/SocialAuthButtons";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";

function nextPathForRole(role) {
  return role === ROLES.MEMBER ? "/portal" : "/dashboard";
}

export function LoginPage() {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await login(credentials);
      window.location.hash = `#${nextPathForRole(user?.role)}`;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <div className="auth-copy-inner">
          <span className="eyebrow">Coffee operations</span>
          <h1>Kaeve Coffee Cooperative</h1>
          <p>Manage members, deliveries, loans, milling, inventory, and payouts from one focused workspace.</p>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-brand">
          <Coffee size={28} />
          <span>Kaeve Coffee</span>
        </div>
        <h1>Welcome back</h1>
        <p>Access the cooperative operations workspace.</p>

        <SocialAuthButtons />
        <div className="auth-divider"><span>or use password</span></div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Input
            label="Username"
            autoComplete="username"
            value={credentials.username}
            onChange={(event) => setCredentials((value) => ({ ...value, username: event.target.value }))}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) => setCredentials((value) => ({ ...value, password: event.target.value }))}
            required
          />
          {error && <div className="form-error">{error}</div>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="auth-switch">
          No account yet? <a href="#/signup">Create a member account</a>
        </p>
      </section>
    </main>
  );
}
