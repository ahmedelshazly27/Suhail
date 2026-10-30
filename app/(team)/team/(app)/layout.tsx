import { redirect } from "next/navigation";
import { MobileNav } from "@/components/team/MobileNav";
import { Palette } from "@/components/team/Palette";
import { Sidebar } from "@/components/team/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { requireMe } from "@/lib/auth";
import { getShell } from "@/lib/data/shell";
import { m365Live } from "@/lib/m365/graph";
import { teamPrefs } from "@/lib/team-prefs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (!me.onboarded_at) redirect("/team/welcome");
  const [{ lang }, shell] = await Promise.all([teamPrefs(), getShell(me.id)]);
  return (
    <ToastProvider>
      <div className="shell">
        <div className="shell-side"><Sidebar lang={lang} me={me} counts={shell.counts} projects={shell.projects} m365={m365Live()} /></div>
        <main className="shell-main" id="main">
          <MobileNav lang={lang} me={me} inbox={shell.counts.inbox} />
          <div className="dither dither-corner" aria-hidden="true" />
          {children}
        </main>
      </div>
      <Palette lang={lang} projects={shell.projects} />
    </ToastProvider>
  );
}
