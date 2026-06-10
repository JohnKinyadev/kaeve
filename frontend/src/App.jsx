import {
  Banknote,
  BarChart3,
  Factory,
  LayoutDashboard,
  Scale,
  Users,
  Warehouse,
} from "lucide-react";

const stats = [
  { label: "Season Cherry", value: "42,580 kg", icon: Scale },
  { label: "Active Members", value: "1,248", icon: Users },
  { label: "Pending Loans", value: "36", icon: Banknote },
  { label: "Warehouse Stock", value: "9,340 kg", icon: Warehouse },
];

const modules = [
  {
    title: "Member Management",
    description: "Register farmers, track membership status, and maintain member ledgers.",
    icon: Users,
  },
  {
    title: "Cherry Deliveries",
    description: "Record daily intake by farmer, grade, weight, and collection point.",
    icon: Scale,
  },
  {
    title: "Milling & Inventory",
    description: "Log milling batches, outturn ratio, and stock movement across warehouses.",
    icon: Factory,
  },
  {
    title: "Payouts & Reports",
    description: "Calculate seasonal payouts, deduct loans, and prepare exportable reports.",
    icon: BarChart3,
  },
];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KC</span>
          <div>
            <strong>Kaeve Coffee</strong>
            <span>Cooperative system</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <a className="active" href="#dashboard">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a href="#members">
            <Users size={18} />
            Members
          </a>
          <a href="#deliveries">
            <Scale size={18} />
            Deliveries
          </a>
          <a href="#loans">
            <Banknote size={18} />
            Loans
          </a>
          <a href="#reports">
            <BarChart3 size={18} />
            Reports
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Admin dashboard</span>
            <h1>Coffee Cooperative Management</h1>
          </div>
          <button type="button">New Delivery</button>
        </header>

        <section className="stat-grid" aria-label="Season summary">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article className="stat-card" key={stat.label}>
                <Icon size={22} />
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            );
          })}
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Operational Modules</h2>
              <span>Main crop 2026</span>
            </div>
            <div className="module-list">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <article className="module-row" key={module.title}>
                    <Icon size={21} />
                    <div>
                      <h3>{module.title}</h3>
                      <p>{module.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="panel intake-panel">
            <div className="panel-header">
              <h2>Today&apos;s Intake</h2>
              <span>Collection points</span>
            </div>
            <div className="intake-list">
              <div>
                <span>Kiamumbi</span>
                <strong>3,240 kg</strong>
              </div>
              <div>
                <span>Gathage</span>
                <strong>2,180 kg</strong>
              </div>
              <div>
                <span>Karura</span>
                <strong>1,965 kg</strong>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
