import { useEffect, useMemo, useState } from "react";
import { Banknote, Download, Scale, WalletCards } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { authAPI } from "../../api/authAPI";
import { apiClient } from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";

function listResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function MemberPortalPage() {
  const { user, logout, refreshUser } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    national_id: "",
    phone_number: "",
    farm_size_acres: "",
    location: "",
  });
  const [profileError, setProfileError] = useState("");
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const member = user?.member;

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setIsCompletingProfile(true);

    try {
      await authAPI.completeMemberProfile(profileForm);
      await refreshUser();
    } catch (err) {
      setProfileError(err.message || "Unable to complete member profile");
    } finally {
      setIsCompletingProfile(false);
    }
  }

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
    <main className="portal-screen role-member">
      <section className="portal-header">
        <div>
          <span className="eyebrow">Member Portal</span>
          <h1>Welcome, {member?.full_name || user?.name}</h1>
        </div>
        <Button variant="secondary" onClick={logout}>Logout</Button>
      </section>

      {!member && (
        <article className="panel form-panel member-completion-panel">
          <div className="panel-header">
            <div>
              <h2>Finish member registration</h2>
              <span>Add your cooperative profile details to unlock your member dashboard.</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <Input
              label="Full name"
              value={profileForm.full_name}
              onChange={(event) => setProfileForm((value) => ({ ...value, full_name: event.target.value }))}
              required
            />
            <Input
              label="National ID"
              value={profileForm.national_id}
              onChange={(event) => setProfileForm((value) => ({ ...value, national_id: event.target.value }))}
              required
            />
            <Input
              label="Phone number"
              value={profileForm.phone_number}
              onChange={(event) => setProfileForm((value) => ({ ...value, phone_number: event.target.value }))}
            />
            <Input
              label="Farm size acres"
              type="number"
              step="0.01"
              value={profileForm.farm_size_acres}
              onChange={(event) => setProfileForm((value) => ({ ...value, farm_size_acres: event.target.value }))}
              required
            />
            <Input
              label="Location"
              value={profileForm.location}
              onChange={(event) => setProfileForm((value) => ({ ...value, location: event.target.value }))}
              required
            />
            {profileError && <div className="form-error">{profileError}</div>}
            <div className="form-actions">
              <Button type="submit" disabled={isCompletingProfile}>
                {isCompletingProfile ? "Saving profile..." : "Complete registration"}
              </Button>
            </div>
          </form>
        </article>
      )}

      {error && <div className="form-error">{error}</div>}

      {member && (
        <>
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
                <span>{member.membership_number || "Member records"}</span>
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
        </>
      )}
    </main>
  );
}
