import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../utils/formatters";

export function LoanDetailPage() {
  return (
    <section className="profile-header panel">
      <div>
        <span className="eyebrow">Loan request</span>
        <h2>Farm input loan</h2>
        <p>Mary Wanjiku · {formatCurrency(18000)} · Deduct at payout</p>
        <Badge tone="warning">Pending</Badge>
      </div>
      <Button>Approve Loan</Button>
    </section>
  );
}

