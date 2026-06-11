import { useState } from "react";

import { hkDisplayLightness, hkWeight, oklchToHex } from "../lib/colorMath";
import { metrics } from "../lib/data";

const SHIPPED_K = metrics.calibration.kHk;
const SHIPPED_PEAK = metrics.calibration.hkPeakHue;
const ANCHOR_L = 0.7;
const ANCHOR_C = 0.18;
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);

function SwatchRow({ strength, peak }: { strength: number; peak: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {HUES.map((hue) => {
        const displayL = hkDisplayLightness(ANCHOR_L, ANCHOR_C, hue, strength, peak);
        return (
          <div
            key={hue}
            title={`${hue}° · L ${displayL.toFixed(3)}`}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 6,
              background: oklchToHex(displayL, ANCHOR_C, hue),
              transition: "background-color 0.14s ease",
            }}
          />
        );
      })}
    </div>
  );
}

function WeightCurve({ peak }: { peak: number }) {
  const width = 300;
  const height = 70;
  const points = Array.from({ length: 73 }, (_, i) => {
    const hue = i * 5;
    const x = (hue / 360) * width;
    const y = height - hkWeight(hue, peak) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const peakX = (peak / 360) * width;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1={peakX} y1={0} x2={peakX} y2={height} stroke="var(--faint)" strokeDasharray="3 3" strokeWidth="1" />
    </svg>
  );
}

function ConstantRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="kv">
      <span className="k">{name}</span>
      <span className="v">{value}</span>
    </div>
  );
}

export function Calibration() {
  const [strength, setStrength] = useState(SHIPPED_K);
  const [peak, setPeak] = useState(SHIPPED_PEAK);
  const atShipped = strength === SHIPPED_K && peak === SHIPPED_PEAK;
  const cal = metrics.calibration;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <span className="pending">{cal.status} · frozen at release candidate</span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>
          the shipped package uses k = {SHIPPED_K}, peak {SHIPPED_PEAK}°
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 22 }} className="pg-grid">
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="label" style={{ width: 78 }}>
                k · strength
              </span>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.01}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="mono" style={{ fontSize: 13, width: 44, textAlign: "right" }}>
                {strength.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="label" style={{ width: 78 }}>
                peak hue
              </span>
              <input
                type="range"
                min={60}
                max={160}
                step={1}
                value={peak}
                onChange={(e) => setPeak(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="mono" style={{ fontSize: 13, width: 44, textAlign: "right" }}>
                {peak}°
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="label">raw L baseline (k = 0)</span>
            <SwatchRow strength={0} peak={peak} />
            <span className="label" style={{ marginTop: 8 }}>
              corrected L (k = {strength.toFixed(2)})
              {atShipped && (
                <span style={{ color: "var(--faint)" }}> · matches shipped output</span>
              )}
            </span>
            <SwatchRow strength={strength} peak={peak} />
          </div>

          <div>
            <span className="label">w(H) weight</span>
            <WeightCurve peak={peak} />
          </div>

          <p className="note">
            Fixed OKLCH anchors at L {ANCHOR_L}, C {ANCHOR_C} across hue, previewed with Lᴅ = L − k ·
            C · ½(1 − cos(H − peak)). This sandbox explores the provisional constant; it does not
            change the installed package.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: "8px 18px" }}>
            <div className="label" style={{ padding: "12px 0 6px" }}>
              provisional constants
            </div>
            <ConstantRow name="k_HK" value={String(cal.kHk)} />
            <ConstantRow name="H-K peak" value={`${cal.hkPeakHue}°`} />
            <ConstantRow name="dark L shift" value={`+${cal.darkLightnessShift} (cap ${cal.darkLightnessCap})`} />
            <ConstantRow name="dark C scale" value={`×${cal.darkChromaScale}`} />
            <ConstantRow name="ΔE_OK threshold" value={String(cal.distinctThreshold)} />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 12 }}>
              verified against the package
            </div>
            <Check ok={cal.hkActive} label="H-K correction changes output" />
            <Check ok={cal.darkVariantLiftsLightness} label="dark variant lifts lightness" />
            <Check ok={cal.darkVariantMutesChroma} label="dark variant mutes chroma" />
          </div>
          <p className="note">
            These checks run in <span className="mono">tools/measure-metrics.mjs</span> against the
            built package. Constant values freeze during release-candidate calibration.
          </p>
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontFamily: "var(--mono)", fontSize: 12.5 }}>
      <span style={{ color: ok ? "#5e9671" : "#c0392b", fontWeight: 700 }}>{ok ? "✓" : "✗"}</span>
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
    </div>
  );
}
