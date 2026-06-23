import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { apiClient } from "../../api/axiosInstance";
import { payoutsAPI } from "../../api/payoutsAPI";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { ExportButton } from "../../components/shared/ExportButton";
import { useApiResource } from "../../hooks/useApiResource";
import { formatCurrency, formatKg } from "../../utils/formatters";
import { getResults, toQueryString } from "../../utils/helpers";

const emptyForm = {
  member: "",
  season: "",
  delivered_kg: "",
  gross_share: "",
  other_deductions: "0.00",
};

export function PayoutsPage() {
  const [season, setSeason] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const seasons = useApiResource("/api/seasons/?ordering=-start_date");
  const members = useApiResource("/api/members/");
  const payouts = useApiResource(`/api/payouts/${toQueryString({ season })}`);
  const seasonOptions = getResults(seasons.data);
  const selectedSeason = season || seasonOptions.find((item) => item.is_active)?.id || "";
  const rows = getResults(payouts.data);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function generatePayouts() {
    if (!selectedSeason) {
      setMessage("Select a season before generating payouts.");
      return;
    }
    setMessage("");
    try {
      const response = await payoutsAPI.calculate(selectedSeason);
      await payouts.reload();
      setMessage(`${response.payouts_generated || 0} payouts generated.`);
    } catch (err) {
      setMessage(err.message || "Unable to generate payouts.");
    }
  }

  async function savePayout(event) {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient.post("/api/payouts/", {
        ...form,
        season: form.season || selectedSeason,
      });
      setForm(emptyForm);
      setIsFormOpen(false);
      await payouts.reload();
      setMessage("Payout recorded.");
    } catch (err) {
      setMessage(err.message || "Unable to record payout.");
    }
  }

  return (
    <div className="page-stack">
      {(payouts.error || seasons.error || members.error) && <div className="form-error">{payouts.error || seasons.error || members.error}</div>}
      {message && <div className={message.includes("Unable") || message.includes("Select") ? "form-error" : "form-success"}>{message}</div>}
      <section className="toolbar">
        <select value={selectedSeason} onChange={(event) => setSeason(event.target.value)}>
          <option value="">Select season</option>
          {seasonOptions.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <Button onClick={generatePayouts}>Trigger Calculation</Button>
        <Button variant="secondary" onClick={() => setIsFormOpen((value) => !value)}>Record Payout</Button>
        <ExportButton>Export M-Pesa Excel</ExportButton>
        <Button variant="secondary"><CheckCircle2 size={16} /> Mark All Processed</Button>
      </section>

      {isFormOpen && (
        <article className="panel form-panel">
          <div className="panel-header"><h2>Record Payout</h2><span>Loan deductions are calculated automatically</span></div>
          <form className="form-grid" onSubmit={savePayout}>
            <label className="field">
              <span>Member</span>
              <select value={form.member} onChange={(event) => updateForm("member", event.target.value)} required>
                <option value="">Select member</option>
                {getResults(members.data).map((member) => (
                  <option key={member.id} value={member.id}>{member.membership_number} - {member.full_name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Season</span>
              <select value={form.season || selectedSeason} onChange={(event) => updateForm("season", event.target.value)} required>
                <option value="">Select season</option>
                {seasonOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <Input label="Delivered kg" type="number" step="0.01" value={form.delivered_kg} onChange={(event) => updateForm("delivered_kg", event.target.value)} required />
            <Input label="Gross share" type="number" step="0.01" value={form.gross_share} onChange={(event) => updateForm("gross_share", event.target.value)} required />
            <Input label="Other deductions" type="number" step="0.01" value={form.other_deductions} onChange={(event) => updateForm("other_deductions", event.target.value)} />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit">Save Payout</Button>
            </div>
          </form>
        </article>
      )}

      <article className="panel">
        <Table
          columns={[
            { key: "member_name", label: "Member" },
            { key: "delivered_kg", label: "Kg Delivered", render: (row) => formatKg(Number(row.delivered_kg || 0)) },
            { key: "gross_share", label: "Gross", render: (row) => formatCurrency(Number(row.gross_share || 0)) },
            { key: "loan_deductions", label: "Loan Deductions", render: (row) => formatCurrency(Number(row.loan_deductions || 0)) },
            { key: "net_payable", label: "Net Payout", render: (row) => formatCurrency(Number(row.net_payable || 0)) },
          ]}
          rows={rows}
          renderActions={(row) => <Button variant="ghost" onClick={() => (window.location.hash = `#/payouts/statement?member=${row.member}&season=${row.season}`)}>Statement</Button>}
        />
      </article>
    </div>
  );
}
