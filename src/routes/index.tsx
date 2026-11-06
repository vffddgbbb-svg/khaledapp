import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Welcome } from "@/components/welcome";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رفيق المناوبات — مساحة فريقك" },
      { name: "description", content: "مساحة عربية لفريقك لعرض المناوبات وطلبات التبديل." },
      { property: "og:title", content: "رفيق المناوبات — مساحة فريقك" },
      { property: "og:description", content: "مساحة عربية لفريقك لعرض المناوبات وطلبات التبديل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});
function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);
  return <Welcome />;
}
