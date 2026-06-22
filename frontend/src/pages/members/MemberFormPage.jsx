import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function MemberFormPage() {
  return (
    <article className="panel form-panel">
      <div className="panel-header">
        <div>
          <h2>Register New Member</h2>
          <span>Capture farmer and farm details</span>
        </div>
      </div>
      <form className="form-grid">
        <Input label="Full name" required />
        <Input label="Phone number" required />
        <Input label="Membership no." />
        <Input label="Location" />
        <Input label="Farm size" />
        <Input label="National ID" />
        <div className="form-actions">
          <Button variant="secondary">Save Draft</Button>
          <Button>Register Member</Button>
        </div>
      </form>
    </article>
  );
}

