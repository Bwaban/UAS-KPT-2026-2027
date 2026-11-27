import { BlockMath } from "react-katex";
import { ArrowUpRight, BookOpenCheck, Cpu, Network } from "lucide-react";
import { PageHeader } from "../components/UI";

const equations = [
  {
    symbol: "S",
    title: "Speedup",
    formula: String.raw`S = \frac{T_{\text{seq}}}{T_{\text{par}}}`,
    note: "Percepatan relatif terhadap waktu eksekusi sekuensial (P=1).",
  },
  {
    symbol: "E",
    title: "Efisiensi paralel",
    formula: String.raw`E = \frac{S}{P}`,
    note: "Proporsi kapasitas prosesor yang dimanfaatkan secara efektif.",
  },
  {
    symbol: "GFLOPS",
    title: "Throughput",
    formula: String.raw`\text{GFLOPS} = \frac{2N^3}{T_{\text{total}} \times 10^9}`,
    note: "Laju operasi floating-point pada perkalian matriks N × N.",
  },
  {
    symbol: "%T_comm",
    title: "Overhead komunikasi",
    formula: String.raw`\%T_{\text{comm}} = \frac{T_{\text{comm}}}{T_{\text{total}}} \times 100\%`,
    note: "Porsi waktu eksekusi total yang terserap transfer data MPI.",
  },
];

export default function Architecture() {
  return (
    <div className="page architecture-page">
      <PageHeader
        title="Arsitektur & rumus"
        description="Alur komunikasi kolektif MPI 1D block-row dan metrik evaluasi performa."
      />

      <section className="panel architecture-panel">
        <div className="panel-heading">
          <div>
            <h2>Alur komunikasi kolektif</h2>
            <p>Master membagi baris matriks A, setiap worker menghitung lokal, lalu hasil digabungkan kembali.</p>
          </div>
          <Network size={16} strokeWidth={1.6} className="muted-icon" />
        </div>

        <div className="architecture-diagram">
          <svg viewBox="0 0 920 420" role="img" aria-labelledby="diagram-title diagram-desc">
            <title id="diagram-title">Diagram alur master dan worker MPI</title>
            <desc id="diagram-desc">
              Master mengirim B menggunakan Bcast, mengirim bagian A menggunakan Scatterv, dan mengumpulkan hasil C
              dengan Gatherv.
            </desc>
            <defs>
              <marker id="arrow-accent" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#0EA5E9" />
              </marker>
              <marker id="arrow-compute" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#10B981" />
              </marker>
            </defs>

            <g className="diagram-node master">
              <rect x="348" y="24" width="224" height="96" rx="10" />
              <text x="460" y="64" textAnchor="middle" className="diagram-title">
                Master · Rank 0
              </text>
              <text x="460" y="89" textAnchor="middle" className="diagram-subtitle">
                Generate A, B · koordinasi
              </text>
            </g>

            <path
              d="M420 121 C380 164 186 148 160 214"
              className="diagram-line accent-line"
              markerEnd="url(#arrow-accent)"
            />
            <path d="M460 122 L460 212" className="diagram-line accent-line" markerEnd="url(#arrow-accent)" />
            <path
              d="M500 121 C540 164 735 148 760 214"
              className="diagram-line accent-line"
              markerEnd="url(#arrow-accent)"
            />

            <text x="260" y="164" className="diagram-label accent-text">
              Bcast B · Scatterv A
            </text>
            <text x="530" y="172" className="diagram-label accent-text">
              Bcast B · Scatterv A
            </text>

            <g className="diagram-node worker">
              <rect x="58" y="216" width="204" height="94" rx="10" />
              <text x="160" y="255" textAnchor="middle" className="diagram-title">
                Worker 1 · Rank 1
              </text>
              <text x="160" y="280" textAnchor="middle" className="diagram-subtitle">
                local_C = local_A × B
              </text>
            </g>
            <g className="diagram-node worker">
              <rect x="358" y="216" width="204" height="94" rx="10" />
              <text x="460" y="255" textAnchor="middle" className="diagram-title">
                Worker 2 · Rank 2
              </text>
              <text x="460" y="280" textAnchor="middle" className="diagram-subtitle">
                local_C = local_A × B
              </text>
            </g>
            <g className="diagram-node worker">
              <rect x="658" y="216" width="204" height="94" rx="10" />
              <text x="760" y="255" textAnchor="middle" className="diagram-title">
                Worker P−1
              </text>
              <text x="760" y="280" textAnchor="middle" className="diagram-subtitle">
                local_C = local_A × B
              </text>
            </g>

            <path
              d="M160 312 C185 378 365 362 420 340"
              className="diagram-line compute-line"
              markerEnd="url(#arrow-compute)"
            />
            <path d="M460 312 L460 338" className="diagram-line compute-line" markerEnd="url(#arrow-compute)" />
            <path
              d="M760 312 C735 378 555 362 500 340"
              className="diagram-line compute-line"
              markerEnd="url(#arrow-compute)"
            />

            <g className="diagram-node result">
              <rect x="348" y="340" width="224" height="62" rx="10" />
              <text x="460" y="376" textAnchor="middle" className="diagram-title">
                Gatherv C · matriks utuh
              </text>
            </g>

            <text x="256" y="370" className="diagram-label compute-text">
              Gatherv local_C
            </text>
            <text x="550" y="370" className="diagram-label compute-text">
              Gatherv local_C
            </text>
          </svg>
        </div>

        <div className="diagram-legend">
          <span>
            <i className="legend-dot total" /> Distribusi input · Bcast / Scatterv
          </span>
          <span>
            <i className="legend-dot compute" /> Pengumpulan hasil · Gatherv
          </span>
          <span>
            <Cpu size={13} strokeWidth={1.6} /> Komputasi lokal BLAS
          </span>
        </div>
      </section>

      <div className="section-title">
        <div>
          <h2>Formula evaluasi</h2>
          <p>Definisi metrik yang dihitung otomatis oleh benchmark runner</p>
        </div>
      </div>

      <div className="formula-grid">
        {equations.map((item) => (
          <article className="formula-card" key={item.symbol}>
            <div className="formula-card-top">
              <span className="formula-name">{item.title}</span>
              <span className="formula-symbol mono">{item.symbol}</span>
            </div>
            <div className="formula-equation">
              <BlockMath math={item.formula} />
            </div>
            <p>{item.note}</p>
          </article>
        ))}
      </div>

      <section className="architecture-links">
        <div>
          <BookOpenCheck size={17} strokeWidth={1.6} />
          <div>
            <strong>Dokumentasi repositori</strong>
            <small>Spesifikasi program, panduan eksekusi MPI, dan kerangka laporan IEEE.</small>
          </div>
        </div>
        <div className="doc-links">
          <a href="https://github.com/Bwaban/UAS-KPT-2026-2027/blob/main/README.md" target="_blank" rel="noreferrer">
            <span>Buka README</span>
            <ArrowUpRight size={14} strokeWidth={1.6} />
          </a>
          <a
            href="https://github.com/Bwaban/UAS-KPT-2026-2027/blob/main/README.md#kerangka-laporan-akhir-ieee-style-format"
            target="_blank"
            rel="noreferrer"
          >
            <span>Kerangka IEEE</span>
            <ArrowUpRight size={14} strokeWidth={1.6} />
          </a>
        </div>
      </section>
    </div>
  );
}
