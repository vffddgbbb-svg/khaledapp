import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
