import { Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/app-shell";
import { SignInForm } from "@/components/sign-in-form";

export function Welcome() {
  return <PublicShell><section className="mx-auto w-full max-w-md px-5 pb-8 pt-8 sm:pt-12"><SignInForm /><p className="mt-6 text-center text-xs text-muted-foreground">مالك المشروع؟ <Link to="/setup" className="font-semibold text-primary underline underline-offset-4">الإعداد الأولي</Link></p></section></PublicShell>;
}