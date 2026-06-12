import { useMemo, useState } from "react";
import { createColorHash } from "okhash";

import { Avatar, Chip, sampleNames, Toggle, useHasher } from "../components/primitives";
import {
  type CvdType,
  type ForegroundMetric,
  foregroundFor,
  hexToRgb,
  rgbToHex,
  simulateCvd,
} from "../lib/colorMath";

export function ForegroundDemo() {
  const [metric, setMetric] = useState<ForegroundMetric>("auto");
  const grays: number[] = [];
  for (let v = 0x4c; v <= 0x9a; v += 6) grays.push(v);
  return (
    <div>
      <div className="chiprow" style={{ marginBottom: 18 }}>
        <Chip on={metric === "auto"} onClick={() => setMetric("auto")}>
          metric: auto · |ΔL_OK|
        </Chip>
        <Chip on={metric === "wcag2"} onClick={() => setMetric("wcag2")}>
          metric: wcag2
        </Chip>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", borderRadius: 9, overflow: "hidden", border: "1px solid var(--line-2)" }}>
          {grays.map((v) => {
            const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
            const fg = foregroundFor(hexToRgb(hex), metric);
            return (
              <div
                key={v}
                style={{
                  flex: 1,
                  background: hex,
                  color: fg,
                  height: 76,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                }}
              >
                Aa
              </div>
            );
          })}
        </div>
        <p className="note">
          auto flips to black text near #646464; wcag2 holds white down to #767676. okhash defaults
          to auto.
        </p>
      </div>
    </div>
  );
}

export function DarkVariant() {
  const names = useMemo(() => sampleNames(7, 11), []);
  const light = useMemo(() => createColorHash({ surface: "light" }), []);
  const dark = useMemo(() => createColorHash({ surface: "dark" }), []);

  const Column = ({
    label,
    hasher,
    bg,
    onDark,
  }: {
    label: string;
    hasher: ReturnType<typeof createColorHash>;
    bg: string;
    onDark: boolean;
  }) => (
    <div style={{ flex: 1, background: bg, borderRadius: 12, padding: 20, border: "1px solid var(--line-2)" }}>
      <div className="label" style={{ color: onDark ? "#86847b" : "#8a887e", marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {names.map((n) => {
          const c = hasher(n);
          return (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Avatar name={n} hasher={hasher} size={34} square />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12.5,
                  color: onDark ? "#d6d4cc" : "#191a1d",
                }}
              >
                {n}
              </span>
              <span
                className="mono"
                style={{ fontSize: 11, color: onDark ? "#7d7b72" : "#8a887e", marginLeft: "auto" }}
              >
                {c.hex()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="dual" style={{ display: "flex", gap: 16 }}>
      <Column label="surface: light" hasher={light} bg="#fbfaf6" onDark={false} />
      <Column
        label="surface: dark — same identity, lifted and muted"
        hasher={dark}
        bg="#16171b"
        onDark
      />
    </div>
  );
}

const CVD_SIMS: Array<[CvdType | "normal", string]> = [
  ["normal", "normal vision"],
  ["deutan", "deuteranopia"],
  ["protan", "protanopia"],
  ["tritan", "tritanopia"],
];

export function CvdDemo() {
  const [safe, setSafe] = useState(false);
  const [sim, setSim] = useState<CvdType | "normal">("normal");
  const names = useMemo(() => sampleNames(18, 5), []);
  const hasher = useHasher({ cvdSafe: safe });
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <Toggle on={safe} onClick={() => setSafe((s) => !s)}>
          cvdSafe: {safe ? "true" : "false"}
        </Toggle>
        <div className="chiprow" style={{ marginLeft: "auto" }}>
          {CVD_SIMS.map(([key, label]) => (
            <Chip key={key} on={sim === key} onClick={() => setSim(key)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 9 }}>
          {names.map((n) => {
            const base = hasher(n).rgb();
            const shown = sim === "normal" ? base : simulateCvd(base, sim);
            return (
              <div
                key={n}
                title={n}
                style={{ aspectRatio: "1", borderRadius: 9, background: rgbToHex(shown) }}
              />
            );
          })}
        </div>
        <p className="note">
          {safe
            ? "cvdSafe locks hue to the blue↔orange axis and widens lightness, so swatches stay distinct under every simulation."
            : "default mood — pick a simulation and watch some greens and reds drift together. Then turn cvdSafe on."}
        </p>
      </div>
    </div>
  );
}

export function HkDemo() {
  const names = ["Indigo", "Violet", "Cobalt", "Plum", "Azure", "Iris", "Slate", "Mauve", "Denim", "Lilac"];
  const raw = useMemo(() => createColorHash({ hk: false }), []);
  const corrected = useMemo(() => createColorHash({ hk: true }), []);

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div className="label" style={{ marginBottom: 10 }}>
          split swatches: left raw OKLCH L, right HK-corrected display L.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))", gap: 8 }}>
          {names.map((n) => {
            const before = raw(n);
            const after = corrected(n);
            const beforeHex = before.hex();
            const afterHex = after.hex();
            return (
              <div
                key={n}
                title={`${n} raw ${beforeHex} · hk ${afterHex}`}
                style={{
                  height: 72,
                  borderRadius: 8,
                  background: `linear-gradient(90deg, ${beforeHex} 0 50%, ${afterHex} 50% 100%)`,
                  boxShadow: "inset 1px 0 rgb(255 255 255 / 0.16), inset -1px 0 rgb(0 0 0 / 0.18)",
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    insetBlock: 0,
                    left: "50%",
                    width: 1,
                    background: "rgb(255 255 255 / 0.42)",
                    boxShadow: "1px 0 rgb(0 0 0 / 0.18)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <p className="note">
        Lᴅ = Lₙ − 0.32 · C · ½(1 − cos(H − 110°)) darkens blue and violet where the eye over-reads
        them. 110° is the zero point; the strongest correction is near 290°.
      </p>
    </div>
  );
}
