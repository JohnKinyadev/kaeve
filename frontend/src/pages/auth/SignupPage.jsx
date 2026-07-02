import { useState } from "react";
import { Coffee } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SocialAuthButtons } from "../../components/shared/SocialAuthButtons";
import { useAuth } from "../../hooks/useAuth";

export function SignupPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register(form);
      window.location.hash = "#/dashboard";
    } catch (err) {
      setError(err.message || "Unable to create account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <div className="auth-copy-inner">
          <span className="eyebrow">Member onboarding</span>
          <h1>Join the cooperative portal</h1>
          <p>Create your login first. After signing in, finish your member details inside the portal.</p>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-brand">
          <Coffee size={28} />
          <span>Kaeve Coffee</span>
        </div>
        <h1>Create account</h1>
        <p>Start with your username, email, and password.</p>

        <SocialAuthButtons next="/dashboard" showGithub={false} />
        <div className="auth-divider"><span>or create manually</span></div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Input
            label="Username"
            autoComplete="username"
            value={form.username}
            onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
            required
          />
          {error && <div className="form-error">{error}</div>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account? <a href="#/login">Sign in</a>
        </p>
      </section>
    </main>
  );
}
