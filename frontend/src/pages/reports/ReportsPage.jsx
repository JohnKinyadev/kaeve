import { BarChart3 } from "lucide-react";

import { ExportButton } from "../../components/shared/ExportButton";
import { downloadCsv } from "../../utils/downloads";

function downloadReport(report) {
  const slug = report.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadCsv(`${slug}-report.csv`, [{ report, generated_at: new Date().toISOString() }], [
    { label: "Report", key: "report" },
    { label: "Generated At", key: "generated_at" },
  ]);
}

export function ReportsPage() {
  return (
    <div className="report-grid">
      {["Members register", "Season deliveries", "Loan deductions", "Payout schedule"].map((report) => (
        <article className="panel report-card" key={report}>
          <BarChart3 size={24} />
          <h2>{report}</h2>
          <p>Generate and export operational records for audit and management review.</p>
          <ExportButton onClick={() => downloadReport(report)}>Download</ExportButton>
        </article>
      ))}
    </div>
  );
}
