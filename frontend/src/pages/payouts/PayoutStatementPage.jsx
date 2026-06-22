import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../utils/formatters";

export function PayoutStatementPage() {
  return (
    <article className="panel statement">
      <h2>Payout Statement</h2>
      <p>Mary Wanjiku · Main Crop 2026</p>
      <dl>
        <div><dt>Total cherry</dt><dd>1,430 kg</dd></div>
        <div><dt>Gross amount</dt><dd>{formatCurrency(143000)}</dd></div>
        <div><dt>Deductions</dt><dd>{formatCurrency(18000)}</dd></div>
        <div><dt>Net payout</dt><dd>{formatCurrency(125000)}</dd></div>
      </dl>
      <Button>Download PDF</Button>
    </article>
  );
}

