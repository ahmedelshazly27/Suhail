import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Suhail Members end to end: an invite becomes a membership through the email link, profiles show in the
// directory, an introduction is double opt-in, and a member never sees the team dashboard.
const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");
test.describe.configure({ mode: "serial" });
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stamp = Date.now();
const a = { email: `a-${stamp}@example.com`, name: `Amal ${stamp}` }, b = { email: `b-${stamp}@example.com`, name: `Badr ${stamp}` };

/** What the join form does, minus the email: the link it would send, opened. */
async function join(page: Page, who: { email: string; name: string }, code: string) {
  const db = admin();
  await db.auth.admin.createUser({ email: who.email, email_confirm: true, user_metadata: { name: who.name } }).catch(() => null);
  const { data } = await db.auth.admin.generateLink({ type: "magiclink", email: who.email });
  await page.goto(`/members/auth/confirm?token_hash=${data.properties!.hashed_token}&invite=${code}`);
}

test.beforeAll(async () => {
  await admin().from("rate_limits").delete().like("bucket", "member-%"); // reruns from one machine share the per-IP limits
});
test.beforeEach(async ({ context }, info) => {
  test.skip(info.project.name !== "desktop-light", "data-changing flow, once");
  await context.addCookies([{ name: "m-lang", value: "en", url: "http://localhost:3000" }]);
});

test("signed out, the app asks for a link or an application, and an unknown address isn't let in", async ({ page }) => {
  await page.goto("/members");
  await expect(page).toHaveURL(/\/members\/sign-in/);
  await page.getByLabel("Email").fill(`nobody-${stamp}@example.com`);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.locator(".mb-err")).toContainText("isn't a member yet");
  await page.getByRole("link", { name: "Apply" }).click();
  await page.getByLabel("Name").fill("Applicant");
  await page.getByLabel("Email").fill(`apply-${stamp}@example.com`);
  await page.getByLabel(/What you've built/).fill("A payments API used by 40 shops in Kuwait.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("status")).toContainText("replies within two weeks");
});

test("an invite becomes a member, who fills a profile, invites the next person and asks for an introduction", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const db = admin();
  await db.from("member_invites").insert({ code: `t${stamp}`.slice(0, 12), email: a.email });
  await join(page, a, `t${stamp}`.slice(0, 12));
  await expect(page).toHaveURL(/\/members\/me\?welcome=1/);
  await page.getByLabel("Headline").fill("ML engineer in Riyadh");
  await page.getByLabel("City").first().fill("Riyadh");
  await page.getByLabel("A co-founder").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  // The same invite can't be used twice.
  const other = await browser.newPage();
  await join(other, { email: `c-${stamp}@example.com`, name: "C" }, `t${stamp}`.slice(0, 12));
  await expect(other).toHaveURL(/\/members\/join\/.*e=used|\/members\/sign-in/);
  await other.close();

  await page.goto("/members/invite");
  await page.getByLabel("Their email (optional)").fill(b.email);
  await page.getByRole("button", { name: "Create an invite link" }).click();
  const link = await page.locator(".mb-invite code").innerText();
  const code = link.split("/join/")[1];
  const pb = await browser.newPage();
  await pb.context().addCookies([{ name: "m-lang", value: "en", url: "http://localhost:3000" }]);
  await join(pb, b, code);
  await expect(pb).toHaveURL(/welcome=1/);
  const { data: bm } = await db.from("members").select("id,invited_by").eq("name", b.name).single();
  const { data: am } = await db.from("members").select("id").eq("name", a.name).single();
  expect(bm!.invited_by).toBe(am!.id);

  // A finds B and asks for an introduction; B accepts; only then can A see B's address.
  await page.goto(`/members/people?q=${encodeURIComponent(b.name)}`);
  await page.getByRole("link", { name: new RegExp(b.name) }).click();
  await page.getByLabel(/Why do you want to meet/).fill("We are both building for Gulf merchants and should compare notes.");
  await page.getByRole("button", { name: "Ask for an introduction" }).click();
  await expect(page.locator(".mb-ok")).toContainText("If they accept");
  await pb.goto("/members/intros");
  await pb.getByRole("button", { name: "Accept" }).click();
  await expect(pb.getByText("Connected", { exact: true })).toBeVisible();
  await page.goto("/members/intros");
  await page.getByRole("button", { name: "@" }).click();
  await expect(page.getByRole("link", { name: b.email })).toBeVisible();

  // The board: post a meetup and RSVP from the other member.
  await page.goto("/members/board");
  await page.getByText("Post to the board").click();
  await page.getByRole("button", { name: "Meetup" }).click();
  await page.getByLabel("Title").fill(`Coffee in Riyadh ${stamp}`);
  await page.getByLabel("When").fill("2027-02-01T20:00");
  await page.getByLabel("City").fill("Riyadh");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page).toHaveURL(/\/members\/board\/[0-9a-f-]{36}/);
  await pb.goto(page.url());
  await pb.getByRole("button", { name: /I'll come/ }).click();
  await expect(pb.getByRole("button", { name: /I'll come/ })).toHaveAttribute("aria-pressed", "true");
  await pb.getByLabel("Comment").fill("Count me in");
  await pb.getByRole("button", { name: "Comment" }).click();
  await expect(pb.locator(".mb-c", { hasText: "Count me in" })).toContainText(b.name);

  // A member is not a teammate.
  await page.goto("/team");
  await expect(page).toHaveURL(/\/team\/sign-in/);
  await pb.close();
});
