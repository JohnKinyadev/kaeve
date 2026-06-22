import { CheckCircle2 } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { ExportButton } from "../../components/shared/ExportButton";
import { formatCurrency } from "../../utils/formatters";

const payouts = [
  { id: 1, member: "Mary Wanjiku", kg: "1,430 kg", gross: formatCurrency(143000), deductions: formatCurrency(18000), net: formatCurrency(125000) },
  { id: 2, member: "Peter Kamau", kg: "1,020 kg", gross: formatCurrency(102000), deductions: formatCurrency(12000), net: formatCurrency(90000) },
];

export function PayoutsPage() {
  return (
    <div className="page-stack">
      <section className="toolbar">
        <Button>Trigger Calculation</Button>
        <ExportButton>Export M-Pesa Excel</ExportButton>
        <Button variant="secondary"><CheckCircle2 size={16} /> Mark All Processed</Button>
      </section>
      <article className="panel">
        <Table columns={[{ key: "member", label: "Member" }, { key: "kg", label: "Kg Delivered" }, { key: "gross", label: "Gross" }, { key: "deductions", label: "Deductions" }, { key: "net", label: "Net Payout" }]} rows={payouts} renderActions={() => <Button variant="ghost">PDF</Button>} />
      </article>
    </div>
  );
}

