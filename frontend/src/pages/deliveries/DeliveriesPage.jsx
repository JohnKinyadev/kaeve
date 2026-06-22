import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { SearchBar } from "../../components/shared/SearchBar";
import { useApiResource } from "../../hooks/useApiResource";
import { formatDate, formatKg } from "../../utils/formatters";
import { getResults, toQueryString } from "../../utils/helpers";

export function DeliveriesPage() {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const path = `/api/deliveries/${toQueryString({ search: query, grade, ordering: "-delivery_date" })}`;
  const { data, error, isLoading } = useApiResource(path);
  const deliveries = getResults(data);

  return (
    <div className="page-stack">
      {error && <div className="form-error">{error}</div>}
      <section className="toolbar">
        <SearchBar value={query} onChange={setQuery} placeholder="Filter by member or collection point" />
        <select value={grade} onChange={(event) => setGrade(event.target.value)}>
          <option value="">All grades</option>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="pb">PB</option>
          <option value="ungraded">Ungraded</option>
        </select>
        <Button onClick={() => (window.location.hash = "#/deliveries/log")}>
          <Plus size={16} /> Log Delivery
        </Button>
      </section>
      <article className="panel">
        <Table
          columns={[
            { key: "delivery_date", label: "Date", render: (row) => formatDate(row.delivery_date) },
            { key: "member_name", label: "Member" },
            { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
            { key: "grade_display", label: "Grade" },
            { key: "collection_point_name", label: "Collection Point" },
          ]}
          rows={isLoading ? [] : deliveries}
        />
      </article>
    </div>
  );
}
