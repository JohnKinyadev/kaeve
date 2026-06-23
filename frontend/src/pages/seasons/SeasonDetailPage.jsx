import { useState } from "react";
import { Factory, Scale, Users } from "lucide-react";

import { apiClient } from "../../api/axiosInstance";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { formatDate, formatKg } from "../../utils/formatters";

function seasonIdFromHash() {
  return window.location.hash.replace("#/seasons/", "");
}

export function SeasonDetailPage() {
  const seasonId = seasonIdFromHash();
  const season = useApiResource(`/api/seasons/${seasonId}/`);
  const report = useApiResource(`/api/seasons/${seasonId}/intake-report/`);
  const [isClosing, setIsClosing] = useState(false);
  const [message, setMessage] = useState("");
  const data = season.data || {};
  const topMembers = report.data?.top_members || [];
  const collectionPoints = report.data?.collection_points || [];
  const totalCherry = collectionPoints.reduce((sum, point) => sum + Number(point.total_kg || 0), 0);

  async function closeSeason() {
    setMessage("");
    try {
      await apiClient.patch(`/api/seasons/${seasonId}/`, { is_active: false, is_closed: true });
      await season.reload();
      setIsClosing(false);
      setMessage("Season closed.");
    } catch (err) {
      setMessage(err.message || "Unable to close season.");
    }
  }

  return (
    <div className="page-stack">
      {(season.error || report.error) && <div className="form-error">{season.error || report.error}</div>}
      {message && <div className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</div>}
      <section className="profile-header panel">
        <div>
          <span className="eyebrow">{data.is_closed ? "Closed season" : data.is_active ? "Open season" : "Inactive season"}</span>
          <h2>{data.name || "Loading season..."}</h2>
          <p>{formatDate(data.start_date)} | {formatDate(data.end_date)} | {data.season_type_display || data.season_type}</p>
        </div>
        {!data.is_closed && <Button variant="danger" onClick={() => setIsClosing(true)}>Close Season</Button>}
      </section>
      <section className="stat-grid">
        <StatCard icon={Scale} label="Total Cherry" value={formatKg(totalCherry)} />
        <StatCard icon={Users} label="Active Members" value={topMembers.length} />
        <StatCard icon={Factory} label="Collection Points" value={collectionPoints.length} />
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-header"><h2>Collection Points</h2><span>Season intake</span></div>
          <Table
            columns={[
              { key: "collection_point__name", label: "Collection Point" },
              { key: "total_kg", label: "Total", render: (row) => formatKg(Number(row.total_kg || 0)) },
              { key: "deliveries_count", label: "Deliveries" },
            ]}
            rows={collectionPoints.map((row, index) => ({ id: index, ...row }))}
          />
        </article>
        <article className="panel">
          <div className="panel-header"><h2>Top Members</h2><span>By delivered kg</span></div>
          <Table
            columns={[
              { key: "member__membership_number", label: "No." },
              { key: "member__full_name", label: "Member" },
              { key: "total_kg", label: "Total", render: (row) => formatKg(Number(row.total_kg || 0)) },
            ]}
            rows={topMembers.map((row, index) => ({ id: index, ...row }))}
          />
        </article>
      </section>
      {isClosing && (
        <Modal title="Close season?" confirmLabel="Close Season" onClose={() => setIsClosing(false)} onConfirm={closeSeason}>
          <p>Closing this season will lock it for final payout processing.</p>
        </Modal>
      )}
    </div>
  );
}
