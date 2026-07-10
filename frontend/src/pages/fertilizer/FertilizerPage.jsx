import { useEffect, useState } from "react";
import { Check, Package, X } from "lucide-react";

import { fertilizerAPI } from "../../api/fertilizerAPI";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { formatDate, formatKg } from "../../utils/formatters";

function listResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

const emptyInventoryForm = {
  id: null,
  name: "Factory fertilizer stock",
  fertilizer_type: "NPK fertilizer",
  quantity_kg: "",
  member_cap_kg: "",
  is_active: true,
};

function statusTone(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export function FertilizerPage() {
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(emptyInventoryForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    Promise.all([fertilizerAPI.inventory(), fertilizerAPI.requests()])
      .then(([inventoryResponse, requestResponse]) => {
        if (!isMounted) return;
        const inventoryRows = listResults(inventoryResponse);
        setInventory(inventoryRows);
        setRequests(listResults(requestResponse));

        const activeInventory = inventoryRows.find((item) => item.is_active) || inventoryRows[0];
        if (activeInventory) {
          setForm({
            id: activeInventory.id,
            name: activeInventory.name || "",
            fertilizer_type: activeInventory.fertilizer_type || "",
            quantity_kg: activeInventory.quantity_kg || "",
            member_cap_kg: activeInventory.member_cap_kg || "",
            is_active: activeInventory.is_active,
          });
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Unable to load fertilizer records");
      });
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editInventory(item) {
    setForm({
      id: item.id,
      name: item.name || "",
      fertilizer_type: item.fertilizer_type || "",
      quantity_kg: item.quantity_kg || "",
      member_cap_kg: item.member_cap_kg || "",
      is_active: item.is_active,
    });
  }

  async function handleInventorySubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const payload = {
        name: form.name,
        fertilizer_type: form.fertilizer_type,
        quantity_kg: form.quantity_kg,
        member_cap_kg: form.member_cap_kg,
        is_active: form.is_active,
      };
      if (form.id) {
        await fertilizerAPI.updateInventory(form.id, payload);
      } else {
        await fertilizerAPI.createInventory(payload);
      }
      setMessage("Fertilizer inventory saved.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Unable to save fertilizer inventory");
    } finally {
      setIsSaving(false);
    }
  }

  async function reviewRequest(id, action) {
    setError("");
    setMessage("");
    try {
      if (action === "approve") {
        await fertilizerAPI.approve(id);
        setMessage("Fertilizer request approved and stock updated.");
      } else if (action === "reject") {
        await fertilizerAPI.reject(id);
        setMessage("Fertilizer request rejected.");
      } else {
        await fertilizerAPI.reopen(id);
        setMessage("Fertilizer request reopened for correction.");
      }
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Unable to review fertilizer request");
    }
  }

  return (
    <div className="page-stack">
      <article className="panel form-panel">
        <div className="panel-header">
          <div>
            <h2>Fertilizer inventory</h2>
            <span>Set factory stock and the maximum kg one member can request for each fertilizer.</span>
          </div>
          <Package size={22} />
        </div>
        <form className="form-grid" onSubmit={handleInventorySubmit}>
          <Input label="Inventory name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
          <Input label="Fertilizer type" value={form.fertilizer_type} onChange={(event) => updateForm("fertilizer_type", event.target.value)} required />
          <Input label="Available stock kg" type="number" min="0" step="0.01" value={form.quantity_kg} onChange={(event) => updateForm("quantity_kg", event.target.value)} required />
          <Input label="Member cap kg" type="number" min="0.01" step="0.01" value={form.member_cap_kg} onChange={(event) => updateForm("member_cap_kg", event.target.value)} required />
          <label className="check-row field-wide">
            <input checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} type="checkbox" />
            <span>Make this fertilizer stock active for member applications</span>
          </label>
          {error && <div className="form-error field-wide">{error}</div>}
          {message && <div className="form-success field-wide">{message}</div>}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setForm(emptyInventoryForm)}>Add fertilizer type</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save inventory"}</Button>
          </div>
        </form>
      </article>

      <section className="stat-grid">
        {inventory.map((item) => (
          <article className="stat-card" key={item.id}>
            <span>{item.fertilizer_type}</span>
            <strong>{formatKg(Number(item.quantity_kg || 0))}</strong>
            <small>Cap per member: {formatKg(Number(item.member_cap_kg || 0))}</small>
            <Button variant="ghost" onClick={() => editInventory(item)}>Edit</Button>
          </article>
        ))}
      </section>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Member fertilizer requests</h2>
            <span>Approve requests only when stock is available.</span>
          </div>
        </div>
        <Table
          columns={[
            { key: "member_name", label: "Member", render: (row) => `${row.membership_number} - ${row.member_name}` },
            { key: "fertilizer_type", label: "Type" },
            { key: "requested_kg", label: "Requested", render: (row) => formatKg(Number(row.requested_kg || 0)) },
            { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status_display || row.status}</Badge> },
            { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) },
          ]}
          rows={requests}
          renderActions={(row) => (
            <div className="row-actions">
              <Button variant="secondary" disabled={row.status !== "pending"} onClick={() => reviewRequest(row.id, "approve")}>
                <Check size={16} /> Approve
              </Button>
              <Button variant="danger" disabled={row.status !== "pending"} onClick={() => reviewRequest(row.id, "reject")}>
                <X size={16} /> Reject
              </Button>
              <Button variant="ghost" disabled={row.status === "pending"} onClick={() => reviewRequest(row.id, "reopen")}>
                Edit
              </Button>
            </div>
          )}
        />
      </article>
    </div>
  );
}
