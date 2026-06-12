import { type ReactNode, useMemo, useRef } from "react";
import {
  createColorHash,
  type Color,
  type ColorHashFn,
  type ForegroundOptions,
  type OkhashOptions,
} from "okhash";

// A pool of fictional names across scripts/localizations. Mixed on purpose: it
// doubles as a stress test for hashing arbitrary Unicode.
export const NAMES = [
  "Eleanor Finch", "Oliver Hart", "Kira", "Artoria", "Cassie Wren", "Theo Marsh",
  "김도윤", "이서연", "박지훈", "정하늘", "키라", "アルトリア", "서가은", "주영재",
  "青葉ミナト", "花咲ユメ", "キラ", "아르토리아", "黒沢ミサキ", "白瀬カナデ",
  "林婉清", "江晨", "基拉", "阿尔托莉雅", "苏沐然", "BitYoungjae",
  "Mateo Solís", "Lucía Vega", "Diego Herrera", "Valeria Cruz", "Santiago Rey",
  "Camille Laurent", "Théo Moreau", "Lena Brandt", "Layla Karim", "Omar Najjar",
  "Mikhail Volkov", "Anya Sokolova", "Giulia Conti", "Rafael Costa", "Linh Nguyễn",
  "Aarav Mehta", "Priya Nair",
];

export const MOOD_LABELS: Record<string, string> = {
  balanced: "set-uniform · default",
  pastel: "soft · low chroma",
  vibrant: "relative · punchy",
  jewel: "deep · dark L",
  earth: "warm-weighted hue",
  neon: "max chroma · H-K",
};

export const DEMO_FOREGROUND_OPTIONS = {
  preset: "natural",
} satisfies ForegroundOptions;

export function demoForeground(color: Color): string {
  return color.foreground(DEMO_FOREGROUND_OPTIONS);
}

export function randName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

// Deterministic name subset for a given seed (stable across renders).
export function sampleNames(n: number, seed: number): string[] {
  let state = seed || 1;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const out: string[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < n && out.length < NAMES.length && guard < 5000) {
    guard += 1;
    const name = NAMES[Math.floor(next() * NAMES.length)];
    if (!used.has(name)) {
      used.add(name);
      out.push(name);
    }
  }
  return out;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
}

export function copy(text: string, label?: string): void {
  if (navigator.clipboard) void navigator.clipboard.writeText(text);
  toast(`${label ?? "copied"}  ${text}`);
}

export function useHasher(options: OkhashOptions): ColorHashFn {
  // Memoize on the serialized options so a configured instance (and any LUTs it
  // builds) is reused across renders until the options actually change.
  const key = JSON.stringify(options);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  return useMemo(() => createColorHash(optionsRef.current), [key]);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const single = parts[0];
    if (/[぀-ヿ㐀-鿿가-힯豈-﫿]/.test(single)) {
      return single.slice(-2);
    }
    return single.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

function Icon({ children, size = 15, style }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", display: "block", ...style }}
    >
      {children}
    </svg>
  );
}

export const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
  </Icon>
);
export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="6" width="7.5" height="7.5" rx="1.5" />
    <path d="M2.5 10v-5.5a2 2 0 0 1 2-2H10" />
  </Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 8a6 6 0 1 1-6-6c1.7 0 3.3.7 4.5 1.8L14 5.3" />
    <path d="M14 2v3.3h-3.3" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5 6.4 12 13 4.5" />
  </Icon>
);

interface SectionProps {
  num: string;
  title: string;
  sub?: string;
  id?: string;
  controls?: ReactNode;
  children: ReactNode;
}

export function Section({ num, title, sub, id, controls, children }: SectionProps) {
  return (
    <section className="section" id={id}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-num">{num}</span>
          <div className="sec-head-text">
            <h2 className="sec-title">{title}</h2>
            {sub && <p className="sec-sub">{sub}</p>}
          </div>
          {controls && <div style={{ marginLeft: "auto" }}>{controls}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Chip({
  on,
  onClick,
  children,
}: {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button className="chip" data-on={!!on} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export function Toggle({
  on,
  onClick,
  children,
}: {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button className="toggle" data-on={!!on} onClick={onClick} type="button">
      <span className="switch" />
      {children}
    </button>
  );
}

export function Avatar({
  name,
  hasher,
  size = 52,
  square = false,
  title,
}: {
  name: string;
  hasher: ColorHashFn;
  size?: number;
  square?: boolean;
  title?: string;
}) {
  const color = hasher(name);
  const bg = color.hex();
  const fg = demoForeground(color);
  return (
    <div
      title={title ?? `${name}  ${bg}`}
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: square ? Math.round(size * 0.28) : "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--mono)",
        fontWeight: 500,
        fontSize: Math.round(size * 0.32),
        letterSpacing: "-.02em",
      }}
    >
      {initials(name)}
    </div>
  );
}

export function Tag({ name, hasher }: { name: string; hasher: ColorHashFn }) {
  const color = hasher(name);
  return (
    <span
      style={{
        background: color.hex(),
        color: demoForeground(color),
        fontFamily: "var(--mono)",
        fontSize: 13,
        padding: "5px 13px",
        borderRadius: 100,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

export interface SharedState {
  mood: string;
  dark: boolean;
  hk: boolean;
  seed: number;
  userSetDark: boolean;
}

export function hasherOptions(shared: SharedState): OkhashOptions {
  return {
    mood: shared.mood as OkhashOptions["mood"],
    hk: shared.hk,
    surface: shared.dark ? "dark" : "light",
    seed: shared.seed,
  };
}
