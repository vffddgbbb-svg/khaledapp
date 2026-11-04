import { Activity, ClipboardList, Droplets, NotebookPen, Pill, Siren, Stethoscope } from "lucide-react";

/** Doctor-companion modules. Only "shifts" is implemented; the rest are honest placeholders. */
export const COMPANION_MODULES = [
  { slug: "emergency", label: "تقييم الإسعاف", icon: Siren, ready: false },
  { slug: "blood-bank", label: "بنك الدم", icon: Droplets, ready: false },
  { slug: "handoff", label: "التسليم والاستلام", icon: ClipboardList, ready: false },
  { slug: "notes", label: "الملاحظات", icon: NotebookPen, ready: false },
  { slug: "medications", label: "الأدوية", icon: Pill, ready: false },
  { slug: "follow-up", label: "متابعة المرضى", icon: Stethoscope, ready: false },
] as const;

export const SHIFTS_ICON = Activity;

export function findModule(slug: string) {
  return COMPANION_MODULES.find((m) => m.slug === slug);
}
