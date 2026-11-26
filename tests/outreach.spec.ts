import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInOwner } from "./helpers/auth";

// The researched partner pack: an admin imports it once, each organisation lands in Relationships with its reasoning
// and a ready email on the Outreach page, and importing again changes nothing that was already handled.
const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");
test.describe.configure({ mode: "serial" });
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test.beforeEach(async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-light", "data-changing flow, once");
  await context.addCookies([{ name: "team-lang", value: "en", url: "http://localhost:3000" }]);
  await signInOwner(page);
  if (page.url().includes("/welcome")) await page.getByRole("button", { name: /Go to Home|روح للرئيسية/ }).click();
});

test("importing the pack fills Outreach and Relationships, and skipping sticks across a re-import", async ({ page }) => {
  test.setTimeout(120_000);
  const { data: prior } = await admin().from("relationships").select("id").eq("name", "CODED").maybeSingle();
  if (prior) await admin().from("outreach").update({ status: "ready" }).eq("relationship_id", prior.id); // a rerun starts clean
  await page.goto("/team/outreach");
  await page.getByRole("button", { name: /Import \d+ researched partners|Refresh research/ }).click();
  await expect(page.getByText(/Imported: \d+ new/)).toBeVisible({ timeout: 60_000 });
  const { count } = await admin().from("outreach").select("id", { count: "exact", head: true });
  expect(count).toBeGreaterThan(100);

  // A card opens to the reasoning, the contact and the editable email; sending waits on Microsoft 365 locally.
  const card = page.locator(".or-card", { hasText: "CODED" }).first();
  await card.locator(".or-head").click();
  await expect(card.getByText("Why them")).toBeVisible();
  await expect(card.getByLabel("To", { exact: true })).toHaveValue("hello@joincoded.com");
  await expect(card.getByLabel("Subject", { exact: true })).not.toHaveValue("");
  await expect(card.getByRole("button", { name: "Send from Outlook" })).toBeDisabled();
  await card.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Skipped.")).toBeVisible();

  await page.getByRole("button", { name: /Refresh research/ }).click();
  await expect(page.getByText(/Imported: 0 new/)).toBeVisible({ timeout: 60_000 });
  const { data: rel } = await admin().from("relationships").select("id,type,next_step").eq("name", "CODED").single();
  const { data: o } = await admin().from("outreach").select("status").eq("relationship_id", rel!.id).single();
  expect(o!.status).toBe("skipped");
  expect(rel!.next_step).not.toBe("");
  await page.goto(`/team/relationships?id=${rel!.id}`);
  await expect(page.getByText("Researched for partner outreach.")).toBeVisible();
});
