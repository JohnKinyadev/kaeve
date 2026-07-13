import { useEffect, useMemo, useState } from "react";
import { Factory } from "lucide-react";

import { apiClient } from "../../api/axiosInstance";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { formatKg } from "../../utils/formatters";
import { getResults } from "../../utils/helpers";

const emptyForm = {
  id: null,
  season: "",
  batch_number: "",
  cherry_in_kg: "",
  parchment_out_kg: "",
  green_bean_out_kg: "",
  milled_on: new Date().toISOString().slice(0, 10),
  notes: "",
};

function mergeBatchIntoData(data, batch) {
  if (!batch) return data;
  const rows = getResults(data);
  const nextRows = [batch, ...rows.filter((row) => row.id !== batch.id)];
  if (Array.isArray(data)) return nextRows;
  return {
    ...(data || {}),
    count: data?.count ?? nextRows.length,
    results: nextRows,
  };
}

export function MillingPage() {
  const batches = useApiResource("/api/milling-batches/?ordering=-milled_on");
  const seasons = useApiResource("/api/seasons/?is_active=true&is_closed=false");
  const [form, setForm] = useState(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const rows = getResults(batches.data);
  const totals = useMemo(
    () => ({
      cherry: rows.reduce((sum, row) => sum + Number(row.cherry_in_kg || 0), 0),
      green: rows.reduce((sum, row) => sum + Number(row.green_bean_out_kg || 0), 0),
    }),
    [rows],
  );
  const outturn = totals.cherry ? ((totals.green / totals.cherry) * 100).toFixed(2) : "0.00";

  useEffect(() => {
    const activeSeason = getResults(seasons.data)[0];
    if (!form.season && activeSeason?.id) {
      setForm((current) => ({ ...current, season: String(activeSeason.id) }));
    }
  }, [form.season, seasons.data]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editBatch(batch) {
    setForm({
      id: batch.id,
      season: batch.season,
      batch_number: batch.batch_number,
      cherry_in_kg: batch.cherry_in_kg,
      parchment_out_kg: batch.parchment_out_kg,
      green_bean_out_kg: batch.green_bean_out_kg,
      milled_on: batch.milled_on,
      notes: batch.notes || "",
    });
    setIsFormOpen(true);
  }

  async function saveBatch(event) {
    event.preventDefault();
    setMessage("");
    const payload = { ...form };
    delete payload.id;

    try {
      let savedBatch;
      if (form.id) {
        savedBatch = await apiClient.patch(`/api/milling-batches/${form.id}/`, payload);
      } else {
        savedBatch = await apiClient.post("/api/milling-batches/", payload);
      }
      batches.setData((current) => mergeBatchIntoData(current, savedBatch));
      setForm(emptyForm);
      setIsFormOpen(false);
      await batches.reload();
      setMessage("Milling batch saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save milling batch.");
    }
  }

  return (
    <div className="page-stack">
      {(batches.error || seasons.error) && <div className="form-error">{batches.error || seasons.error}</div>}
      {message && <div className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</div>}
      <section className="stat-grid">
        <StatCard icon={Factory} label="Batches" value={rows.length} />
        <StatCard icon={Factory} label="Cherry In" value={formatKg(totals.cherry)} />
        <StatCard icon={Factory} label="Green Beans" value={formatKg(totals.green)} detail={`${outturn}% outturn`} />
      </section>
      <section className="toolbar">
        <Button onClick={() => { setForm(emptyForm); setIsFormOpen((value) => !value); }}>Record Milling</Button>
      </section>
      {isFormOpen && (
        <article className="panel form-panel">
          <div className="panel-header"><h2>{form.id ? "Edit Milling Batch" : "Record Milling Batch"}</h2><span>Outputs update inventory automatically</span></div>
          <form className="form-grid" onSubmit={saveBatch}>
            <label className="field">
              <span>Season</span>
              <select value={form.season} onChange={(event) => updateForm("season", event.target.value)} required>
                <option value="">Select season</option>
                {getResults(seasons.data).map((season) => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
            </label>
            <Input label="Batch number" value={form.batch_number} onChange={(event) => updateForm("batch_number", event.target.value)} required />
            <Input label="Cherry in kg" type="number" step="0.01" value={form.cherry_in_kg} onChange={(event) => updateForm("cherry_in_kg", event.target.value)} required />
            <Input label="Parchment out kg" type="number" step="0.01" value={form.parchment_out_kg} onChange={(event) => updateForm("parchment_out_kg", event.target.value)} />
            <Input label="Green bean out kg" type="number" step="0.01" value={form.green_bean_out_kg} onChange={(event) => updateForm("green_bean_out_kg", event.target.value)} />
            <Input label="Milled on" type="date" value={form.milled_on} onChange={(event) => updateForm("milled_on", event.target.value)} />
            <Input label="Notes" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit">Save Batch</Button>
            </div>
          </form>
        </article>
      )}
      <article className="panel">
        <Table
          columns={[
            { key: "batch_number", label: "Batch" },
            { key: "season_name", label: "Season" },
            { key: "cherry_in_kg", label: "Cherry", render: (row) => formatKg(Number(row.cherry_in_kg || 0)) },
            { key: "green_bean_out_kg", label: "Green Beans", render: (row) => formatKg(Number(row.green_bean_out_kg || 0)) },
            { key: "outturn_ratio", label: "Outturn", render: (row) => `${row.outturn_ratio}%` },
          ]}
          rows={rows}
          renderActions={(row) => <Button variant="ghost" onClick={() => editBatch(row)}>Edit</Button>}
        />
      </article>
    </div>
  );
}
