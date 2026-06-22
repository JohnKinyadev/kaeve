import { useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import { formatCurrency } from "../../utils/formatters";

const loans = [
  { id: 1, member: "Mary Wanjiku", amount: formatCurrency(18000), date: "18 Jun 2026", status: "Pending" },
  { id: 2, member: "Peter Kamau", amount: formatCurrency(12000), date: "17 Jun 2026", status: "Approved" },
];

export function LoansPage() {
  const [action, setAction] = useState(null);

  return (
    <div className="page-stack">
      <div className="tabs"><button className="active">Pending</button><button>Approved</button><button>Rejected</button></div>
      <article className="panel">
        <Table
          columns={[
            { key: "member", label: "Member" },
            { key: "amount", label: "Amount Requested" },
            { key: "date", label: "Date" },
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "Approved" ? "success" : "warning"}>{row.status}</Badge> },
          ]}
          rows={loans}
          renderActions={(row) => row.status === "Pending" && <><Button variant="ghost" onClick={() => setAction({ type: "Approve", row })}>Approve</Button><Button variant="ghost" onClick={() => setAction({ type: "Reject", row })}>Reject</Button></>}
        />
      </article>
      {action && (
        <Modal title={`${action.type} loan?`} confirmLabel={action.type} onClose={() => setAction(null)} onConfirm={() => setAction(null)}>
          <p>{action.type} {action.row.member}'s loan request for {action.row.amount}.</p>
        </Modal>
      )}
    </div>
  );
}

