# Suhail design system

Everything Suhail ships, from the website and the dashboard to emails and social posts, comes from this folder. It was extracted from the website prototype (`reference/suhail.html`). Where this folder and the prototype disagree, the prototype wins and this folder gets fixed.

| File | What it is |
|---|---|
| `tokens.css` | Every color, font, size, radius, space and motion value as CSS variables, with dark mode and Arabic overrides. Import it once. |
| `tokens.json` | The same values for Tailwind, React Email and anything that can't read CSS. Generated from `tokens.css`; never edit by hand. |
| `components.md` | Specs for every component, with the exact values. |
| `logo-mark.svg` | The Suhail star. It always inherits `currentColor`. |

## Character

Suhail looks like a well-made printed page: warm paper, near-black ink and one orange accent. It's quiet, confident and editorial. Most of the expression comes from type and space, not color or decoration.

- **Paper and ink.** Most of every screen is `--bg` and `--fg`. Gray (`--muted`, `--faint`, `--line`) carries hierarchy.
- **One accent, used rarely.** `--accent` is for hover, focus, the active state and at most one highlight per screen. It never fills a large area, and it is never used for decoration.
- **Sharp corners.** Buttons are square. Rounding is only for pills (`--r-pill`) and cards (`--r-card`).
- **Hairlines, not shadows.** Separate things with a 1px `--line` border. Shadows are allowed only on floating layers (modal, popover, command palette).
- **Dark sections are deliberate.** A full-bleed `.darkband` marks a change of tone. Don't use it as a background pattern.

## Type

| Role | Latin | Arabic | Use |
|---|---|---|---|
| Display | Newsreader 300 | Amiri 400 | h1, h2, pull quotes, the manifesto |
| Body | IBM Plex Sans 300/400/500 | IBM Plex Sans Arabic 300 to 600 | everything else |
| Mono | IBM Plex Mono 400 | (falls back to body) | eyebrows, numbers, ticket keys, dates, metadata |

- Body text is weight 300 at 1.0625rem with 1.7 line height. In Arabic it's 1.1rem with 1.95.
- **Arabic never gets letter-spacing or uppercase.** Every tracked or uppercase style has an Arabic override that sets `letter-spacing:0`, and those overrides are not optional.
- Keep body copy within `--text` (34rem). Page content sits in `--col` (62rem).
- Numbers in tables and stats use `--f-num` with `font-variant-numeric: tabular-nums`.

## Bilingual and RTL

- Arabic is a first-class layout, not a translation. Set `<html lang="ar" dir="rtl">` and let the CSS respond.
- Use logical properties only (`margin-inline-start`, `padding-inline`, `border-inline-start`, `inset-inline-end`). Never `left` or `right`. Add a lint rule for this.
- Icons that imply direction (arrows, chevrons, "back") flip in RTL. Icons that don't imply direction (the star, a check) never flip.
- Show Arabic and English side by side only on purpose, as on the manifesto. Otherwise show one language and offer the toggle.

## Voice

- Write plainly and specifically: say what happens and when.
- Never use em dashes, and avoid marketing filler ("unlock", "empower", "revolutionize", "seamless").
- The Arabic is a clear, warm dialect that everyone in the region understands, not formal MSA. Never machine-translate. Write each language directly.
- Team roles are "unpaid until revenue", never "volunteer".
- Buttons say what they do: "Send application", not "Submit".

## Dashboard

The dashboard uses the same tokens, with three differences:

1. **Denser layout.** Body text drops to .9375rem/1.55, and table rows are 36px.
2. **Colour stays on brand.** Use paper, ink and greys, plus the one orange. Don't add other hues: no blue, green, teal or mint.
   - **Orange** marks in progress, the active nav item, progress bars, page eyebrows (`--accent-ink`), overdue dates, and chips that need attention (`--accent-tint` with `--accent-ink`).
   - **Everything else is neutral.** Project, label, role and channel chips are `--soft` with ink text. Avatars are `--soft` with ink initials.
   - **Ticket status:** Todo is a grey dot, In progress orange, In review dark grey, Done ink.
   - **Dark band.** One dark card per screen at most (on Home, the sprint card), using the dark band colours.
   - **Dither.** The brand dot texture, in orange, from the `.dither` utility in `tokens.css`, appears in a few places only: the Home greeting strip, inside the dark sprint card, the bottom of the sidebar, the sign-in background, and a faint top corner on each page. It always fades out with a mask, sits behind content, and is never a full-page wallpaper or behind text you need to read.
3. **Shadows.** Panels and popovers may use `0 8px 30px rgba(10,9,8,.12)` (light mode) or `0 8px 30px rgba(0,0,0,.5)` (dark mode).

## Rules for code

- Never write a hex value, font name or pixel radius in a component. Use a token. Add a lint rule or CI grep that fails on raw hex values outside this folder.
- To add a token, add it to `tokens.css`, regenerate `tokens.json`, document it here or in `components.md`, and use it.
- The dashboard has a `/team/design` page that renders every token and component in light, dark, Arabic and English. It updates automatically and is how changes get reviewed.
