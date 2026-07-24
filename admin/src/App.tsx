import { useState } from "react";
import type { ReactNode } from "react";
import { StationsPage } from "./StationsPage";
import { ModerationPage } from "./ModerationPage";
import { UsersPage } from "./pages/UsersPage";
import { MetricsPage } from "./pages/MetricsPage";
import { ConfigPage } from "./pages/ConfigPage";

type Section = "postos" | "usuarios" | "metricas" | "moderacao" | "config";

interface NavItem {
  id: Section;
  label: string;
  icon: ReactNode;
  enabled: boolean;
}

function IconMapPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 8v12" />
      <path d="M7 14v8" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { id: "postos", label: "Postos", icon: <IconMapPin />, enabled: true },
  { id: "usuarios", label: "Usuários", icon: <IconUsers />, enabled: true },
  { id: "metricas", label: "Métricas", icon: <IconBarChart />, enabled: true },
  { id: "moderacao", label: "Moderação", icon: <IconShield />, enabled: true },
  { id: "config", label: "Configurações", icon: <IconSettings />, enabled: true },
];

export function App() {
  const [section, setSection] = useState<Section>("postos");

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">Abastece Aê</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${section === item.id ? " sidebar-link--active" : ""}`}
              disabled={!item.enabled}
              onClick={() => setSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {!item.enabled && <span className="sidebar-link-badge">em breve</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <div className="main-content-inner">
          {section === "postos" && <StationsPage />}
          {section === "usuarios" && <UsersPage />}
          {section === "metricas" && <MetricsPage />}
          {section === "moderacao" && <ModerationPage />}
          {section === "config" && <ConfigPage />}
        </div>
      </main>
    </div>
  );
}
