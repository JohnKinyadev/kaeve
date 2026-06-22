import { useEffect, useMemo, useState } from "react";
import { Banknote, Download, Scale, WalletCards } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { apiClient } from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";

function listResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function MemberPortalPage() {
  const { user, logout } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState("");
  const member = user?.member;

  useEffect(() => {
    let isMounted = true;

    async function loadPortalData() {
      if (!member) return;

      try {
        const [deliveryResponse, loanResponse, payoutResponse] = await Promise.all([
          apiClient.get("/api/deliveries/"),
          apiClient.get("/api/loans/"),
          apiClient.get("/api/payouts/"),
        ]);

        if (!isMounted) return;
        setDeliveries(listResults(deliveryResponse));
        setLoans(listResults(loanResponse));
        setPayouts(listResults(payoutResponse));
      } catch (err) {
        if (isMounted) setError(err.message || "Unable to load member records");
      }
    }

    loadPortalData();
    return () => {
      isMounted = false;
    };
  }, [member]);

  const totalKg = useMemo(
    () => deliveries.reduce((sum, delivery) => sum + Number(delivery.weight_kg || 0), 0),
    [deliveries],
  );
  const lastDelivery = deliveries[0]?.delivery_date || deliveries[0]?.created_at;
  const activeLoan = loans[0];
  const latestPayout = payouts[0];

  return (
    <main className="portal-screen">
      <section className="portal-header">
        <div>
          <span className="eyebrow">Member Portal</span>
          <h1>Welcome, {member?.full_name || user?.name}</h1>
        </div>
        <Button variant="secondary" onClick={logout}>Logout</Button>
      </section>

      {!member && (
        <article className="panel empty-state">
          <h2>Member profile not linked</h2>
          <p>Your account exists, but it is not linked to a cooperative member profile yet.</p>
        </article>
      )}

      {error && <div className="form-error">{error}</div>}

      <section className="stat-grid">
        <StatCard
          icon={Scale}
          label="Season Deliveries"
          value={formatKg(totalKg)}
          detail={lastDelivery ? `Last delivery: ${formatDate(lastDelivery)}` : "No deliveries recorded"}
        />
        <StatCard
          icon={Banknote}
          label="Loan Status"
          value={activeLoan?.status_display || activeLoan?.status || "No active loan"}
          detail={activeLoan ? formatCurrency(Number(activeLoan.amount || 0)) : "No deductions pending"}
        />
        <StatCard
          icon={WalletCards}
          label="Latest Payout"
          value={latestPayout ? formatCurrency(Number(latestPayout.net_payable || 0)) : formatCurrency(0)}
          detail={latestPayout?.season_name || "No payout generated"}
        />
      </section>
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Deliveries</h2>
            <span>{member?.membership_number || "Member records"}</span>
          </div>
          <Button disabled={!latestPayout}><Download size={16} /> Download</Button>
        </div>
        <Table
          columns={[
            { key: "delivery_date", label: "Date", render: (row) => formatDate(row.delivery_date) },
            { key: "collection_point_name", label: "Collection Point" },
            { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
            { key: "grade_display", label: "Grade" },
          ]}
          rows={deliveries.slice(0, 5)}
        />
      </article>
    </main>
  );
}
