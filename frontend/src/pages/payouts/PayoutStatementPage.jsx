import { useEffect, useMemo, useState } from "react";

import { payoutsAPI } from "../../api/payoutsAPI";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";
import { downloadTextFile } from "../../utils/downloads";

function getStatementParams() {
  const query = window.location.hash.split("?")[1] || "";
  const params = new URLSearchParams(query);
  return {
    memberId: params.get("member"),
    seasonId: params.get("season"),
  };
}

function statementHtml(statement) {
  const member = statement.member || {};
  const season = statement.season || {};
  const totals = statement.totals || {};
  const payout = statement.payout || {};

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payout Statement - ${member.full_name || "Member"}</title>
    <style>
      body { color: #111827; font-family: Arial, sans-serif; padding: 32px; }
      h1 { color: #14532d; margin-bottom: 4px; }
      table { border-collapse: collapse; margin-top: 20px; width: 100%; }
      td, th { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
      .summary { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; }
    </style>
  </head>
  <body>
    <h1>Kaeve Coffee Cooperative</h1>
    <p>${member.membership_number || ""} - ${member.full_name || ""}</p>
    <p>${season.name || ""}</p>
    <div class="summary">
      <p><strong>Total cherry:</strong> ${formatKg(Number(totals.delivered_kg || 0))}</p>
      <p><strong>Gross amount:</strong> ${formatCurrency(Number(payout.gross_share || 0))}</p>
      <p><strong>Loan deductions:</strong> ${formatCurrency(Number(payout.loan_deductions || totals.approved_loans || 0))}</p>
      <p><strong>Other deductions:</strong> ${formatCurrency(Number(payout.other_deductions || 0))}</p>
      <p><strong>Net payout:</strong> ${formatCurrency(Number(totals.net_payable || payout.net_payable || 0))}</p>
    </div>
  </body>
</html>`;
}

export function PayoutStatementPage() {
  const [{ memberId, seasonId }] = useState(getStatementParams);
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!memberId || !seasonId) {
      setError("Statement link is missing member or season details.");
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    payoutsAPI.statement(memberId, seasonId)
      .then((data) => {
        if (isMounted) setStatement(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Unable to load payout statement.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [memberId, seasonId]);

  const filename = useMemo(() => {
    const memberNo = statement?.member?.membership_number || memberId || "member";
    const seasonName = String(statement?.season?.name || seasonId || "season").replace(/\s+/g, "-").toLowerCase();
    return `payout-statement-${memberNo}-${seasonName}.html`;
  }, [memberId, seasonId, statement]);

  if (isLoading) {
    return <article className="panel statement"><h2>Payout Statement</h2><p>Loading statement...</p></article>;
  }

  if (error) {
    return <article className="panel statement"><h2>Payout Statement</h2><div className="form-error">{error}</div></article>;
  }

  const member = statement.member || {};
  const season = statement.season || {};
  const totals = statement.totals || {};
  const payout = statement.payout || {};

  return (
    <article className="panel statement">
      <h2>Payout Statement</h2>
      <p>{member.full_name} - {season.name}</p>
      <dl>
        <div><dt>Total cherry</dt><dd>{formatKg(Number(totals.delivered_kg || 0))}</dd></div>
        <div><dt>Gross amount</dt><dd>{formatCurrency(Number(payout.gross_share || 0))}</dd></div>
        <div><dt>Loan deductions</dt><dd>{formatCurrency(Number(payout.loan_deductions || totals.approved_loans || 0))}</dd></div>
        <div><dt>Other deductions</dt><dd>{formatCurrency(Number(payout.other_deductions || 0))}</dd></div>
        <div><dt>Net payout</dt><dd>{formatCurrency(Number(totals.net_payable || payout.net_payable || 0))}</dd></div>
      </dl>
      <Table
        columns={[
          { key: "delivery_date", label: "Delivery Date", render: (row) => formatDate(row.delivery_date) },
          { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
          { key: "grade_display", label: "Grade" },
        ]}
        rows={statement.deliveries || []}
      />
      <div className="form-actions">
        <Button onClick={() => downloadTextFile(filename, statementHtml(statement), "text/html;charset=utf-8")}>
          Download Statement
        </Button>
      </div>
    </article>
  );
}
