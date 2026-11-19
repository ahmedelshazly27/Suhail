import { expect, test } from "@playwright/test";

// The manifesto: text only, one language per page (the header toggle switches), the opening words quoted and
// attributed, Ibn Khaldun as a pull quote, and the closing question with the signup.
for (const lang of ["ar", "en"] as const) {
  test(`manifesto ${lang}: one language, quoted opening, closing`, async ({ page }, info) => {
    test.skip(info.project.name.includes("dark"), "layout is checked in light; axe covers dark in site.spec");
    await page.goto(lang === "ar" ? "/manifesto" : "/en/manifesto");
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator(".mf-words")).toHaveCount(1);
    await expect(page.locator(`.mf-words.mf-${lang}`)).toBeVisible();
    // Only this page's language.
    await expect(page.locator(".mf-words")).not.toContainText(lang === "ar" ? "five hundred million" : "خمسمية مليون");
    const opening = page.locator(".mf-cited").first();
    await expect(opening.locator("blockquote")).toContainText(lang === "ar" ? "فيه خمسمية مليون عربي" : "There are five hundred million Arabs");
    await expect(opening.locator("figcaption")).toContainText(lang === "ar" ? "روبرت إف. كينيدي الابن" : "Robert F. Kennedy Jr.");
    await expect(page.locator(".mf-quote blockquote")).toContainText(lang === "ar" ? "المغلوبُ مولعٌ أبداً بالاقتداء بالغالب" : "The defeated always love to imitate the victor");
    await expect(page.locator("#mf-q")).toContainText(lang === "ar" ? "إيش بنكون صنعنا" : "what will we have made");
    await expect(page.locator(".mf-close")).not.toContainText(lang === "ar" ? "what will we have made" : "إيش بنكون صنعنا");
    await expect(page.locator(".mf-close").getByRole("link", { name: lang === "ar" ? "انضم لنا" : "Join us" })).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/media\/manifesto\/poster\.jpg$/);
  });
}

test("home links to the manifesto, and the toggle switches its language", async ({ page }) => {
  await page.goto("/en");
  await page.locator(".home-film").click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
  await page.locator("header .lang").click();
  await expect(page).toHaveURL(/\/manifesto$/);
  await expect(page.locator(".mf-words.mf-ar")).toBeVisible();
});
