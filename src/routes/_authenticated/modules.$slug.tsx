import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { findModule } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/modules/$slug")({
  head: () => ({
    meta: [
      { title: "وحدة قيد التجهيز — رفيق الطبيب" },
      { name: "description", content: "هذه الوحدة من رفيق الطبيب قيد التجهيز ولم تُفعّل بعد." },
      { property: "og:title", content: "وحدة قيد التجهيز — رفيق الطبيب" },
      { property: "og:description", content: "هذه الوحدة من رفيق الطبيب قيد التجهيز ولم تُفعّل بعد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const mod = findModule(slug);
  const title = mod?.label ?? "وحدة غير معروفة";
  return (
    <AppShell title={title} subtitle="قيد التجهيز">
      <EmptyState title={mod ? `${title} — قيد التجهيز` : "هذه الوحدة غير موجودة"} icon={<Hourglass className="size-7" aria-hidden />}>
        <p>
          هذه الوحدة لم تُبنَ بعد، ولا تقدم أي حسابات أو توصيات طبية. لا تعتمد عليها في القرار السريري.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/home">العودة إلى الرئيسية</Link>
        </Button>
      </EmptyState>
    </AppShell>
  );
}
