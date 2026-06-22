import { useMemo, useState } from "react";

import { apiClient } from "../../api/axiosInstance";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useApiResource } from "../../hooks/useApiResource";
import { getResults } from "../../utils/helpers";

export function LogDeliveryPage() {
  const members = useApiResource("/api/members/");
  const seasons = useApiResource("/api/seasons/?is_active=true&is_closed=false");
  const points = useApiResource("/api/active-collection-points/");
  const activeSeason = getResults(seasons.data)[0];
  const [form, setForm] = useState({
    member: "",
    season: "",
    collection_point: "",
    weight_kg: "",
    grade: "a",
    delivery_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const collectionPoints = getResults(points.data);
  const selectedSeason = form.season || activeSeason?.id || "";

  const memberOptions = useMemo(() => getResults(members.data), [members.data]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiClient.post("/api/deliveries/", {
        ...form,
        season: selectedSeason,
      });
      setMessage("Delivery recorded successfully.");
      window.setTimeout(() => {
        window.location.hash = "#/deliveries";
      }, 700);
    } catch (err) {
      setError(err.message || "Unable to log delivery");
    }
  }

  return (
    <article className="panel form-panel">
      <div className="panel-header">
        <div>
          <h2>Log Delivery</h2>
          <span>Record cherry intake for the active season</span>
        </div>
      </div>
      {(error || members.error || seasons.error || points.error) && (
        <div className="form-error">{error || members.error || seasons.error || points.error}</div>
      )}
      {message && <div className="form-success">{message}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Member</span>
          <select value={form.member} onChange={(event) => updateField("member", event.target.value)} required>
            <option value="">Select member</option>
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.membership_number} - {member.full_name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Weight (kg)" type="number" step="0.01" value={form.weight_kg} onChange={(event) => updateField("weight_kg", event.target.value)} required />
        <label className="field">
          <span>Grade</span>
          <select value={form.grade} onChange={(event) => updateField("grade", event.target.value)}>
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="pb">PB</option>
            <option value="ungraded">Ungraded</option>
          </select>
        </label>
        <label className="field">
          <span>Collection point</span>
          <select value={form.collection_point} onChange={(event) => updateField("collection_point", event.target.value)} required>
            <option value="">Select collection point</option>
            {collectionPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Season</span>
          <select value={selectedSeason} onChange={(event) => updateField("season", event.target.value)} required>
            <option value="">Select season</option>
            {getResults(seasons.data).map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Date" type="date" value={form.delivery_date} onChange={(event) => updateField("delivery_date", event.target.value)} />
        <Input label="Notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
        <div className="form-actions">
          <Button variant="secondary" onClick={() => (window.location.hash = "#/deliveries")}>Cancel</Button>
          <Button type="submit">Submit Delivery</Button>
        </div>
      </form>
    </article>
  );
}
