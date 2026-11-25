import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Skeleton } from "./components/UI";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const RunExperiment = lazy(() => import("./pages/RunExperiment"));
const Results = lazy(() => import("./pages/Results"));
const Fault = lazy(() => import("./pages/Fault"));
const Architecture = lazy(() => import("./pages/Architecture"));

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("mpi-theme") as "dark" | "light") ?? "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mpi-theme", theme);
  }, [theme]);
  return <Layout theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}>
    <Suspense fallback={<div className="page"><Skeleton rows={3} /></div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jalankan" element={<RunExperiment />} />
        <Route path="/hasil" element={<Results />} />
        <Route path="/fault" element={<Fault />} />
        <Route path="/arsitektur" element={<Architecture />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </Layout>;
}
