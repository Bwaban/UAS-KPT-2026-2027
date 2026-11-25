import { NavLink } from "react-router-dom";
import { Activity, Atom, BarChart3, BookOpen, Cpu, FlaskConical, Gauge, HeartPulse } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./UI";

const menu = [
  { to: "/", label: "Dashboard", icon: Gauge, end: true },
  { to: "/jalankan", label: "Jalankan", icon: FlaskConical },
  { to: "/hasil", label: "Hasil benchmark", icon: BarChart3 },
  { to: "/fault", label: "Fault tolerance", icon: HeartPulse },
  { to: "/arsitektur", label: "Arsitektur & rumus", icon: BookOpen },
];

export function Layout({ children, theme, onToggleTheme }: { children: ReactNode; theme: "dark" | "light"; onToggleTheme: () => void }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Atom size={21} /></div><div><strong>MPI Matrix Lab</strong><small>LAB KOMPUTASI PARALEL</small></div></div>
      <div className="nav-caption">RUANG KERJA</div>
      <nav className="main-nav" aria-label="Navigasi utama">{menu.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom">
        <section className="mpi-status"><div className="status-header"><span className="status-indicator" />Status MPI <span className="status-ok">Siap</span></div>
          <div className="status-row"><span><Activity size={13} /> mpiexec</span><strong>Terdeteksi</strong></div>
          <div className="status-row"><span>Python</span><strong>3.11.8</strong></div>
          <div className="status-row"><span><Cpu size={13} /> Core tersedia</span><strong>16 core</strong></div>
        </section>
        <div className="course-mark"><span>UAS KPT 2026/2027</span><small>Universitas Siliwangi</small></div>
      </div>
    </aside>
    <main className="main-area"><div className="mobile-topbar"><div className="brand-mark"><Atom size={19} /></div><strong>MPI Matrix Lab</strong><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
      <div className="desktop-theme"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
      <div className="content-wrap">{children}<footer className="app-footer">MPI Matrix Lab <span>·</span> Komputasi Paralel dan Terdistribusi <span>·</span> 2026/2027</footer></div>
    </main>
    <nav className="bottom-nav" aria-label="Navigasi seluler">{menu.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => `bottom-link ${isActive ? "active" : ""}`}><Icon size={19} /><span>{label === "Hasil benchmark" ? "Hasil" : label === "Arsitektur & rumus" ? "Rumus" : label}</span></NavLink>)}</nav>
  </div>;
}
