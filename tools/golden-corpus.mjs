export const GOLDEN_CASES = [
  { name: "default", options: {} },
  { name: "mood-balanced", options: { mood: "balanced" } },
  { name: "mood-pastel", options: { mood: "pastel" } },
  { name: "mood-vibrant", options: { mood: "vibrant" } },
  { name: "mood-jewel", options: { mood: "jewel" } },
  { name: "mood-earth", options: { mood: "earth" } },
  { name: "mood-neon", options: { mood: "neon" } },
  { name: "cvd-safe", options: { cvdSafe: true } },
  { name: "surface-light", options: { surface: "light" } },
  { name: "surface-dark", options: { surface: "dark" } },
  { name: "seed-1", options: { seed: 1 } },
  { name: "seed-c0ffee", options: { seed: 0xc0ffee } },
  { name: "hk-off", options: { hk: false } },
];

const ASCII_NAME_STEMS = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Mallory",
  "Niaj",
  "Olivia",
  "Peggy",
  "Rupert",
  "Sybil",
  "Trent",
  "Uma",
  "Victor",
  "Wendy",
];

const EMAIL_DOMAINS = ["example.com", "okhash.test", "colors.dev", "mail.invalid"];
const KOREAN_SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const KOREAN_GIVEN = [
  "민준",
  "서연",
  "지훈",
  "하은",
  "도윤",
  "지우",
  "서준",
  "예린",
  "현우",
  "수아",
];
const CJK_BASES = [
  "東京",
  "大阪",
  "京都",
  "北京",
  "上海",
  "深圳",
  "台北",
  "香港",
  "新加坡",
  "漢字",
];
const EMOJI_INPUTS = [
  "😀",
  "😎",
  "🥳",
  "🚀",
  "🌈",
  "🎨",
  "🔥",
  "💧",
  "🍀",
  "⚡",
  "👩‍💻",
  "👨‍👩‍👧‍👦",
  "🏳️‍🌈",
  "🧪",
  "🛰️",
  "🧭",
  "🧵",
  "🪄",
  "🧱",
  "🧬",
  "🫧",
  "🪐",
  "⭐",
  "☕",
  "🎯",
  "🧊",
  "🪩",
  "🧰",
  "💡",
  "🔒",
];
const COMBINING_PAIRS = [
  ["e\u0301", "\u00e9"],
  ["a\u0301", "\u00e1"],
  ["i\u0301", "\u00ed"],
  ["o\u0301", "\u00f3"],
  ["u\u0301", "\u00fa"],
  ["n\u0303", "\u00f1"],
  ["A\u030a", "\u00c5"],
  ["c\u0327", "\u00e7"],
  ["o\u0308", "\u00f6"],
  ["u\u0308", "\u00fc"],
  ["E\u0301", "\u00c9"],
  ["O\u0308", "\u00d6"],
  ["s\u030c", "\u0161"],
  ["z\u030c", "\u017e"],
  ["y\u0301", "\u00fd"],
  ["C\u0327", "\u00c7"],
  ["I\u0307", "\u0130"],
  ["g\u0306", "\u011f"],
  ["r\u030c", "\u0159"],
  ["l\u0327", "\u013c"],
];
const WHITESPACE_AND_CONTROL = [
  " ",
  "\t",
  "\n",
  "\r\n",
  " leading",
  "trailing ",
  "two  spaces",
  "\u00a0",
  "\u200b",
  "\u200d",
  "\u2028",
  "\u2029",
  "\u0000",
  "\u0001",
  "\u001f",
  "line\nbreak",
  "tab\tseparated",
  "carriage\rreturn",
  "mix \t \n",
  "  padded  ",
];

export function buildGoldenInputs() {
  const inputs = [
    "",
    ...Array.from(
      { length: 100 },
      (_, index) =>
        `${ASCII_NAME_STEMS[index % ASCII_NAME_STEMS.length]}-${index.toString().padStart(3, "0")}`,
    ),
    ...Array.from({ length: 100 }, (_, index) => {
      const local = `${ASCII_NAME_STEMS[index % ASCII_NAME_STEMS.length].toLowerCase()}${index}`;
      return `${local}@${EMAIL_DOMAINS[index % EMAIL_DOMAINS.length]}`;
    }),
    ...Array.from({ length: 100 }, (_, index) => {
      const hex = index.toString(16).padStart(12, "0");
      const tail = `${hex}${hex}`.slice(0, 12);
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(1, 4)}-8${hex.slice(4, 7)}-${tail}`;
    }),
    ...Array.from(
      { length: 50 },
      (_, index) =>
        `${KOREAN_SURNAMES[index % KOREAN_SURNAMES.length]}${
          KOREAN_GIVEN[Math.floor(index / KOREAN_SURNAMES.length) % KOREAN_GIVEN.length]
        }`,
    ),
    ...Array.from({ length: 30 }, (_, index) => `${CJK_BASES[index % CJK_BASES.length]}-${index}`),
    ...EMOJI_INPUTS,
    ...COMBINING_PAIRS.flat(),
    ...Array.from({ length: 128 }, (_, index) => String.fromCharCode(index)),
    ...Array.from(
      { length: 5 },
      (_, index) => `long-${index}-` + "okhash deterministic color ".repeat(80 + index * 20),
    ),
    ...WHITESPACE_AND_CONTROL,
  ];

  return [...new Set(inputs)];
}
