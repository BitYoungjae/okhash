import { useState } from "react";

import { hkDisplayLightness, hkWeight, oklchToHex } from "../lib/colorMath";
import { metrics } from "../lib/data";

const SHIPPED_K = metrics.calibration.kHk;
const SHIPPED_ZERO_HUE = metrics.calibration.hkZeroHue;
const ANCHOR_L = 0.7;
const ANCHOR_C = 0.18;
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);

function maxHueFromZero(zeroHue: number): number {
  return (zeroHue + 180) % 360;
}

function SwatchRow({ strength, zeroHue }: { strength: number; zeroHue: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {HUES.map((hue) => {
        const displayL = hkDisplayLightness(ANCHOR_L, ANCHOR_C, hue, strength, zeroHue);
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

function WeightCurve({ zeroHue }: { zeroHue: number }) {
  const width = 300;
  const height = 70;
  const points = Array.from({ length: 73 }, (_, i) => {
    const hue = i * 5;
    const x = (hue / 360) * width;
    const y = height - hkWeight(hue, zeroHue) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const zeroX = (zeroHue / 360) * width;
  const maxX = (maxHueFromZero(zeroHue) / 360) * width;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1={zeroX} y1={0} x2={zeroX} y2={height} stroke="var(--faint)" strokeDasharray="3 3" strokeWidth="1" />
      <line x1={maxX} y1={0} x2={maxX} y2={height} stroke="var(--ink)" strokeDasharray="3 3" strokeWidth="1" />
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
  const [zeroHue, setZeroHue] = useState(SHIPPED_ZERO_HUE);
  const atShipped = strength === SHIPPED_K && zeroHue === SHIPPED_ZERO_HUE;
  const cal = metrics.calibration;
  const maxHue = maxHueFromZero(zeroHue);

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
          the shipped package uses k = {SHIPPED_K}, zero {SHIPPED_ZERO_HUE}°, max{" "}
          {metrics.calibration.hkMaxHue}°
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
                zero hue
              </span>
              <input
                type="range"
                min={60}
                max={160}
                step={1}
                value={zeroHue}
                onChange={(e) => setZeroHue(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="mono" style={{ fontSize: 13, width: 44, textAlign: "right" }}>
                {zeroHue}°
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="label">raw L baseline (k = 0)</span>
            <SwatchRow strength={0} zeroHue={zeroHue} />
            <span className="label" style={{ marginTop: 8 }}>
              corrected L (k = {strength.toFixed(2)})
              {atShipped && (
                <span style={{ color: "var(--faint)" }}> · matches shipped output</span>
              )}
            </span>
            <SwatchRow strength={strength} zeroHue={zeroHue} />
          </div>

          <div>
            <span className="label">w(H) weight · zero {zeroHue}° · max {maxHue}°</span>
            <WeightCurve zeroHue={zeroHue} />
          </div>

          <p className="note">
            Fixed OKLCH anchors at L {ANCHOR_L}, C {ANCHOR_C} across hue, previewed with Lᴅ = L − k ·
            C · ½(1 − cos(H − zero)). Maximum correction lands 180° from the zero hue. This sandbox
            explores the provisional constant; it does not change the installed package.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: "8px 18px" }}>
            <div className="label" style={{ padding: "12px 0 6px" }}>
              provisional constants
            </div>
            <ConstantRow name="k_HK" value={String(cal.kHk)} />
            <ConstantRow name="H-K zero hue" value={`${cal.hkZeroHue}°`} />
            <ConstantRow name="H-K max hue" value={`${cal.hkMaxHue}°`} />
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
