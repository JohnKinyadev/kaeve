import { Factory } from "lucide-react";

import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";

export function MillingPage() {
  return (
    <div className="page-stack">
      <section className="stat-grid">
        <StatCard icon={Factory} label="Batches" value="12" />
        <StatCard icon={Factory} label="Clean Coffee" value="7,834 kg" />
        <StatCard icon={Factory} label="Average Outturn" value="18.4%" />
      </section>
      <article className="panel">
        <Table columns={[{ key: "batch", label: "Batch" }, { key: "cherry", label: "Cherry" }, { key: "clean", label: "Clean Coffee" }, { key: "outturn", label: "Outturn" }]} rows={[{ id: 1, batch: "MIL-001", cherry: "4,200 kg", clean: "782 kg", outturn: "18.6%" }]} />
      </article>
    </div>
  );
}

