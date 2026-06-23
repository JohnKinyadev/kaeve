import { useState } from "react";

import { apiClient } from "../../api/axiosInstance";
import { loansAPI } from "../../api/loansAPI";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getResults, toQueryString } from "../../utils/helpers";

const statusTabs = ["pending", "approved", "rejected"];

export function LoansPage() {
  const { role } = useAuth();
  const [status, setStatus] = useState("pending");
  const [action, setAction] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ member: "", season: "", amount: "", reason: "" });
  const [message, setMessage] = useState("");
  const loans = useApiResource(`/api/loans/${toQueryString({ status })}`);
  const members = useApiResource("/api/members/");
  const seasons = useApiResource("/api/seasons/?is_active=true&is_closed=false");
  const canReview = [ROLES.ADMIN, ROLES.MANAGER].includes(role);
  const canApply = [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY].includes(role);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLoan(event) {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient.post("/api/loans/", form);
      setForm({ member: "", season: "", amount: "", reason: "" });
      setShowForm(false);
      setStatus("pending");
      await loans.reload();
      setMessage("Loan application recorded.");
    } catch (err) {
      setMessage(err.message || "Unable to record loan application.");
    }
  }

  async function confirmAction() {
    try {
      if (action.type === "Approve") {
        await loansAPI.approve(action.row.id);
      } else {
        await loansAPI.reject(action.row.id);
      }
      await loans.reload();
      setAction(null);
      setMessage(`Loan ${action.type.toLowerCase()}d.`);
    } catch (err) {
      setMessage(err.message || "Unable to update loan.");
    }
  }

  return (
    <div className="page-stack">
      {(loans.error || members.error || seasons.error) && <div className="form-error">{loans.error || members.error || seasons.error}</div>}
      {message && <div className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</div>}

      <section className="toolbar">
        <div className="tabs">
          {statusTabs.map((tab) => (
            <button className={status === tab ? "active" : ""} key={tab} onClick={() => setStatus(tab)} type="button">
              {tab}
            </button>
          ))}
        </div>
        {canApply && <Button onClick={() => setShowForm((value) => !value)}>Apply for Loan</Button>}
      </section>

      {showForm && (
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <h2>Loan Application</h2>
              <span>Secretary records the request on behalf of a member</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={submitLoan}>
            <label className="field">
              <span>Member</span>
              <select value={form.member} onChange={(event) => updateForm("member", event.target.value)} required>
                <option value="">Select member</option>
                {getResults(members.data).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.membership_number} - {member.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Season</span>
              <select value={form.season} onChange={(event) => updateForm("season", event.target.value)} required>
                <option value="">Select season</option>
                {getResults(seasons.data).map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} required />
            <Input label="Reason" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Record Application</Button>
            </div>
          </form>
        </article>
      )}

      <article className="panel">
        <Table
          columns={[
            { key: "member_name", label: "Member" },
            { key: "amount", label: "Amount Requested", render: (row) => formatCurrency(Number(row.amount || 0)) },
            { key: "requested_on", label: "Date", render: (row) => formatDate(row.requested_on) },
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "approved" ? "success" : row.status === "rejected" ? "neutral" : "warning"}>{row.status_display || row.status}</Badge> },
          ]}
          rows={getResults(loans.data)}
          renderActions={(row) =>
            canReview && row.status === "pending" ? (
              <>
                <Button variant="ghost" onClick={() => setAction({ type: "Approve", row })}>Approve</Button>
                <Button variant="ghost" onClick={() => setAction({ type: "Reject", row })}>Reject</Button>
              </>
            ) : null
          }
        />
      </article>
      {action && (
        <Modal title={`${action.type} loan?`} confirmLabel={action.type} onClose={() => setAction(null)} onConfirm={confirmAction}>
          <p>{action.type} {action.row.member_name}'s loan request for {formatCurrency(Number(action.row.amount || 0))}.</p>
        </Modal>
      )}
    </div>
  );
}
