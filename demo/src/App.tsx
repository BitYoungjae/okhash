import { useEffect, useMemo, useRef, useState } from "react";
import { createColorHash } from "okhash";

import {
  Chip,
  copy,
  demoForeground,
  IconArrowDown,
  IconCopy,
  IconGitHub,
  IconMenu,
  IconX,
  initials,
  sampleNames,
  Section,
  Toggle,
  type SharedState,
} from "./components/primitives";
import { facts, MOOD_NAMES, metrics, bench } from "./lib/data";
import { Playground } from "./sections/Playground";
import { SetHarmony, MoodGallery, PaletteLab } from "./sections/Showcases";
import { Distribution } from "./sections/Distribution";
import { ForegroundDemo, DarkVariant, CvdDemo, HkDemo } from "./sections/Science";
import { Calibration } from "./sections/Calibration";
import { DxCode, Capabilities, ComparisonTable } from "./sections/Dx";

const NAV_LINKS = [
  { id: "playground", label: "playground" },
  { id: "distribution", label: "distribution" },
  { id: "science", label: "color science" },
  { id: "api", label: "api" },
];

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => setMenuOpen(false);

  // Scroll-spy + reading progress: tie the nav to the section in view, and
  // draw a precise progress line — fitting for a library about measurement.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollY = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, scrollY / max) : 0);
      const probe = scrollY + 140;
      let current = "";
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= probe) current = id;
      }
      if (max - scrollY < 4) current = NAV_LINKS[NAV_LINKS.length - 1].id;
      setActiveId(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Dismiss the mobile menu on Escape or a tap outside the bar.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  // Collapse the menu when the layout grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 681px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toTop = () => {
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="nav" ref={navRef}>
      <div className="wrap nav-inner">
        <button type="button" className="mono nav-brand" onClick={toTop}>
          okhash
        </button>
        <div id="primary-navigation" className="chiprow nav-links" data-open={menuOpen}>
          {NAV_LINKS.map(({ id, label }) => (
            <a
              key={id}
              className="chip"
              href={`#${id}`}
              data-active={activeId === id}
              onClick={closeMenu}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <a
            className="chip nav-icon-link"
            href="https://github.com/BitYoungjae/okhash"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            title="GitHub repository"
          >
            <IconGitHub size={15} />
          </a>
          <button
            type="button"
            className="chip nav-menu-button"
            data-open={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <IconX size={15} /> : <IconMenu size={15} />}
          </button>
        </div>
      </div>
      <div className="nav-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
    </div>
  );
}

function Marquee() {
  const topNames = useMemo(() => sampleNames(15, 42), []);
  const bottomNames = useMemo(() => sampleNames(15, 84), []);
  const hasher = useMemo(() => createColorHash(), []);
  const Row = ({ names }: { names: string[] }) => (
    <div className="marquee-row">
      {names.map((n, i) => {
        const c = hasher(n);
        return (
          <span
            key={`${n}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              flex: "none",
              border: "1px solid var(--line-2)",
              borderRadius: 100,
              padding: "6px 15px 6px 7px",
              background: "var(--card)",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: c.hex(),
                color: demoForeground(c),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--mono)",
                fontSize: 10,
              }}
            >
              {initials(n)}
            </span>
            <span className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
              {n}
            </span>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="hero-marquee" aria-label="Example names mapped to deterministic colors">
      <div className="marquee-track marquee-track-forward">
        <Row names={topNames} />
        <Row names={topNames} />
      </div>
      <div className="marquee-track marquee-track-reverse">
        <Row names={bottomNames} />
        <Row names={bottomNames} />
      </div>
    </div>
  );
}

function Hero() {
  const stats: Array<[string, string]> = [
    [facts.latency, "per color"],
    [`χ² ${facts.chiSquare}`, "even hue spread"],
    [facts.gamut, "out of gamut"],
    [facts.coreSize, "gzip core, zero deps"],
  ];
  return (
    <header style={{ paddingTop: 78, paddingBottom: 32 }}>
      <div className="wrap">
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          deterministic · perceptual · output-stable
        </div>
        <h1
          style={{
            fontSize: "clamp(40px,7vw,84px)",
            fontWeight: 700,
            letterSpacing: "-.035em",
            lineHeight: 0.98,
            margin: "0 0 26px",
            maxWidth: "16ch",
          }}
        >
          A string goes in. The{" "}
          <em style={{ fontStyle: "normal", color: "#2a889e" }}>same</em>{" "}
          <em style={{ fontStyle: "normal", color: "#a293cb" }}>color</em> comes out.{" "}
          <span style={{ color: "var(--faint)" }}>Every time.</span>
        </h1>
        <p
          style={{
            fontSize: "clamp(16px,1.7vw,20px)",
            color: "var(--ink-2)",
            maxWidth: "58ch",
            margin: "0 0 34px",
            lineHeight: 1.5,
          }}
        >
          okhash maps any name, id, or tag to a color in{" "}
          <span className="mono" style={{ fontSize: ".9em" }}>
            OKLCH
          </span>
          : perceptually even, corrected for how eyes read brightness, and identical across every
          runtime and release.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 46 }}>
          <a
            className="btn"
            href="#playground"
            style={{ padding: "12px 22px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 9 }}
          >
            try the playground <IconArrowDown size={14} />
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "12px 22px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 9 }}
            onClick={() => copy("npm i okhash", "")}
          >
            npm i okhash <IconCopy size={14} />
          </button>
        </div>
        <div className="statgrid" style={{ marginBottom: 42 }}>
          {stats.map(([a, b]) => (
            <div key={b}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-.02em" }}>
                {a}
              </div>
              <div className="label" style={{ marginTop: 4 }}>
                {b}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Marquee />
    </header>
  );
}

function ControlBar({
  shared,
  setShared,
}: {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}) {
  const set = (patch: Partial<SharedState>) => setShared((s) => ({ ...s, ...patch }));
  return (
    <div
      className="card"
      style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 26 }}
    >
      <span className="label" style={{ marginRight: 2 }}>
        mood
      </span>
      <div className="chiprow">
        {MOOD_NAMES.map((m) => (
          <Chip key={m} on={shared.mood === m} onClick={() => set({ mood: m })}>
            {m}
          </Chip>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
        <Toggle on={shared.dark} onClick={() => set({ dark: !shared.dark, userSetDark: true })}>
          dark
        </Toggle>
        <Toggle on={shared.hk} onClick={() => set({ hk: !shared.hk })}>
          H-K
        </Toggle>
      </div>
    </div>
  );
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export default function App() {
  const [shared, setShared] = useState<SharedState>(() => ({
    mood: "balanced",
    dark: prefersDark(),
    hk: true,
    seed: 0,
    userSetDark: false,
  }));

  useEffect(() => {
    document.documentElement.dataset.theme = shared.dark ? "dark" : "light";
  }, [shared.dark]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setShared((s) => (s.userSetDark ? s : { ...s, dark: e.matches }));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div>
      <Nav />
      <Hero />

      <Section
        id="playground"
        num="01"
        title="The playground"
        sub="Type anything. okhash maps each keystroke to a color as you type: no network, no randomness, the same result on every run."
      >
        <ControlBar shared={shared} setShared={setShared} />
        <Playground shared={shared} />
      </Section>

      <Section
        id="harmony"
        num="02"
        title="Built for sets, not single colors"
        sub="The main use case is many colors side by side: avatars, tags, content cards, a legend. Uniform-chroma moods keep the whole set perceptually even; relative-chroma moods trade some evenness for extra vividness."
      >
        <SetHarmony shared={shared} />
      </Section>

      <Section
        num="03"
        title="Six moods, one mechanism"
        sub="A mood is a named bundle of channel specs, chroma mode, and hue weights. The same six names, rendered through each."
      >
        <MoodGallery />
      </Section>

      <Section
        num="04"
        title="Palettes from a seed"
        sub="For N harmonious colors instead of a per-string map, the golden angle spaces hues evenly at any count."
      >
        <PaletteLab />
      </Section>

      <Section
        id="distribution"
        num="05"
        title="An even spread, measured"
        sub="Good distribution means similar strings do not map to similar colors. Hashing runs live in your browser; the headline figures come from the repository's measurement command."
      >
        <Distribution />
      </Section>

      <Section
        id="science"
        num="06"
        title="Perceptual foreground"
        sub="The default foreground compares black and white in OKLab lightness space; the natural preset adds WCAG boundary colors for softer readable UI text."
      >
        <ForegroundDemo />
      </Section>

      <Section
        num="07"
        title="Dark surface, same identity"
        sub="Simultaneous contrast makes the same color look different on dark backgrounds. variant('dark') lifts lightness and pulls chroma: same hue, right clothing."
      >
        <DarkVariant />
      </Section>

      <Section
        num="08"
        title="Color-vision-safe in one flag"
        sub="cvdSafe locks hue to the blue↔orange axis and widens lightness, so colors stay distinct under every type of color blindness. The simulations use Machado matrices."
      >
        <CvdDemo />
      </Section>

      <Section
        num="09"
        title="Helmholtz–Kohlrausch correction"
        sub="At equal OKLCH lightness, saturated blues and violets look brighter than they measure. okhash corrects the displayed lightness so a set reads evenly bright."
      >
        <HkDemo />
      </Section>

      <Section
        id="calibration"
        num="10"
        title="Calibration sandbox"
        sub="A few constants are provisional and freeze at the release candidate. Explore how the H-K strength shapes the result; the installed package uses the shipped value."
      >
        <Calibration />
      </Section>

      <Section
        id="api"
        num="11"
        title="The developer experience"
        sub="Named exports, full types, one obvious way to do everything. No default export, no dual-package hazard."
      >
        <DxCode />
      </Section>

      <Section
        num="12"
        title="What you get"
        sub="okhash's capabilities and its measured size and speed. Other string-to-color libraries optimize for different goals."
      >
        <Capabilities />
        <div style={{ marginTop: 24 }}>
          <ComparisonTable />
        </div>
      </Section>

      <footer style={{ borderTop: "1px solid var(--line-2)", padding: "48px 0 70px" }}>
        <div
          className="wrap"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}
        >
          <div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
              okhash
            </div>
            <p className="mono" style={{ fontSize: 12, color: "var(--faint)", maxWidth: "42ch", lineHeight: 1.6, margin: 0 }}>
              Deterministic string → color in a perceptual space. Same input, same color, enforced
              by a golden contract and ECMA-262 only.
            </p>
          </div>
          <div className="chiprow">
            <button type="button" className="chip" onClick={() => copy("npm i okhash", "")}>
              npm i okhash
            </button>
            <span className="chip">MIT</span>
            <span className="chip">ESM · zero deps</span>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 20 }}>
          <p className="mono" style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
            All figures generated from this repository: latency from bench, distribution and size
            from the measurement tool, on Node {bench.node}. Stability over{" "}
            {metrics.stability.checks.toLocaleString()} checks: {metrics.stability.determinismMismatches}{" "}
            determinism and {metrics.stability.cssIdentityMismatches} css-identity mismatches.
          </p>
        </div>
      </footer>
    </div>
  );
}
