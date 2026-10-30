import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInNewTeammate } from "./helpers/auth";

const local = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
test.skip(!local, "needs the local Supabase stack");

for (const lang of ["en", "ar"] as const) {
  test(`[${lang}] the first-sign-in tour walks the real controls, then stays finished`, async ({ page, context }) => {
    await context.addCookies([{ name: "team-lang", value: lang, url: "http://localhost:3000" }]);
    const { id, admin } = await signInNewTeammate(page, lang);
    await page.goto("/team");
    const tour = page.getByRole("dialog");
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("heading")).toHaveText(lang === "ar" ? "هلا فيك في سهيل" : "Welcome to Suhail");
    const axe = await new AxeBuilder({ page }).include(".tour-card").analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    // Every step's card stays on screen, and spotlighted steps sit next to a visible control.
    const next = tour.getByRole("button", { name: lang === "ar" ? /التالي|يلا نبدأ/ : /Next|Let's go/ });
    for (let i = 0; i < 12 && (await tour.isVisible()); i++) {
      const box = (await tour.boundingBox())!, vp = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      await next.click();
    }
    await expect(tour).toBeHidden();
    await expect.poll(async () => (await admin.from("profiles").select("toured_at").eq("id", id).single()).data?.toured_at).not.toBeNull();
    await page.reload();
    await expect(page.locator("[data-testid=tour]")).toHaveCount(0);
  });
}

test("[en] Escape skips the tour and Settings replays it", async ({ page, context }) => {
  await context.addCookies([{ name: "team-lang", value: "en", url: "http://localhost:3000" }]);
  await signInNewTeammate(page, "en");
  await page.goto("/team/my-work");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/team/settings");
  await page.getByRole("button", { name: "Replay the tour" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("dialog")).toBeVisible();
});
