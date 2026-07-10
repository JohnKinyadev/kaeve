import { useEffect, useState } from "react";

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
const emptyLoanForm = {
  member: "",
  loan_type: "cherry_advance",
  proof_type: "delivery_history",
  collateral_type: "future_harvest",
  guarantor: "",
  amount: "",
  expected_production_kg: "",
  savings_amount: "",
  term_months: "6",
  reason: "",
  guarantor_details: "",
  collateral_details: "",
};

export function LoansPage() {
  const { role } = useAuth();
  const [status, setStatus] = useState("pending");
  const [action, setAction] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyLoanForm);
  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState(null);
  const [message, setMessage] = useState("");
  const loans = useApiResource(`/api/loans/${toQueryString({ status })}`);
  const members = useApiResource("/api/members/");
  const canReview = [ROLES.ADMIN, ROLES.MANAGER].includes(role);
  const canApply = [ROLES.ADMIN, ROLES.MANAGER, ROLES.SECRETARY].includes(role);
  const usesFutureHarvest = form.collateral_type === "future_harvest";

  useEffect(() => {
    let isMounted = true;
    loansAPI.currentPolicy()
      .then((data) => {
        if (!isMounted) return;
        setPolicy(data);
        setPolicyForm(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePolicy(field, value) {
    setPolicyForm((current) => ({ ...current, [field]: value }));
  }

  async function savePolicy(event) {
    event.preventDefault();
    setMessage("");
    try {
      const nextPolicy = await apiClient.patch(`/api/loan-policies/${policy.id}/`, policyForm);
      setPolicy(nextPolicy);
      setPolicyForm(nextPolicy);
      setMessage("Loan policy updated.");
    } catch (err) {
      setMessage(err.message || "Unable to update loan policy.");
    }
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
      } else if (action.type === "Reject") {
        await loansAPI.reject(action.row.id);
      } else {
        await loansAPI.reopen(action.row.id);
      }
      await loans.reload();
      setAction(null);
      setMessage(action.type === "Reopen" ? "Loan reopened for correction." : `Loan ${action.type.toLowerCase()}d.`);
    } catch (err) {
      setMessage(err.message || "Unable to update loan.");
    }
  }

  return (
    <div className="page-stack">
      {(loans.error || members.error) && <div className="form-error">{loans.error || members.error}</div>}
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

      {role === ROLES.ADMIN && policyForm && (
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <h2>Loan Policy</h2>
              <span>Rates set here appear read-only on member applications</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={savePolicy}>
            <Input label="Advance rate per kg" type="number" step="0.01" value={policyForm.advance_rate_per_kg} onChange={(event) => updatePolicy("advance_rate_per_kg", event.target.value)} required />
            <Input label="Interest rate percent" type="number" min="5" max="7.5" step="0.1" value={policyForm.interest_rate_percent} onChange={(event) => updatePolicy("interest_rate_percent", event.target.value)} required />
            <Input label="Future harvest cap percent" type="number" min="1" max="100" step="0.1" value={policyForm.future_harvest_cap_percent} onChange={(event) => updatePolicy("future_harvest_cap_percent", event.target.value)} required />
            <Input label="Max guarantor-backed loan" type="number" step="0.01" value={policyForm.max_unsecured_guarantor_loan} onChange={(event) => updatePolicy("max_unsecured_guarantor_loan", event.target.value)} required />
            <label className="inline-select">
              <input type="checkbox" checked={Boolean(policyForm.applications_open)} onChange={(event) => updatePolicy("applications_open", event.target.checked)} />
              <span>Applications open</span>
            </label>
            <div className="form-actions">
              <Button type="submit">Save Policy</Button>
            </div>
          </form>
        </article>
      )}

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
              <span>Collateral category</span>
              <select value={form.collateral_type} onChange={(event) => updateForm("collateral_type", event.target.value)}>
                <option value="future_harvest">Future harvest / crop lien</option>
                <option value="guarantor">Member guarantor</option>
              </select>
            </label>
            {policy && (
              <div className="loan-policy-summary field-wide">
                <span>Advance rate: {formatCurrency(Number(policy.advance_rate_per_kg || 0))}/kg</span>
                <span>Interest: {policy.interest_rate_percent}%</span>
                <span>Harvest cap: {policy.future_harvest_cap_percent}%</span>
              </div>
            )}
            <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} required />
            {!usesFutureHarvest && (
              <>
                <Input
                  label="Savings or shares amount"
                  type="number"
                  step="0.01"
                  value={form.savings_amount}
                  onChange={(event) => updateForm("savings_amount", event.target.value)}
                  required
                />
                <label className="field">
                  <span>Guarantor</span>
                  <select value={form.guarantor} onChange={(event) => updateForm("guarantor", event.target.value)} required>
                    <option value="">Select guarantor</option>
                    {getResults(members.data)
                      .filter((member) => String(member.id) !== String(form.member))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.membership_number} - {member.full_name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <Input label="Term months" type="number" min="1" max="36" step="1" value={form.term_months} onChange={(event) => updateForm("term_months", event.target.value)} required />
            <Input label="Reason" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} />
            {usesFutureHarvest && (
              <label className="field field-wide">
                <span>Crop lien notes</span>
                <textarea value={form.collateral_details} onChange={(event) => updateForm("collateral_details", event.target.value)} />
              </label>
            )}
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
            (
              <div className="row-actions">
                <Button variant="ghost" onClick={() => setSelectedLoan(row)}>View</Button>
                {canReview && row.status === "pending" && (
                  <>
                    <Button variant="ghost" onClick={() => setAction({ type: "Approve", row })}>Approve</Button>
                    <Button variant="ghost" onClick={() => setAction({ type: "Reject", row })}>Reject</Button>
                  </>
                )}
                {canReview && ["approved", "rejected"].includes(row.status) && (
                  <Button variant="ghost" onClick={() => setAction({ type: "Reopen", row })}>Correct</Button>
                )}
              </div>
            )
          }
        />
      </article>
      {selectedLoan && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal loan-detail-modal" role="dialog" aria-modal="true" aria-label="Loan details">
            <header>
              <h2>Loan details</h2>
              <Button variant="ghost" onClick={() => setSelectedLoan(null)}>Close</Button>
            </header>
            <dl className="detail-list">
              <div><dt>Member</dt><dd>{selectedLoan.membership_number} - {selectedLoan.member_name}</dd></div>
              <div><dt>Season</dt><dd>{selectedLoan.season_name}</dd></div>
              <div><dt>Type</dt><dd>{selectedLoan.loan_type_display || selectedLoan.loan_type}</dd></div>
              <div><dt>Proof</dt><dd>{selectedLoan.proof_type_display || selectedLoan.proof_type}</dd></div>
              <div><dt>Collateral</dt><dd>{selectedLoan.collateral_type_display || selectedLoan.collateral_type}</dd></div>
              <div><dt>Guarantor</dt><dd>{selectedLoan.guarantor_name ? `${selectedLoan.guarantor_membership_number} - ${selectedLoan.guarantor_name}` : "Not applicable"}</dd></div>
              <div><dt>Amount</dt><dd>{formatCurrency(Number(selectedLoan.amount || 0))}</dd></div>
              <div><dt>Eligible</dt><dd>{formatCurrency(Number(selectedLoan.eligible_amount || 0))}</dd></div>
              <div><dt>Interest</dt><dd>{formatCurrency(Number(selectedLoan.estimated_interest || 0))} at {selectedLoan.interest_rate_percent}%</dd></div>
              <div><dt>Recovery</dt><dd>{formatCurrency(Number(selectedLoan.recovery_amount || 0))}</dd></div>
              <div><dt>Term</dt><dd>{selectedLoan.term_months} months</dd></div>
              <div><dt>Last 12 months delivery</dt><dd>{selectedLoan.last_12_month_delivery_kg} kg</dd></div>
              <div><dt>Reason</dt><dd>{selectedLoan.reason || "No reason provided"}</dd></div>
              <div><dt>Guarantor notes</dt><dd>{selectedLoan.guarantor_details || "None"}</dd></div>
              <div><dt>Collateral notes</dt><dd>{selectedLoan.collateral_details || "None"}</dd></div>
              <div><dt>Status</dt><dd>{selectedLoan.status_display || selectedLoan.status}</dd></div>
              <div><dt>Reviewed by</dt><dd>{selectedLoan.reviewed_by_username || "Not reviewed"}</dd></div>
            </dl>
            <footer>
              <Button onClick={() => setSelectedLoan(null)}>Done</Button>
            </footer>
          </section>
        </div>
      )}
      {action && (
        <Modal title={`${action.type} loan?`} confirmLabel={action.type} onClose={() => setAction(null)} onConfirm={confirmAction}>
          <p>{action.type} {action.row.member_name}'s loan request for {formatCurrency(Number(action.row.amount || 0))}.</p>
        </Modal>
      )}
    </div>
  );
}
