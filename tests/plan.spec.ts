import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInOwner } from "./helpers/auth";

// The 2027 plan. Runs against the local stack; serial because the steps share the seeded plan.
const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");
test.describe.configure({ mode: "serial" });
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test.beforeEach(async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-light", "data-changing flow, once");
  await context.addCookies([{ name: "team-lang", value: "en", url: "http://localhost:3000" }]);
  await signInOwner(page);
  // A fresh database (CI) shows the one-time welcome screen first.
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: /Go to Home|روح للرئيسية/ }).click();
    await expect(page).toHaveURL(/\/team$/);
  }
});

test("the seeded 2027 plan shows the grid, the gates and every KPI", async ({ page }) => {
  await page.goto("/team/plan");
  for (const d of ["Team", "Partnerships", "Events", "Editorial", "Engineering and Research", "Finance"]) await expect(page.getByRole("rowheader", { name: d })).toBeVisible();
  await expect(page.getByRole("button", { name: /Five leads start/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Season funded" })).toBeVisible();
  await page.goto("/team/plan?tab=kpis");
  await expect(page.locator(".kpi")).toHaveCount(13);
  await expect(page.locator(".kpi", { hasText: "Revenue" })).toContainText("$60,000");
});

test("marking a milestone done updates the Home card", async ({ page }) => {
  const db = admin();
  await db.from("milestones").update({ status: "not_started", done_at: null }).eq("year", 2027).eq("quarter", 1);
  await page.goto("/team");
  const card = page.locator(".plan-card");
  await expect(card).toContainText("0 of 10 Q1 milestones done");
  await page.goto("/team/plan");
  await page.getByRole("button", { name: /Five leads start/ }).click();
  await page.getByRole("dialog").getByLabel("Status").selectOption("done");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/team");
  await expect(card).toContainText("1 of 10 Q1 milestones done");
});

test("a manual KPI value is entered and kept as history", async ({ page }) => {
  await page.goto("/team/plan?tab=kpis");
  const kpi = page.locator(".kpi", { hasText: "Suhail Season attendance" });
  await kpi.getByRole("button", { name: "Enter value" }).click();
  await page.getByRole("dialog").getByLabel("Value").fill("120");
  await page.getByRole("dialog").getByLabel("Note").fill("Early sign-ups");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(kpi.locator(".big-n")).toHaveText("120");
  await kpi.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("dialog")).toContainText("Early sign-ups");
});

test("a quarterly review is created and stays read-only", async ({ page }) => {
  const db = admin();
  page.on("dialog", (d) => d.accept());
  await page.goto("/team/plan?tab=reviews");
  const exists = await page.locator(".review").count();
  if (!exists) {
    await page.getByRole("button", { name: "New quarterly review" }).click();
    await page.getByLabel("What went well").fill("Partners signed early");
    await page.getByLabel("What didn't").fill("Newsletter slower than planned");
    await page.getByLabel("What we change").fill("Two issues a week");
    await page.getByRole("button", { name: "Save review" }).click();
  }
  await expect(page.locator(".review").first()).toContainText("What went well");
  const { data } = await db.from("plan_reviews").select("id").limit(1).single();
  const { error } = await db.from("plan_reviews").update({ went_well: "changed" }).eq("id", data!.id);
  expect(error?.message).toContain("read-only");
});

test("income is Finance-only and feeds revenue", async ({ page }) => {
  await page.goto("/team/finance");
  await page.getByRole("button", { name: "Record income" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Partner").fill("Test Partner");
  await d.getByLabel(/Amount/).fill("2500");
  await d.getByLabel("When").fill("2027-02-10");
  await d.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/team/plan?tab=kpis");
  await expect(page.locator(".kpi", { hasText: "Revenue" }).locator(".big-n")).not.toHaveText("$0");
  // Someone outside Finance can't read income rows.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const { data } = await createClient(url, anon).from("income").select("id");
  expect(data ?? []).toHaveLength(0);
});
