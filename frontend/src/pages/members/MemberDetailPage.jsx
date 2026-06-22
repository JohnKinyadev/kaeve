import { Edit } from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";
import { getResults } from "../../utils/helpers";

function currentMemberId() {
  return window.location.hash.replace("#/members/", "");
}

export function MemberDetailPage() {
  const { role } = useAuth();
  const memberId = currentMemberId();
  const member = useApiResource(`/api/members/${memberId}/`);
  const deliveries = useApiResource(`/api/deliveries/?member=${memberId}`);
  const loans = useApiResource(`/api/loans/?member=${memberId}`);
  const payouts = useApiResource(`/api/payouts/?member=${memberId}`);
  const memberData = member.data || {};
  const financeRows = [
    ...getResults(loans.data).map((loan) => ({
      id: `loan-${loan.id}`,
      type: loan.reason || "Loan",
      amount: formatCurrency(Number(loan.amount || 0)),
      status: loan.status_display || loan.status,
    })),
    ...getResults(payouts.data).map((payout) => ({
      id: `payout-${payout.id}`,
      type: payout.season_name || "Payout",
      amount: formatCurrency(Number(payout.net_payable || 0)),
      status: "Generated",
    })),
  ];

  return (
    <div className="page-stack">
      {(member.error || deliveries.error || loans.error || payouts.error) && (
        <div className="form-error">{member.error || deliveries.error || loans.error || payouts.error}</div>
      )}

      <section className="profile-header panel">
        <div>
          <span className="eyebrow">{memberData.membership_number || "Member"}</span>
          <h2>{memberData.full_name || "Loading member..."}</h2>
          <p>
            {memberData.phone_number || "No phone"} | {memberData.location || "No location"} |{" "}
            {memberData.farm_size_acres || 0} acres
          </p>
          <Badge tone={memberData.status === "active" ? "success" : "neutral"}>
            {memberData.status || "loading"}
          </Badge>
        </div>
        {role === ROLES.ADMIN && (
          <Button>
            <Edit size={16} /> Edit Profile
          </Button>
        )}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Deliveries</h2>
            <span>Member records</span>
          </div>
          <Table
            columns={[
              { key: "delivery_date", label: "Date", render: (row) => formatDate(row.delivery_date) },
              { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
              { key: "grade_display", label: "Grade" },
            ]}
            rows={getResults(deliveries.data)}
          />
        </article>
        <article className="panel">
          <div className="panel-header">
            <h2>Loans & Payouts</h2>
            <span>Member records</span>
          </div>
          <Table
            columns={[
              { key: "type", label: "Type" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
            ]}
            rows={financeRows}
          />
        </article>
      </section>
    </div>
  );
}
