import { refuseOfflineRegistration } from "@/lib/pwa-policy";

export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  const refused = refuseOfflineRegistration(window.location.hostname, !import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(r => new URL(r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? location.origin).pathname === "/sw.js").map(r => r.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}