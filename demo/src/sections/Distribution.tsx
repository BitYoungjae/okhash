import { useMemo, useState } from "react";
import { createColorHash } from "okhash";

import { oklchToHex } from "../lib/colorMath";
import { metrics } from "../lib/data";

const BIN_COUNT = 36;

interface Histogram {
  bins: number[];
  max: number;
  total: number;
  chiSquare: number;
}

function buildHistogram(samples: number, prefix: string): Histogram {
  const hasher = createColorHash();
  const bins = new Array<number>(BIN_COUNT).fill(0);
  for (let i = 0; i < samples; i += 1) {
    const hue = hasher.oklch(`${prefix}-${i}`).h;
    const index = Math.min(Math.floor((hue / 360) * BIN_COUNT), BIN_COUNT - 1);
    bins[index] += 1;
  }
  const expected = samples / BIN_COUNT;
  const chiSquare =
    expected > 0 ? bins.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0) : 0;
  return { bins, max: Math.max(1, ...bins), total: samples, chiSquare };
}

function Wheel({ histogram }: { histogram: Histogram }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const inner = 34;
  const outer = 110;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="hue distribution wheel">
      {histogram.bins.map((count, i) => {
        const a0 = ((i / BIN_COUNT) * 360 - 90) * (Math.PI / 180);
        const a1 = (((i + 1) / BIN_COUNT) * 360 - 90) * (Math.PI / 180);
        const r = inner + (outer - inner) * (count / histogram.max);
        const x1 = cx + Math.cos(a0) * inner;
        const y1 = cy + Math.sin(a0) * inner;
        const x2 = cx + Math.cos(a0) * r;
        const y2 = cy + Math.sin(a0) * r;
        const x3 = cx + Math.cos(a1) * r;
        const y3 = cy + Math.sin(a1) * r;
        const x4 = cx + Math.cos(a1) * inner;
        const y4 = cy + Math.sin(a1) * inner;
        const hue = (i + 0.5) * (360 / BIN_COUNT);
        return (
          <path
            key={i}
            d={`M${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 0 1 ${x3} ${y3} L${x4} ${y4} A${inner} ${inner} 0 0 0 ${x1} ${y1} Z`}
            fill={oklchToHex(0.68, 0.13, hue)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={outer} fill="none" stroke="var(--line-2)" strokeWidth="1" />
    </svg>
  );
}

export function Distribution() {
  const [samples, setSamples] = useState(2000);
  const histogram = useMemo(() => buildHistogram(samples, "dist"), [samples]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0,1fr)", gap: 24 }} className="pg-grid">
      <div className="card" style={{ padding: 18, display: "flex", justifyContent: "center" }}>
        <Wheel histogram={histogram} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="label">live samples</span>
            <input
              type="range"
              min={500}
              max={20000}
              step={500}
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
              style={{ flex: 1, minWidth: 180 }}
            />
            <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
              {samples.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", height: 64, gap: 2, marginTop: 18, alignItems: "flex-end" }}>
            {histogram.bins.map((count, i) => (
              <div
                key={i}
                title={`${Math.round((i / BIN_COUNT) * 360)}°: ${count}`}
                style={{
                  flex: 1,
                  height: `${(count / histogram.max) * 100}%`,
                  minHeight: 2,
                  background: oklchToHex(0.68, 0.13, (i + 0.5) * (360 / BIN_COUNT)),
                  borderRadius: "2px 2px 0 0",
                }}
              />
            ))}
          </div>
          <p className="note">
            {BIN_COUNT} hue bins over {samples.toLocaleString()} strings, hashed live in your
            browser. Live chi-square: {histogram.chiSquare.toFixed(1)} (expected near{" "}
            {BIN_COUNT - 1} for a uniform spread).
          </p>
        </div>
        <div className="statgrid card" style={{ padding: 0 }}>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>
              {Math.round(metrics.distribution.chiSquare)}
            </div>
            <div className="label" style={{ marginTop: 4 }}>
              hue χ² · {metrics.distribution.samples.toLocaleString()} samples
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>
              {metrics.proximity.close} / {metrics.proximity.pairs}
            </div>
            <div className="label" style={{ marginTop: 4 }}>
              similar inputs within 10°
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>
              {metrics.gamut.outOfGamut} / {(metrics.gamut.samples / 1_000_000).toFixed(0)}M
            </div>
            <div className="label" style={{ marginTop: 4 }}>
              out of gamut
            </div>
          </div>
        </div>
        <p className="note">
          The large figures come from <span className="mono">node tools/measure-metrics.mjs</span>{" "}
          over the frozen corpus. Low χ² means hues spread evenly; a low proximity count means
          similar strings do not collapse to similar hues.
        </p>
      </div>
    </div>
  );
}
