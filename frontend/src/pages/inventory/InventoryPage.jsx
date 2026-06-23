import { Boxes } from "lucide-react";

import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { useApiResource } from "../../hooks/useApiResource";
import { formatKg } from "../../utils/formatters";
import { getResults } from "../../utils/helpers";

const stockTypes = [
  { key: "cherry", label: "Cherry" },
  { key: "parchment", label: "Parchment" },
  { key: "green_bean", label: "Green Beans" },
];

export function InventoryPage() {
  const inventory = useApiResource("/api/inventory-stocks/");
  const rows = getResults(inventory.data);
  const totals = stockTypes.map((type) => ({
    ...type,
    total: rows
      .filter((row) => row.stock_type === type.key)
      .reduce((sum, row) => sum + Number(row.quantity_kg || 0), 0),
  }));

  return (
    <div className="page-stack">
      {inventory.error && <div className="form-error">{inventory.error}</div>}
      <section className="stat-grid">
        {totals.map((item) => (
          <StatCard key={item.key} icon={Boxes} label={item.label} value={formatKg(item.total)} detail="Current stock" />
        ))}
      </section>
      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Inventory Stock</h2>
            <span>Automatically updated from deliveries and milling records</span>
          </div>
        </div>
        <Table
          columns={[
            { key: "season_name", label: "Season" },
            { key: "stock_type_display", label: "Type" },
            { key: "warehouse", label: "Warehouse" },
            { key: "quantity_kg", label: "Quantity", render: (row) => formatKg(Number(row.quantity_kg || 0)) },
          ]}
          rows={rows}
        />
      </article>
    </div>
  );
}
