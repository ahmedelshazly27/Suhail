import Link from "next/link";
import { DriveActions } from "@/components/team/DriveActions";
import { requireMe } from "@/lib/auth";
import { ago } from "@/lib/dates";
import { DRIVE_FOLDERS, drive, type DriveItem } from "@/lib/m365/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Drive" };
const COLOR: Record<string, string> = { PPT: "var(--accent-ink)", PDF: "var(--st-danger)", XLS: "var(--fg)", DIR: "var(--fg)" };
const Badge = ({ k }: { k: string }) => <span style={{ flex: "none", width: "2.125rem", textAlign: "center", font: "400 .59375rem/1 var(--f-mono)", padding: "3px 0", border: `1px solid ${COLOR[k] ?? "var(--st-review)"}`, color: COLOR[k] ?? "var(--st-review)" }}>{k}</span>;

export default async function Page({ searchParams }: PageProps<"/team/drive">) {
  const me = await requireMe();
  const sp = await searchParams;
  const { lang } = await teamPrefs();
  const d = await drive(me.id);
  const finance = me.team_role === "owner" || me.functions.includes("finance");
  // Finance is hidden from anyone outside owners and the Finance function (SharePoint enforces the same).
  const folders = (await d.folders().catch(() => DRIVE_FOLDERS)).filter((f) => !f.restricted || finance);
  const fid = typeof sp.f === "string" && folders.some((f) => f.id === sp.f) ? sp.f : "root";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const cur = folders.find((f) => f.id === fid);
  // A Microsoft hiccup (or a folder that moved) shows an empty folder, not an error page.
  const [items, recent] = await Promise.all([(q ? d.search(q) : d.list(fid)).catch(() => [] as DriveItem[]), fid === "root" && !q ? d.recent().catch(() => [] as DriveItem[]) : Promise.resolve([] as DriveItem[])]);
  const visible = items.filter((i) => finance || !(i.path.startsWith("/Finance") || (fid === "root" && i.name === "Finance")));
  const db = await supabaseServer();
  const { data: links } = await db.from("file_links").select("drive_item_id,web_url,entity_type,entity_id");
  const used = (i: DriveItem) => (links || []).filter((l) => l.drive_item_id === i.id || (l.web_url === i.webUrl && i.webUrl !== "#")).map((l) => l.entity_type).join(", ");
  return (
    <div className="mailwrap drivewrap">
      <nav className="mb-col" aria-label={lang === "ar" ? "المجلدات" : "Folders"}>
        <span className="side-label">{lang === "ar" ? "الملفات المشتركة" : "Shared drive"}</span>
        <Link className="side-item" href="/team/drive" aria-current={fid === "root" && !q ? "page" : undefined}>{lang === "ar" ? "كل الملفات" : "All files"}</Link>
        {folders.map((f) => <Link key={f.id} className="side-item" href={`/team/drive?f=${encodeURIComponent(f.id)}`} aria-current={fid === f.id ? "page" : undefined}><span>{f.name}</span>{f.restricted ? <span className="n">{lang === "ar" ? "مقفل" : "lock"}</span> : null}</Link>)}
        <p className="foot">{lang === "ar" ? "محفوظة في SharePoint، وتظهر بعد في Teams وOneDrive ومستكشف الملفات." : "Lives in SharePoint, so it also shows up in Teams, OneDrive and File Explorer."}</p>
      </nav>
      <section className="drive-main">
        <header className="ph">
          <div className="ph-t"><span className="eb">{tt(lang, "drive")} / {cur?.name ?? (lang === "ar" ? "كل الملفات" : "All files")}</span><h1>{q ? `"${q}"` : cur?.name ?? (lang === "ar" ? "كل الملفات" : "All files")}</h1><span className="muted" style={{ fontSize: ".8125rem" }}>{cur?.access ?? (lang === "ar" ? "كل فريق سهيل" : "Everyone in the Suhail team")}</span></div>
          <DriveActions lang={lang} parent={fid} live={d.live} />
        </header>
        {!d.live ? <p className="chip attn" style={{ alignSelf: "flex-start" }}>{lang === "ar" ? "ملفات تجريبية. المكتبة الحقيقية تظهر بعد ربط Microsoft 365." : "Sample files. The real library appears once Microsoft 365 is connected."}</p> : null}
        <form><input name="q" className="inp" defaultValue={q} placeholder={lang === "ar" ? "ابحث في كل الملفات، حتى داخل المستندات" : "Search every file, including inside documents"} aria-label={tt(lang, "search")} style={{ padding: ".75rem .875rem" }} /></form>
        {recent.length ? <>
          <span className="sect-h" style={{ border: 0, padding: 0 }}>{tt(lang, "recent")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))", gap: ".75rem" }}>
            {recent.map((r) => <a key={r.id} href={r.webUrl} target="_blank" rel="noreferrer" className="card pad" style={{ textDecoration: "none", gap: ".5rem" }}><span style={{ height: "4rem", display: "grid", placeItems: "center", background: "var(--soft)", font: "400 .6875rem/1 var(--f-mono)", color: COLOR[r.kind] ?? "var(--st-review)" }}>{r.kind}</span><span className="ell">{r.name}</span><span className="muted" style={{ fontSize: ".75rem" }}>{r.by} · {ago(lang, r.modified)}</span></a>)}
          </div></> : null}
        <div className="card"><div className="tbl-wrap" tabIndex={0}><table className="tbl" style={{ margin: "0 1rem", width: "calc(100% - 2rem)" }}>
          <thead><tr><th>{tt(lang, "name")}</th><th>{lang === "ar" ? "آخر تعديل" : "Modified"}</th><th>{lang === "ar" ? "من" : "By"}</th><th>{tt(lang, "usedIn")}</th></tr></thead>
          <tbody>{visible.map((i) => (
            <tr key={i.id}><td>{i.kind === "DIR" ? <Link href={`/team/drive?f=${encodeURIComponent(i.id)}`} style={{ display: "flex", gap: ".625rem", alignItems: "center", textDecoration: "none" }}><Badge k={i.kind} />{i.name}</Link> : <a href={i.webUrl} target="_blank" rel="noreferrer" style={{ display: "flex", gap: ".625rem", alignItems: "center", textDecoration: "none" }}><Badge k={i.kind} />{i.name}</a>}</td>
              <td className="muted">{ago(lang, i.modified)}</td><td>{i.by}</td><td className="muted">{i.kind === "DIR" ? (i.children != null ? `${i.children} ${lang === "ar" ? "ملف" : "files"}` : "") : used(i)}</td></tr>))}</tbody>
        </table></div>{!visible.length ? <div className="card-f">{tt(lang, "emptyList")}</div> : null}</div>
        <p className="muted" style={{ fontSize: ".78rem" }}>{lang === "ar" ? "فتح أي ملف يعدّله في Word أو Excel أو PowerPoint على الويب، مع أي أحد فاتحه. وأي ملف تقدر ترفقه بمهمة أو شريك أو إيميل بدون ما تسوي نسخة." : "Opening a file edits it in Word, Excel or PowerPoint on the web, together with whoever else has it open. Every file can be attached to a ticket, a partner or an email without making a copy."}</p>
      </section>
    </div>
  );
}
