# Components

Values come from the website prototype. Wherever a style here uses tracking or uppercase, the Arabic version sets `letter-spacing:0` and `text-transform:none`.

## Brand mark
- `logo-mark.svg` (the four-point star) next to the word "Suhail" in body 500, or «سهيل» in Amiri 700 at 1.4rem.
- The mark is 18 to 20px in the header and follows `currentColor`. Don't recolor it with the accent, outline it, or rotate it.

## Button
| | |
|---|---|
| Base | `display:inline-flex; gap:.6rem; font:400 .95rem/1 var(--f-body); padding:.95rem 1.4rem; border:1px solid var(--fg); border-radius:0` |
| Primary | `background:var(--fg); color:var(--bg)` |
| Ghost | `background:transparent; color:var(--fg)` |
| Hover (both) | `background:var(--accent); border-color:var(--accent); color:var(--on-accent)` |
| Disabled | `opacity:.4; cursor:not-allowed`, with no hover |
| Dashboard size | `padding:.55rem .9rem; font-size:.875rem` |

## Pill
Filters, tags and toggles: `display:inline-flex; gap:.45rem; font:500 .85rem/1 var(--f-body); padding:.62rem 1rem; border:1px solid var(--line); border-radius:999px; background:var(--bg)`. Selected: `border-color:var(--fg)`.

## Soon tag
`font:500 .66rem/1 var(--f-mono); letter-spacing:.1em; uppercase; color:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:.3rem .55rem`. This is the only outlined accent element.

## Label and eyebrow
- **Label:** `font-size:.78rem; letter-spacing:.12em; uppercase; color:var(--muted); font-weight:400`.
- **Eyebrow** (above headings, metadata): `font-family:var(--f-mono); font-size:.74rem; letter-spacing:.14em; uppercase; color:var(--muted)`.
- **Caption** (under images): `font-size:.72rem; letter-spacing:.08em; uppercase; color:var(--muted)`.

## Card
`border:1px solid var(--line); border-radius:14px; padding:1rem 1.1rem 1.2rem; display:grid; gap:.7rem; background:var(--bg)`. No shadow. Hover on clickable cards: `border-color:var(--fg)`.

## Form field
- Wrapper: `display:grid; gap:.35rem`. Label above the field, using the Label style but in sentence case and `--fg` color.
- Input: 1px `--line` border, `border-radius:0`, background `--bg`, padding `.8rem .9rem`, body 400. Focus: `border-color:var(--fg)` plus the global focus ring.
- Help text: .85rem `--muted`. Word counter: mono .75rem `--muted`, which turns `--accent` when the field is over its limit.
- Errors: text in `--st-danger` under the field, never a red box.
- File input: always the custom picker from the prototype, never the native control, because the native one shows English text in Arabic mode.

## Quote
`border-inline-start:2px solid var(--fg); padding-inline-start:1rem; color:var(--muted); font-size:.95rem`.

## Modal
Backdrop `rgba(10,9,8,.45)` with the dialog centered. Dialog: `background:var(--bg); border:1px solid var(--line); border-radius:16px`, with a floating-layer shadow. Pressing `Esc` closes it, focus is trapped inside, and focus returns to the trigger when it closes.

## Dark band
A full-bleed section with `background:#0B0A09`, used for a change of tone (for example, the manifesto). Inside it, `--accent:#FF5A2A` and the scene colors switch to their dark values.

## Marquee
Mono or body text scrolling slowly. It reverses direction in Arabic and stops entirely under `prefers-reduced-motion`.

## Dashboard components (new, built from the same tokens)
- **Sidebar.** Width 240px, `--soft` background, 1px `--line` divider. Items: body 400 at .9rem in `--muted`. The active item is `--fg` with a 2px `--fg` bar on the inline-start edge, and no accent fill.
- **Table.** 36px rows, a 1px `--line` between rows, and `--soft` on hover. Header row uses the Label style. Numbers are right-aligned (left-aligned in RTL), in mono with tabular figures.
- **Board column.** Header: Label style plus a mono count. Cards use the Card component at `padding:.75rem` with a 1px border. The status dot is 8px, colored `--st-*`. While dragging, a card gets a floating shadow and `border-color:var(--fg)`.
- **Peek panel.** Slides in from the inline-end edge, 560px wide (full screen on mobile), with a 1px `--line` edge and a floating shadow.
- **Command palette.** 640px wide, 16px radius, with a mono hint for shortcuts. The selected row is `--soft`.
- **Ticket key.** Mono .8rem in `--muted`, for example `SUH-123`.
- **Avatar.** A 22px circle with initials in mono .7rem on `--soft`, or the user's Microsoft profile photo.
- **Empty state.** One line of body text in `--muted` plus a ghost button. No illustrations.
- **Toast.** Appears bottom inline-end, inverted (`--fg` background, `--bg` text), square corners, and dismisses after 4 seconds.

## Email (React Email)
- Width 560px, `--bg` background and `--fg` text.
- Fonts: Georgia for display and system sans for body, because web fonts don't load reliably in email clients.
- Arabic emails get `dir="rtl"`.
- One primary button using the Button spec, with a solid `--fg` background.
- Footer: the star mark, one line of text, and the unsubscribe link in `--muted`.
