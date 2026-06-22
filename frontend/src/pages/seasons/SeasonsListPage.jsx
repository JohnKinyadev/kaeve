import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";

const seasons = [
  { id: "main-2026", name: "Main Crop 2026", dates: "Mar 2026 - Sep 2026", type: "Main crop", status: "Open" },
  { id: "fly-2025", name: "Fly Crop 2025", dates: "Oct 2025 - Jan 2026", type: "Fly crop", status: "Closed" },
];

export function SeasonsListPage() {
  return (
    <article className="panel">
      <Table
        columns={[
          { key: "name", label: "Season" },
          { key: "dates", label: "Dates" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "Open" ? "success" : "neutral"}>{row.status}</Badge> },
        ]}
        rows={seasons}
        renderActions={(row) => <Button variant="ghost" onClick={() => (window.location.hash = `#/seasons/${row.id}`)}>Open</Button>}
      />
    </article>
  );
}

