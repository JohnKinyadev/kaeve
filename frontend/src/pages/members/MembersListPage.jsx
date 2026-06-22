import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { Pagination } from "../../components/shared/Pagination";
import { SearchBar } from "../../components/shared/SearchBar";
import { useApiResource } from "../../hooks/useApiResource";
import { getCount, getResults, toQueryString } from "../../utils/helpers";

export function MembersListPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const statusValue = status === "All" ? "" : status.toLowerCase();
  const path = `/api/members/${toQueryString({ search: query, status: statusValue, page })}`;
  const { data, error, isLoading } = useApiResource(path);
  const members = getResults(data);
  const totalPages = Math.max(1, Math.ceil(getCount(data) / 20));

  return (
    <div className="page-stack">
      {error && <div className="form-error">{error}</div>}
      <section className="toolbar">
        <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search by member, no., or location" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option>All</option>
          <option>Active</option>
          <option>Suspended</option>
          <option>Exited</option>
        </select>
        <Button onClick={() => (window.location.hash = "#/members/new")}>
          <Plus size={16} /> Register New Member
        </Button>
      </section>

      <article className="panel">
        <Table
          columns={[
            { key: "membership_number", label: "Membership No." },
            { key: "full_name", label: "Name" },
            { key: "phone_number", label: "Phone" },
            { key: "farm_size_acres", label: "Farm Size", render: (row) => `${row.farm_size_acres} acres` },
            { key: "location", label: "Location" },
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge> },
          ]}
          rows={isLoading ? [] : members}
          renderActions={(row) => <Button variant="ghost" onClick={() => (window.location.hash = `#/members/${row.id}`)}>View</Button>}
        />
      </article>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
