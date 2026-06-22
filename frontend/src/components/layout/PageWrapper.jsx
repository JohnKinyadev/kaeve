import { useState } from "react";

import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "../../hooks/useAuth";
import { classNames } from "../../utils/helpers";

export function PageWrapper({ title, subtitle = "Main crop 2026", currentPath, children }) {
  const { role } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <main className={classNames("app-shell", isSidebarOpen && "sidebar-open")}>
      <Sidebar currentPath={currentPath} role={role} />
      <section className="workspace">
        <Navbar title={title} subtitle={subtitle} onMenuClick={() => setIsSidebarOpen((value) => !value)} />
        {children}
      </section>
    </main>
  );
}

