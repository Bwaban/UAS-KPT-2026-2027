import { NavLink } from "react-router-dom";
import { Activity, BarChart3, BookOpen, Cpu, PlaySquare, ShieldAlert, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./UI";

const menu = [
  { to: "/", label: "Ringkasan", icon: LayoutGrid, end: true },
  { to: "/jalankan", label: "Eksperimen", icon: PlaySquare },
  { to: "/hasil", label: "Benchmark", icon: BarChart3 },
  { to: "/fault", label: "Fault tolerance", icon: ShieldAlert },
  { to: "/arsitektur", label: "Arsitektur", icon: BookOpen },
];

function MatrixMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" fill="currentColor" />
      <rect x="11.5" y="2" width="6.5" height="6.5" rx="1.5" fill="var(--accent)" />
      <rect x="2" y="11.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function Layout({
  children,
  theme,
  onToggleTheme,
}: {
  children: ReactNode;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <MatrixMark />
          </div>
          <div className="brand-copy">
            <strong>MPI Matrix Lab</strong>
            <span>HPC Workbench</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navigasi utama">
          {menu.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <Icon size={16} strokeWidth={1.6} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <section className="mpi-status" aria-label="Status runtime MPI">
            <div className="status-header">
              <span className="status-indicator" />
              <span>Runtime MPI</span>
              <span className="status-ok">Siap</span>
            </div>
            <div className="status-row">
              <span>
                <Activity size={13} strokeWidth={1.6} /> mpiexec
              </span>
              <strong className="mono">Aktif</strong>
            </div>
            <div className="status-row">
              <span>Python</span>
              <strong className="mono">3.11.8</strong>
            </div>
            <div className="status-row">
              <span>
                <Cpu size={13} strokeWidth={1.6} /> Kapasitas
              </span>
              <strong className="mono">16 core</strong>
            </div>
          </section>

          <div className="sidebar-footer">
            <div className="course-mark">
              <span className="mono">UAS KPT 2026/2027</span>
              <small>Universitas Siliwangi</small>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-topbar">
          <div className="brand-mark">
            <MatrixMark />
          </div>
          <strong>MPI Matrix Lab</strong>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </header>

        <div className="content-wrap">
          {children}
          <footer className="app-footer">
            <span>MPI Matrix Lab</span>
            <span className="footer-sep">/</span>
            <span>Komputasi Paralel dan Terdistribusi</span>
            <span className="footer-sep">/</span>
            <span className="mono">2026–2027</span>
          </footer>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigasi seluler">
        {menu.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className={({ isActive }) => `bottom-link ${isActive ? "active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.6} />
            <span>{label === "Fault tolerance" ? "Fault" : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
