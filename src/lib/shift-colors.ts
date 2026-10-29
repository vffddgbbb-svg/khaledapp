export const SHIFT_COLORS = {
  sky: { label: "سماوي", chip: "bg-shift-sky text-shift-ink", dot: "bg-shift-sky" },
  coral: { label: "مرجاني", chip: "bg-shift-coral text-shift-ink", dot: "bg-shift-coral" },
  mint: { label: "نعناعي", chip: "bg-shift-mint text-shift-ink", dot: "bg-shift-mint" },
  sun: { label: "مشمس", chip: "bg-shift-sun text-shift-ink", dot: "bg-shift-sun" },
  grape: { label: "عنبي", chip: "bg-shift-grape text-shift-ink", dot: "bg-shift-grape" },
  rose: { label: "وردي", chip: "bg-shift-rose text-shift-ink", dot: "bg-shift-rose" },
  slate: { label: "رمادي", chip: "bg-shift-slate text-shift-ink", dot: "bg-shift-slate" },
} as const;

export type ShiftColor = keyof typeof SHIFT_COLORS;
export const SHIFT_COLOR_KEYS = Object.keys(SHIFT_COLORS) as ShiftColor[];

export function colorOf(c: string | null | undefined) {
  return SHIFT_COLORS[(c as ShiftColor) in SHIFT_COLORS ? (c as ShiftColor) : "slate"];
}
