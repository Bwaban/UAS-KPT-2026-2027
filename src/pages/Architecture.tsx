import { BlockMath } from "react-katex";
import { ArrowUp, BookOpenCheck, Boxes, Cpu, Network } from "lucide-react";
import { PageHeader } from "../components/UI";

const equations = [
  { symbol: "S", title: "Speedup", formula: String.raw`S = \frac{T_{\text{seq}}}{T_{\text{par}}}`, note: "Percepatan relatif terhadap waktu eksekusi sekuensial." },
  { symbol: "E", title: "Efisiensi paralel", formula: String.raw`E = \frac{S}{P}`, note: "Proporsi kapasitas proses yang dimanfaatkan secara efektif." },
  { symbol: "GFLOPS", title: "Throughput", formula: String.raw`\text{GFLOPS} = \frac{2N^3}{T_{\text{total}} \times 10^9}`, note: "Laju operasi floating-point untuk perkalian matriks." },
  { symbol: "% comm", title: "Overhead komunikasi", formula: String.raw`\%T_{\text{comm}} = \frac{T_{\text{comm}}}{T_{\text{total}}} \times 100\%`, note: "Porsi waktu total yang digunakan untuk komunikasi MPI." },
];

export default function Architecture() {
  return <div className="page architecture-page">
    <PageHeader eyebrow="PANDUAN SISTEM" title="Arsitektur & rumus" description="Alur komunikasi kolektif MPI dan metrik yang digunakan pada analisis performa." />
    <section className="panel architecture-panel"><div className="panel-heading"><div><h2>Alur komputasi terdistribusi</h2><p>Master membagi baris matriks A, worker menghitung bagian lokal, lalu hasil digabungkan.</p></div><Network size={18} className="muted-icon" /></div>
      <div className="architecture-diagram">
        <svg viewBox="0 0 920 420" role="img" aria-labelledby="diagram-title diagram-desc">
          <title id="diagram-title">Diagram alur master dan worker MPI</title><desc id="diagram-desc">Master mengirim B menggunakan Bcast, mengirim bagian A menggunakan Scatterv, dan mengumpulkan hasil C dengan Gatherv.</desc>
          <defs><marker id="arrow-indigo" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#6C7BFF" /></marker><marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#FF9F43" /></marker><marker id="arrow-teal" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#2DD4BF" /></marker></defs>
          <g className="diagram-node master"><rect x="348" y="26" width="224" height="100" rx="14" /><text x="460" y="67" textAnchor="middle" className="diagram-title">Master · Rank 0</text><text x="460" y="94" textAnchor="middle" className="diagram-subtitle">Generate A, B · koordinasi</text></g>
          <path d="M420 127 C380 167 186 150 160 216" className="diagram-line indigo-line" markerEnd="url(#arrow-indigo)" /><path d="M460 128 L460 214" className="diagram-line indigo-line" markerEnd="url(#arrow-indigo)" /><path d="M500 127 C540 167 735 150 760 216" className="diagram-line indigo-line" markerEnd="url(#arrow-indigo)" />
          <text x="268" y="166" className="diagram-label indigo-text">Bcast B · Scatterv A</text><text x="528" y="174" className="diagram-label indigo-text">Bcast B · Scatterv A</text>
          <g className="diagram-node worker"><rect x="58" y="218" width="204" height="98" rx="14" /><text x="160" y="258" textAnchor="middle" className="diagram-title">Worker 1 · Rank 1</text><text x="160" y="285" textAnchor="middle" className="diagram-subtitle">local_C = local_A × B</text></g>
          <g className="diagram-node worker"><rect x="358" y="218" width="204" height="98" rx="14" /><text x="460" y="258" textAnchor="middle" className="diagram-title">Worker 2 · Rank 2</text><text x="460" y="285" textAnchor="middle" className="diagram-subtitle">local_C = local_A × B</text></g>
          <g className="diagram-node worker"><rect x="658" y="218" width="204" height="98" rx="14" /><text x="760" y="258" textAnchor="middle" className="diagram-title">Worker P−1</text><text x="760" y="285" textAnchor="middle" className="diagram-subtitle">local_C = local_A × B</text></g>
          <path d="M160 320 C185 383 365 365 420 340" className="diagram-line teal-line" markerEnd="url(#arrow-teal)" /><path d="M460 320 L460 344" className="diagram-line teal-line" markerEnd="url(#arrow-teal)" /><path d="M760 320 C735 383 555 365 500 340" className="diagram-line teal-line" markerEnd="url(#arrow-teal)" />
          <g className="diagram-node result"><rect x="348" y="340" width="224" height="64" rx="12" /><text x="460" y="379" textAnchor="middle" className="diagram-title">Gatherv C · hasil digabung</text></g>
          <text x="265" y="370" className="diagram-label teal-text">Gatherv local_C</text><text x="550" y="370" className="diagram-label teal-text">Gatherv local_C</text>
        </svg>
      </div>
      <div className="diagram-legend"><span><i className="legend-dot total" /> Komunikasi input · Bcast / Scatterv</span><span><i className="legend-dot compute" /> Hasil lokal · Gatherv</span><span><Cpu size={14} /> Komputasi local_A × B</span></div>
    </section>
    <div className="section-title"><div><h2>Rumus analisis</h2><p>Definisi metrik yang dihitung oleh benchmark runner.</p></div><Boxes size={18} className="muted-icon" /></div>
    <div className="formula-grid">{equations.map((item) => <article className="formula-card" key={item.symbol}><div className="formula-card-top"><span className="formula-symbol">{item.symbol}</span><span className="formula-name">{item.title}</span></div><div className="formula-equation"><BlockMath math={item.formula} /></div><p>{item.note}</p></article>)}</div>
    <section className="architecture-links"><div><BookOpenCheck size={18} /><div><strong>Dokumentasi proyek</strong><small>Spesifikasi program, instalasi, dan kerangka laporan IEEE.</small></div></div><div className="doc-links"><a href="https://github.com/Bwaban/UAS-KPT-2026-2027/blob/main/README.md" target="_blank" rel="noreferrer">Buka README <ArrowUp size={14} /></a><a href="https://github.com/Bwaban/UAS-KPT-2026-2027/blob/main/README.md#kerangka-laporan-akhir-ieee-style-format" target="_blank" rel="noreferrer">Kerangka IEEE <ArrowUp size={14} /></a></div></section>
  </div>;
}
