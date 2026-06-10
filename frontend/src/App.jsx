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
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Admin dashboard</span>
            <h1>Coffee Cooperative Management</h1>
          </div>
          <button type="button">New Delivery</button>
        </header>
      </section>
    </main>
  );
}

export default App;
