import { useState } from "react";
import { Scale, Users, Factory } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { StatCard } from "../../components/ui/StatCard";

export function SeasonDetailPage() {
  const [isClosing, setIsClosing] = useState(false);

  return (
    <div className="page-stack">
      <section className="profile-header panel">
        <div>
          <span className="eyebrow">Open season</span>
          <h2>Main Crop 2026</h2>
          <p>Mar 2026 - Sep 2026 · Main crop</p>
        </div>
        <Button variant="danger" onClick={() => setIsClosing(true)}>Close Season</Button>
      </section>
      <section className="stat-grid">
        <StatCard icon={Scale} label="Total Cherry" value="42,580 kg" />
        <StatCard icon={Users} label="Active Members" value="1,106" />
        <StatCard icon={Factory} label="Milling Outturn" value="18.4%" />
      </section>
      {isClosing && (
        <Modal title="Close season?" confirmLabel="Close Season" onClose={() => setIsClosing(false)} onConfirm={() => setIsClosing(false)}>
          <p>Closing this season will lock delivery edits and allow final payout processing.</p>
        </Modal>
      )}
    </div>
  );
}

