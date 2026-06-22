import { Banknote, ClipboardPlus, LineChart, Scale, Users, WalletCards } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { dashboardAPI } from "../../api/dashboardAPI";
import { useApiResource } from "../../hooks/useApiResource";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";
import { getResults } from "../../utils/helpers";

export function DashboardPage() {
  const summary = useApiResource("/api/dashboard-summary/");
  const recent = useApiResource("/api/deliveries/?ordering=-delivery_date&page=1");
  const summaryData = summary.data || {};
  const recentDeliveries = getResults(recent.data).slice(0, 6);
  const trend = recentDeliveries
    .slice()
    .reverse()
    .map((item) => ({
      day: formatDate(item.delivery_date).split(" ").slice(0, 2).join(" "),
      kg: Number(item.weight_kg || 0),
    }));
  const maxKg = Math.max(...trend.map((item) => item.kg));

  return (
    <div className="page-stack">
      {(summary.error || recent.error) && <div className="form-error">{summary.error || recent.error}</div>}
      <section className="stat-grid">
        <StatCard icon={Users} label="Total Members" value={summary.isLoading ? "..." : summaryData.members_count || 0} detail={summaryData.active_season || "No active season"} />
        <StatCard icon={Scale} label="Season Cherry" value={summary.isLoading ? "..." : formatKg(Number(summaryData.season_cherry_kg || 0))} detail={`Today: ${formatKg(Number(summaryData.today_cherry_kg || 0))}`} />
        <StatCard icon={Banknote} label="Pending Loans" value={summary.isLoading ? "..." : summaryData.pending_loans || 0} detail={formatCurrency(Number(summaryData.approved_loan_total || 0))} />
        <StatCard icon={WalletCards} label="Deliveries" value={summary.isLoading ? "..." : summaryData.deliveries_count || 0} detail="Active season records" />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Delivery Trend</h2>
              <span>Daily cherry intake this season</span>
            </div>
            <LineChart size={22} />
          </div>
          <div className="bar-chart" aria-label="Delivery trend">
            {trend.length === 0 && <div className="empty-chart">No delivery data yet</div>}
            {trend.map((item, index) => (
              <div className="bar-column" key={item.day}>
                <span style={{ height: `${maxKg ? (item.kg / maxKg) * 100 : 0}%` }} />
                <small>{item.day}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel action-panel">
          <div className="panel-header">
            <div>
              <h2>Quick Actions</h2>
              <span>Common daily tasks</span>
            </div>
            <ClipboardPlus size={22} />
          </div>
          <Button onClick={() => (window.location.hash = "#/deliveries/log")}>Log Delivery</Button>
          <Button variant="secondary" onClick={() => (window.location.hash = "#/members/new")}>Register Member</Button>
          <Button variant="secondary" onClick={() => (window.location.hash = "#/seasons")}>View Season</Button>
        </article>
      </section>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Deliveries</h2>
            <span>Latest collection records</span>
          </div>
        </div>
        <Table
          columns={[
            { key: "member_name", label: "Member" },
            { key: "collection_point_name", label: "Collection Point" },
            { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
            { key: "delivery_date", label: "Date", render: (row) => formatDate(row.delivery_date) },
          ]}
          rows={recentDeliveries}
        />
      </article>
    </div>
  );
}
