import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { signInOwner } from "./helpers/auth";

// Dashboard tests need a database: they run against the local stack (scripts/local-supabase.sh) and skip otherwise.
const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");

test.beforeEach(async ({ page, context }, info) => {
  await context.addCookies([{ name: "team-lang", value: info.title.includes("[ar]") ? "ar" : "en", url: "http://localhost:3000" }]);
  await signInOwner(page);
  if (page.url().includes("/welcome")) await page.getByRole("button", { name: /Go to Home|روح للرئيسية/ }).click();
  await expect(page).toHaveURL(/\/team$/);
});

const SCREENS = ["/team", "/team/inbox", "/team/my-work", "/team/projects", "/team/sprints", "/team/applications", "/team/relationships", "/team/content", "/team/newsletter", "/team/drive", "/team/finance", "/team/settings", "/team/design"];
for (const lang of ["en", "ar"] as const) for (const path of SCREENS) {
  test(`[${lang}] ${path} renders, no sideways scroll, no serious axe issues`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page }).disableRules(["color-contrast", "region"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

test("[en] C creates a ticket from anywhere and the board peek opens and closes with Escape", async ({ page }, info) => {
  test.skip(info.project.name.startsWith("phone"), "keyboard shortcut");
  await page.keyboard.press("c");
  const title = `E2E ticket ${Date.now()}`;
  await page.getByPlaceholder("Ticket title").fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").getByText(/^SUH-\d+/)).toBeVisible();
  await page.goto("/team/my-work");
  await page.getByRole("button", { name: /Board/ }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("[en] Cmd+K opens the palette and jumps to a page", async ({ page }, info) => {
  test.skip(info.project.name.startsWith("phone"), "keyboard shortcut");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search or jump to…").fill("Applications");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/team\/applications/);
});

test("[en] a project from the Hackathon template gets its full checklist with dates and owners", async ({ page }) => {
  await page.goto("/team/projects");
  await page.getByRole("button", { name: "New project" }).click();
  const name = `Hackathon E2E ${Date.now()}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("From a template").selectOption("hackathon");
  await page.getByLabel("Target").fill("2027-02-14");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("link", { name: "Table" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(22);
});

test("[en] public application lands on the board and in the activity log", async ({ page }) => {
  const email = `applicant-${Date.now()}@example.com`;
  await page.goto("/en/house");
  await page.getByLabel("Name *").fill("E2E Applicant");
  await page.getByLabel("Email *").fill(email);
  await page.getByRole("radio", { name: "Building" }).check();
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.getByLabel("Link to something you built *").fill("https://example.com");
  await page.getByLabel("What will you build in the house? *").fill("An Arabic voice agent.");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("heading", { name: "Received." })).toBeVisible();
  await page.goto("/team/applications?form=house");
  await expect(page.getByText("E2E Applicant").first()).toBeVisible();
});

test("RLS: anonymous and signed-in non-team users read nothing", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const a = createClient(url, anon, { auth: { persistSession: false } });
  for (const t of ["applications", "subscribers", "profiles", "tickets", "settings", "graph_tokens", "expenses"]) {
    const { data } = await a.from(t).select("*").limit(1);
    expect(data ?? []).toEqual([]);
  }
  expect((await a.from("subscribers").insert({ email: "x@example.com" })).error).not.toBeNull();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `stranger-${Date.now()}@example.com`;
  await admin.auth.admin.createUser({ email, password: "a-long-test-password-1", email_confirm: true });
  const s = createClient(url, anon, { auth: { persistSession: false } });
  await s.auth.signInWithPassword({ email, password: "a-long-test-password-1" });
  for (const t of ["applications", "profiles", "tickets", "roles"]) expect((await s.from(t).select("id").limit(1)).data ?? []).toEqual([]);
});
