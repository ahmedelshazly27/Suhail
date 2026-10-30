import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/manifesto", "/careers", "/season", "/hackathons", "/house", "/jobs", "/partners", "/podcast"];

for (const lang of ["ar", "en"] as const) {
  for (const p of PAGES) {
    const url = (lang === "en" ? "/en" : "") + (p === "/" ? "" : p) || "/";
    test(`${lang} ${p}`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1").first()).toBeVisible();
      // no sideways scrolling at any size
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      // hreflang pair
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    });
  }
}

test("language toggle keeps the page", async ({ page }) => {
  await page.goto("/manifesto");
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("careers form validates in the browser before sending", async ({ page }) => {
  await page.goto("/en/careers");
  await page.locator("details.carrole summary").first().click();
  await page.getByRole("button", { name: "Apply →" }).first().click();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fill in the required fields." })).toBeVisible();
});

test("jobs modal traps focus and closes on Escape", async ({ page }) => {
  await page.goto("/en/jobs");
  const trigger = page.getByRole("button", { name: "Join the talent pool" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});
