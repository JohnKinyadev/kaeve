import { BarChart3 } from "lucide-react";

import { ExportButton } from "../../components/shared/ExportButton";

export function ReportsPage() {
  return (
    <div className="report-grid">
      {["Members register", "Season deliveries", "Loan deductions", "Payout schedule"].map((report) => (
        <article className="panel report-card" key={report}>
          <BarChart3 size={24} />
          <h2>{report}</h2>
          <p>Generate and export operational records for audit and management review.</p>
          <ExportButton>Download</ExportButton>
        </article>
      ))}
    </div>
  );
}

