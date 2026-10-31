import { useEffect, useState } from "react";
import { Download, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches);
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", handler); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (!prompt && !ios) return null;
  return <><Button variant="outline" size="sm" onClick={async () => { if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); } else setOpen(true); }}><Download />تثبيت التطبيق</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة رفيق المناوبات إلى iPhone</DialogTitle><DialogDescription>افتح هذا الموقع في Safari، ثم أضفه إلى الشاشة الرئيسية.</DialogDescription></DialogHeader><p className="flex gap-2"><Share />اضغط مشاركة</p><p className="flex gap-2"><PlusSquare />اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</p></DialogContent></Dialog></>;
}