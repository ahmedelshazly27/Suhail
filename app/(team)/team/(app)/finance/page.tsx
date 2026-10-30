import { Finance, type Budget, type Exp } from "@/components/team/Finance";
import { requireMe } from "@/lib/auth";
import { getShell } from "@/lib/data/shell";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Budget and expenses" };

export default async function Page() {
  const me = await requireMe();
  const db = await supabaseServer();
  const [{ lang }, shell, { data: projects }, { data: expenses }, { data: cats }] = await Promise.all([teamPrefs(), getShell(me.id),
    db.from("projects").select("id,name,budget,currency").not("budget", "is", null).neq("status", "done").order("sort"),
    db.from("expenses").select("id,description,amount,currency,status,spent_on,project_id,created_by,receipt_url,receipt_path").order("spent_on", { ascending: false }).limit(200),
    db.from("expense_categories").select("key,name").order("name")]);
  const { data: settings } = await db.from("settings").select("data").single();
  const opsBudget = Number((settings?.data as { operations_budget?: number } | null)?.operations_budget ?? 0);
  const ex = (expenses || []) as Exp[];
  // Receipts in the private bucket: short-lived signed links, minted here for teammates only.
  const signed = await Promise.all(ex.map((e) => (e.receipt_path ? supabaseAdmin().storage.from("receipts").createSignedUrl(e.receipt_path, 300).then((r) => r.data?.signedUrl ?? null).catch(() => null) : Promise.resolve(null))));
  ex.forEach((e, i) => (e.receiptSigned = signed[i]));
  const spent = (pid: string | null) => ex.filter((e) => e.project_id === pid && e.status !== "rejected").reduce((n, e) => n + Number(e.amount), 0);
  const pendingNote = (pid: string | null) => { const p = ex.find((e) => e.project_id === pid && e.status === "pending"); return p ? `${p.description} ${lang === "ar" ? "بانتظار الاعتماد" : "pending"}` : ""; };
  const budgets: Budget[] = (projects || []).map((p) => ({ id: p.id, name: p.name, budget: Number(p.budget), currency: p.currency, spent: spent(p.id), note: pendingNote(p.id) }));
  const ops = spent(null);
  if (ops || opsBudget) budgets.push({ id: "ops", name: lang === "ar" ? "العمليات" : "Operations", budget: opsBudget, currency: "KWD", spent: ops, note: lang === "ar" ? "النطاقات والأدوات وMicrosoft 365" : "Domains, tools, Microsoft 365" });
  const canDecide = me.team_role !== "member" || me.functions.includes("finance");
  return <Finance lang={lang} budgets={budgets} expenses={ex} people={shell.people} projects={shell.projects} categories={cats || []} canDecide={canDecide} />;
}
