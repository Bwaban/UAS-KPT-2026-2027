import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BarChart3, BookOpen, Cpu, HardDrive, LayoutGrid, Network, PlaySquare, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import type { SystemInfo } from "../types";
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
  const [sys, setSys] = useState<(SystemInfo & { live: boolean }) | null>(null);

  useEffect(() => {
    let active = true;
    const poll = () => {
      api.getSystem().then((info) => {
        if (active) setSys(info);
      });
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
          <section className="mpi-status" aria-label="Status runtime MPI dan telemetri host">
            <div className="status-header">
              <span className="status-indicator" />
              <span>Runtime MPI</span>
              <span className="status-ok mono">{sys?.live ? "Live API" : "Snapshot"}</span>
            </div>
            <div className="status-row">
              <span>
                <Activity size={13} strokeWidth={1.6} /> Driver
              </span>
              <strong className="mono">{sys?.mpi_cmd ?? "mpiexec"}</strong>
            </div>
            <div className="status-row">
              <span>Python</span>
              <strong className="mono">{sys?.python_version ?? "3.11.9"}</strong>
            </div>
            <div className="status-row">
              <span>
                <Cpu size={13} strokeWidth={1.6} /> CPU
              </span>
              <strong className="mono">
                {sys?.live ? `${sys.cpu_percent}% · ${sys.cpu_logical}T` : `${sys?.cpu_logical ?? 8} core`}
              </strong>
            </div>
            {sys?.live && (
              <>
                <div className="status-row">
                  <span>
                    <HardDrive size={13} strokeWidth={1.6} /> RAM
                  </span>
                  <strong className="mono">{sys.ram_percent}%</strong>
                </div>
                <div className="status-row">
                  <span>
                    <Network size={13} strokeWidth={1.6} /> Net I/O
                  </span>
                  <strong className="mono">
                    ↑{sys.net_sent_mb ?? 0} / ↓{sys.net_recv_mb ?? 0} MB
                  </strong>
                </div>
              </>
            )}
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
