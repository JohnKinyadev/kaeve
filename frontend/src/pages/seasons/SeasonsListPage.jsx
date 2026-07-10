import { useState } from "react";

import { apiClient } from "../../api/axiosInstance";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getResults } from "../../utils/helpers";

const emptyForm = {
  id: null,
  name: "",
  season_type: "main_crop",
  start_date: "",
  end_date: "",
  payout_rate_per_kg: "0.00",
  is_active: true,
};

export function SeasonsListPage() {
  const { role } = useAuth();
  const seasons = useApiResource("/api/seasons/?ordering=-start_date");
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState("");
  const canDelete = role === ROLES.ADMIN;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editSeason(season) {
    setForm({
      id: season.id,
      name: season.name,
      season_type: season.season_type,
      start_date: season.start_date || "",
      end_date: season.end_date || "",
      payout_rate_per_kg: season.payout_rate_per_kg || "0.00",
      is_active: season.is_active,
    });
    setIsFormOpen(true);
  }

  async function saveSeason(event) {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      end_date: form.end_date || null,
    };
    delete payload.id;

    try {
      if (form.id) {
        await apiClient.patch(`/api/seasons/${form.id}/`, payload);
      } else {
        await apiClient.post("/api/seasons/", payload);
      }
      setForm(emptyForm);
      setIsFormOpen(false);
      await seasons.reload();
      setMessage("Season saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save season.");
    }
  }

  async function deleteSeason() {
    if (!deleteTarget) return;
    setMessage("");
    try {
      await apiClient.delete(`/api/seasons/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await seasons.reload();
      setMessage("Season deleted.");
    } catch (err) {
      setMessage(err.message || "Unable to delete season. It may already have deliveries, loans, milling, or payouts attached.");
    }
  }

  return (
    <div className="page-stack">
      {seasons.error && <div className="form-error">{seasons.error}</div>}
      {message && <div className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</div>}
      <section className="toolbar">
        <Button onClick={() => { setForm(emptyForm); setIsFormOpen((value) => !value); }}>
          Register Season
        </Button>
      </section>

      {isFormOpen && (
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <h2>{form.id ? "Edit Season" : "Register Season"}</h2>
              <span>Manage crop period and active status</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={saveSeason}>
            <Input label="Season name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
            <label className="field">
              <span>Season type</span>
              <select value={form.season_type} onChange={(event) => updateForm("season_type", event.target.value)}>
                <option value="main_crop">Main Crop</option>
                <option value="fly_crop">Fly Crop</option>
              </select>
            </label>
            <Input label="Start date" type="date" value={form.start_date} onChange={(event) => updateForm("start_date", event.target.value)} required />
            <Input label="End date" type="date" value={form.end_date || ""} onChange={(event) => updateForm("end_date", event.target.value)} />
            <Input label="Payout rate per kg" type="number" min="0" step="0.01" value={form.payout_rate_per_kg} onChange={(event) => updateForm("payout_rate_per_kg", event.target.value)} required />
            <label className="check-row">
              <input type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} />
              Active season
            </label>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit">Save Season</Button>
            </div>
          </form>
        </article>
      )}

      <article className="panel">
        <Table
          columns={[
            { key: "name", label: "Season" },
            { key: "start_date", label: "Start", render: (row) => formatDate(row.start_date) },
            { key: "end_date", label: "End", render: (row) => formatDate(row.end_date) },
            { key: "season_type_display", label: "Type" },
            { key: "payout_rate_per_kg", label: "Payout Rate", render: (row) => `${formatCurrency(Number(row.payout_rate_per_kg || 0))}/kg` },
            { key: "status", label: "Status", render: (row) => <Badge tone={!row.is_closed && row.is_active ? "success" : "neutral"}>{row.is_closed ? "Closed" : row.is_active ? "Open" : "Inactive"}</Badge> },
          ]}
          rows={getResults(seasons.data)}
          renderActions={(row) => (
            <>
              <Button variant="ghost" onClick={() => (window.location.hash = `#/seasons/${row.id}`)}>Open</Button>
              <Button variant="ghost" onClick={() => editSeason(row)}>Edit</Button>
              {canDelete && <Button variant="danger" onClick={() => setDeleteTarget(row)}>Delete</Button>}
            </>
          )}
        />
      </article>
      {deleteTarget && (
        <Modal title="Delete season?" confirmLabel="Delete" onClose={() => setDeleteTarget(null)} onConfirm={deleteSeason}>
          <p>Delete {deleteTarget.name}? This only works if no records are attached to the season.</p>
        </Modal>
      )}
    </div>
  );
}
