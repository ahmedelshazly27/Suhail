import { expect, test } from "@playwright/test";

// The manifesto film: captions are served (the language routing must not swallow .vtt), the page language's track
// is the default, and the transcript, pull quote and closing question are real text.
for (const lang of ["ar", "en"] as const) {
  test(`manifesto ${lang}: captions, transcript and closing`, async ({ page, request }, info) => {
    test.skip(info.project.name.includes("dark"), "layout is checked in light; axe covers dark in site.spec");
    for (const l of ["ar", "en"]) {
      const r = await request.get(`/media/manifesto/manifesto.${l}.vtt`);
      expect(r.status()).toBe(200);
      expect(await r.text()).toContain("WEBVTT");
    }
    await page.goto(lang === "ar" ? "/manifesto" : "/en/manifesto");
    const video = page.locator("video");
    await expect(video).toHaveAttribute("poster", "/media/manifesto/poster.jpg");
    await expect(video).toHaveAttribute("preload", "metadata");
    expect(await video.getAttribute("autoplay")).toBeNull();
    await expect(page.locator(`track[srclang="${lang}"]`)).toHaveAttribute("default", "");
    await expect(page.locator(`track[srclang="${lang === "ar" ? "en" : "ar"}"]`)).not.toHaveAttribute("default", "");
    await expect(page.getByText("Opening clip: C-SPAN / Spectrum News.").or(page.getByText("اللقطة الافتتاحية: C-SPAN / Spectrum News."))).toBeVisible();
    // Arabic first, then English, on both language pages.
    const sections = page.locator(".mf-words");
    await expect(sections.nth(0)).toHaveAttribute("lang", "ar");
    await expect(sections.nth(0)).toHaveAttribute("dir", "rtl");
    await expect(sections.nth(1)).toHaveAttribute("lang", "en");
    await expect(page.locator(".mf-quote blockquote").first()).toContainText("المغلوبُ مولعٌ أبداً بالاقتداء بالغالب");
    await expect(page.locator("#mf-q")).toContainText(lang === "ar" ? "إيش بنكون صنعنا" : "what will we have made");
    await expect(page.locator(".mf-close").getByRole("link", { name: lang === "ar" ? "انضم لنا" : "Join us" })).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/media\/manifesto\/poster\.jpg$/);
  });
}

test("home links to the manifesto film", async ({ page }) => {
  await page.goto("/en");
  await page.locator(".home-film").click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
});
