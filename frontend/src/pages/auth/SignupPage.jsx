import { useState } from "react";
import { Coffee } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";

export function SignupPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    national_id: "",
    phone_number: "",
    farm_size_acres: "",
    location: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register(form);
      window.location.hash = "#/portal";
    } catch (err) {
      setError(err.message || "Unable to create account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <Coffee size={28} />
          <span>Kaeve Coffee</span>
        </div>
        <h1>Create account</h1>
        <p>Public signup creates a member account and profile.</p>

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
          <Input
            label="Full name"
            value={form.full_name}
            onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))}
            required
          />
          <Input
            label="National ID"
            value={form.national_id}
            onChange={(event) => setForm((value) => ({ ...value, national_id: event.target.value }))}
            required
          />
          <Input
            label="Phone number"
            value={form.phone_number}
            onChange={(event) => setForm((value) => ({ ...value, phone_number: event.target.value }))}
          />
          <Input
            label="Farm size acres"
            type="number"
            step="0.01"
            value={form.farm_size_acres}
            onChange={(event) => setForm((value) => ({ ...value, farm_size_acres: event.target.value }))}
            required
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))}
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
