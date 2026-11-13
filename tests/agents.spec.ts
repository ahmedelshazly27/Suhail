import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { signInOwner } from "./helpers/auth";

// The agent team end to end: the routine's key, the shift plan, a run's brief, a report, and a person approving a
// draft into Relationships. Runs against the local stack; serial because the steps share one run.
const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");
test.describe.configure({ mode: "serial" });
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const key = "suhail_ag_" + randomBytes(24).toString("base64url");
const auth = { authorization: `Bearer ${key}` };
const org = `Test Ventures ${Date.now()}`;

test.beforeAll(async () => {
  await admin().from("agent_keys").insert({ name: "e2e", hash: createHash("sha256").update(key).digest("hex") });
});
test.beforeEach(async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-light", "data-changing flow, once");
  await context.addCookies([{ name: "team-lang", value: "en", url: "http://localhost:3000" }]);
  await signInOwner(page);
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: /Go to Home|روح للرئيسية/ }).click();
    await expect(page).toHaveURL(/\/team$/);
  }
});

test("the API refuses a missing or unknown key", async ({ request }) => {
  expect((await request.get("/api/agents/shift")).status()).toBe(401);
  expect((await request.get("/api/agents/shift", { headers: { authorization: "Bearer suhail_ag_nope" } })).status()).toBe(401);
});

test("a requested run shows up in the shift, gets a brief, and its report lands in the queue", async ({ request, page }) => {
  await admin().from("agents").update({ run_requested_at: new Date().toISOString() }).eq("key", "partners");
  const shift = await (await request.get("/api/agents/shift", { headers: auth })).text();
  expect(shift).toContain("Partner Prospector");
  expect(shift).toContain("/api/agents/partners/start");

  const start = await request.post("/api/agents/partners/start", { headers: auth });
  expect(start.status()).toBe(200);
  const brief = await start.text();
  expect(brief).toContain("# You are Partner Prospector");
  expect(brief).toContain("Relationships (");
  expect(brief).not.toContain("quota:");
  const runId = /"run_id": "([0-9a-f-]{36})"/.exec(brief)![1];

  // A bad report is explained, so the agent can fix and resend.
  const bad = await request.post("/api/agents/partners/finish", { headers: auth, data: { run_id: runId, items: [{ kind: "lead" }] } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).fix.join(" ")).toContain("title");

  const ok = await request.post("/api/agents/partners/finish", { headers: auth, data: {
    run_id: runId, summary: "One strong lead.",
    items: [{ kind: "lead", title: org, body: "They launched an AI fund last week.\n\nDraft message: Hello.", score: 5,
      sources: [{ url: "https://example.com/fund", date: "2026-11-10" }], data: { org, type: "Sponsor", next_step: "Intro via Coded" } }],
  } });
  expect(await ok.json()).toEqual({ ok: true, saved: 1 });
  expect((await request.post("/api/agents/partners/finish", { headers: auth, data: { run_id: runId } })).status()).toBe(409);

  // Approving sends it to Relationships.
  await page.goto("/team/agents");
  const card = page.locator(".ag-item", { hasText: org });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Approve to Relationships" }).click();
  await expect(card).toBeHidden(); // it leaves "To review"
  await page.goto("/team/agents?status=approved");
  await expect(page.locator(".ag-item", { hasText: org }).getByRole("link", { name: "Open in Relationships" })).toBeVisible();
  const { data: rel } = await admin().from("relationships").select("stage,type,next_step").eq("name", org).single();
  expect(rel).toEqual({ stage: "Prospect", type: "Sponsor", next_step: "Intro via Coded" });
});

test("a rejection reason reaches the agent's next brief", async ({ request, page }) => {
  const start = await (await request.post("/api/agents/news/start", { headers: auth })).text();
  const runId = /"run_id": "([0-9a-f-]{36})"/.exec(start)![1];
  const title = `Seed round ${Date.now()}`;
  await request.post("/api/agents/news/finish", { headers: auth, data: { run_id: runId, items: [{ kind: "story", title, body: "Small round.", score: 2 }] } });
  // Stories go to the pool, not the review queue.
  await page.goto("/team/agents?who=all&agent=news");
  await expect(page.locator(".ag-item", { hasText: title })).toHaveCount(0);
  await page.goto("/team/agents?tab=pool&by=day&agent=news");
  const card = page.locator(".ag-item", { hasText: title });
  await card.getByRole("button", { name: "Dismiss" }).click();
  await card.getByLabel(/Why\?/).fill("Rounds under $1M are not news for us");
  await card.getByRole("button", { name: "Reject" }).click();
  await expect(card).toBeHidden();
  const next = await (await request.post("/api/agents/news/start", { headers: auth })).text();
  expect(next).toContain("Rounds under $1M are not news for us");
  expect(next).toContain(title); // listed under "Already filed"
  // The shift upgraded the unedited seed instructions and every web agent gets the research method.
  expect(next).toContain("Lanes (work every one)");
  expect(next).toContain("How deep to go");
  expect(next).toContain("site:linkedin.com/posts");
});

test("a teammate's request is answered to them, and the team page shows every agent", async ({ request, page }) => {
  await page.goto("/team/agents?tab=asks");
  await page.locator('select[name="agent"]').selectOption("research");
  const ask = `Which Arabic speech datasets are open? ${Date.now()}`;
  await page.getByLabel("What do you need?").fill(ask);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".row", { hasText: ask })).toBeVisible();
  const shift = await (await request.get("/api/agents/shift", { headers: auth })).text();
  expect(shift).toContain("Research and Projects Scout");
  const brief = await (await request.post("/api/agents/research/start", { headers: auth })).text();
  const reqId = new RegExp(`request_id ([0-9a-f-]{36}) from [^:]*: ${ask.replace(/[?]/g, "\\?")}`).exec(brief)![1];
  const runId = /"run_id": "([0-9a-f-]{36})"/.exec(brief)![1];
  await request.post("/api/agents/research/finish", { headers: auth, data: { run_id: runId, items: [{ kind: "answer", title: "Open Arabic speech datasets", body: "- MGB-2\n- Common Voice Arabic", request_id: reqId }] } });
  await page.reload();
  await page.locator(".row", { hasText: ask }).getByRole("link", { name: "Answer" }).click();
  await expect(page.locator(".ag-item", { hasText: "Open Arabic speech datasets" })).toContainText("Common Voice Arabic");

  await page.goto("/team/agents?tab=team");
  await expect(page.locator(".ag-card")).toHaveCount(12); // the ten seeded agents plus Ecosystem Voices and the Coach, added by the shift
  await page.locator(".ag-card", { hasText: "Writer" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog").getByLabel("Works for")).toBeVisible();
});

test("approving a person sets its type and next step, and ticked actions become tickets", async ({ request, page }) => {
  const brief = await (await request.post("/api/agents/people/start", { headers: auth })).text();
  const runId = /"run_id": "([0-9a-f-]{36})"/.exec(brief)![1];
  const who = `Test Founder ${Date.now()}`;
  await request.post("/api/agents/people/finish", { headers: auth, data: { run_id: runId, items: [{
    kind: "person", title: who, body: "## Who\n**Founder** of Echelon. [Dealroom](https://example.com/echelon)\n\n## Best fit\n- Majlis guest\n- Talent partner",
    data: { type: "Podcast guest", org: `Echelon ${Date.now()}`, actions: [{ title: `Invite ${who} to the Majlis`, due_on: "2026-12-01" }, { title: `Explore ${who}'s institute as a partner` }] },
  }] } });
  await page.goto("/team/agents?who=all");
  const card = page.locator(".ag-item", { hasText: who });
  await card.getByRole("button", { name: who }).click();
  await expect(card.locator(".md h3", { hasText: "Who" })).toBeVisible(); // formatted, not raw Markdown
  await expect(card.getByRole("link", { name: "Dealroom" })).toHaveAttribute("href", "https://example.com/echelon");
  await card.getByRole("checkbox", { name: /Explore/ }).uncheck();
  await card.getByRole("button", { name: "Approve to Relationships + 1 tickets" }).click();
  await expect(card).toBeHidden();
  const db = admin();
  const { data: rel } = await db.from("relationships").select("id,type,next_step,next_due").eq("name", who).single();
  expect(rel).toMatchObject({ type: "Podcast guest", next_step: `Invite ${who} to the Majlis`, next_due: "2026-12-01" });
  const { data: tickets } = await db.from("tickets").select("title").eq("source_ref", rel!.id);
  expect(tickets!.map((t) => t.title)).toEqual([`Invite ${who} to the Majlis`]);
});

test("the Coach's proposal, once approved, becomes the agent's lessons", async ({ request, page }) => {
  const brief = await (await request.post("/api/agents/coach/start", { headers: auth })).text();
  expect(brief).toContain("How each agent's work was judged");
  const runId = /"run_id": "([0-9a-f-]{36})"/.exec(brief)![1];
  const rule = `Skip rounds under $1M (${Date.now()})`;
  await request.post("/api/agents/coach/finish", { headers: auth, data: { run_id: runId, items: [{ kind: "insight", title: "Coach: Growth Analyst", body: "Two rejections asked for this.", data: { apply_lessons: { agent: "growth", lessons: rule } } }] } });
  await page.goto("/team/agents?who=all&agent=coach");
  await page.locator(".ag-item", { hasText: "Coach: Growth Analyst" }).last().getByRole("button", { name: "Apply to growth" }).click();
  await expect.poll(async () => (await admin().from("agents").select("lessons").eq("key", "growth").single()).data?.lessons).toBe(rule);
});
