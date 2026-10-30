"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { newFolder, newOfficeDoc, uploadToDrive } from "@/app/actions/drive";
import { useToast } from "@/components/ui/Toast";
import { tt, type TLang } from "@/lib/team-i18n";

export function DriveActions({ lang, parent, live }: { lang: TLang; parent: string; live: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter(), toast = useToast();
  const run = (fn: () => Promise<unknown>) => start(async () => { try { await fn(); router.refresh(); } catch (e) { toast((e as Error).message); } });
  const title = live ? undefined : lang === "ar" ? "يشتغل بعد ربط Microsoft 365" : "Works once Microsoft 365 is connected";
  return (
    <div className="ph-actions">
      <button type="button" className="b quiet" disabled={!live || pending} title={title} onClick={() => { const n = prompt(tt(lang, "newFolder")); if (n) run(() => newFolder(parent, n)); }}>{tt(lang, "newFolder")}</button>
      <label className="b ghost" title={title} style={{ gap: ".25rem", opacity: live ? 1 : 0.4 }}>{tt(lang, "newDoc")}
        <select value="" disabled={!live} aria-label={tt(lang, "newDoc")} style={{ border: 0, background: "transparent", appearance: "none", width: ".75rem" }} onChange={(e) => { const k = e.target.value as "docx"; const n = k && prompt(tt(lang, "name")); if (k && n) run(async () => { const url = await newOfficeDoc(parent, k, n); window.open(url, "_blank", "noopener"); }); }}>
          <option value="">▾</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PowerPoint</option></select></label>
      <label className="b" title={title} style={{ opacity: live ? 1 : 0.4, cursor: live ? "pointer" : "not-allowed" }}>{tt(lang, "upload")}
        <input type="file" className="vh-sr" disabled={!live} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.set("parent", parent); fd.set("file", f); run(() => uploadToDrive(fd)); }} /></label>
    </div>
  );
}
