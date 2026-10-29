import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/components/welcome";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "تسجيل الدخول — رفيق المناوبات" }, { name: "description", content: "دخول أعضاء الفريق إلى رفيق المناوبات." },
    { property: "og:title", content: "تسجيل الدخول — رفيق المناوبات" }, { property: "og:description", content: "دخول أعضاء الفريق إلى رفيق المناوبات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Welcome,
});
