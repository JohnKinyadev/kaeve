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
const productionLoanTypes = new Set(["cherry_advance", "input_advance"]);
const emptyLoanForm = {
  member: "",
  season: "",
  loan_type: "cherry_advance",
  proof_type: "delivery_history",
  amount: "",
  expected_production_kg: "",
  rate_per_kg: "50",
  savings_amount: "",
  interest_rate_percent: "5",
  term_months: "6",
  reason: "",
  guarantor_details: "",
  collateral_details: "",
};

export function LoansPage() {
  const { role } = useAuth();
  const [status, setStatus] = useState("pending");
  const [action, setAction] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyLoanForm);
  const [message, setMessage] = useState("");
  const loans = useApiResource(`/api/loans/${toQueryString({ status })}`);
  const members = useApiResource("/api/members/");
  const seasons = useApiResource("/api/seasons/?is_active=true&is_closed=false");
  const canReview = [ROLES.ADMIN, ROLES.MANAGER].includes(role);
  const canApply = [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY].includes(role);
  const isProductionLoan = productionLoanTypes.has(form.loan_type);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLoan(event) {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient.post("/api/loans/", form);
      setForm(emptyLoanForm);
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
            <label className="field">
              <span>Loan type</span>
              <select value={form.loan_type} onChange={(event) => updateForm("loan_type", event.target.value)}>
                <option value="cherry_advance">Cherry advance</option>
                <option value="input_advance">Farm input advance</option>
                <option value="development">Development loan</option>
                <option value="school_fees">School fees loan</option>
                <option value="emergency">Emergency loan</option>
              </select>
            </label>
            <label className="field">
              <span>Proof basis</span>
              <select value={form.proof_type} onChange={(event) => updateForm("proof_type", event.target.value)}>
                <option value="delivery_history">Recent delivery schedule</option>
                <option value="farm_acreage">Farm acreage</option>
                <option value="historical_yield">Historical yield</option>
                <option value="savings">Savings or shares</option>
              </select>
            </label>
            <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} required />
            <Input
              label={isProductionLoan ? "Expected production kg" : "Savings or shares amount"}
              type="number"
              step="0.01"
              value={isProductionLoan ? form.expected_production_kg : form.savings_amount}
              onChange={(event) => updateForm(isProductionLoan ? "expected_production_kg" : "savings_amount", event.target.value)}
            />
            {isProductionLoan && <Input label="Advance rate per kg" type="number" min="40" max="60" step="0.01" value={form.rate_per_kg} onChange={(event) => updateForm("rate_per_kg", event.target.value)} />}
            <Input label="Interest rate percent" type="number" min="5" max="7.5" step="0.1" value={form.interest_rate_percent} onChange={(event) => updateForm("interest_rate_percent", event.target.value)} required />
            <Input label="Term months" type="number" min="1" max="36" step="1" value={form.term_months} onChange={(event) => updateForm("term_months", event.target.value)} required />
            <Input label="Reason" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} />
            <label className="field field-wide">
              <span>{isProductionLoan ? "Crop lien / collateral details" : "Guarantor details"}</span>
              <textarea
                value={isProductionLoan ? form.collateral_details : form.guarantor_details}
                onChange={(event) => updateForm(isProductionLoan ? "collateral_details" : "guarantor_details", event.target.value)}
              />
            </label>
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
            { key: "loan_type", label: "Type", render: (row) => row.loan_type_display || row.loan_type },
            { key: "amount", label: "Amount Requested", render: (row) => formatCurrency(Number(row.amount || 0)) },
            { key: "eligible_amount", label: "Eligible", render: (row) => formatCurrency(Number(row.eligible_amount || 0)) },
            { key: "recovery_amount", label: "Recovery", render: (row) => formatCurrency(Number(row.recovery_amount || 0)) },
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
