import { preload } from "react-dom";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// Body and mono faces load on demand: the browser fetches a subset only when its glyphs render, so English pages
// skip the Arabic files and vice versa. The display faces (Newsreader, Amiri) and the Arabic body face live in
// styles/fonts.css: the H1 face is preloaded per language below, since next/font can only preload per route and
// both languages share one, and the Arabic files are subset by scripts/subset-fonts.py.
// Each face sets a --ff-* variable; design-system/tokens.css picks Latin or Arabic faces by <html lang>.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--ff-plex", display: "swap", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--ff-plex-mono", display: "swap", preload: false });

export const fontVars = [plex, plexMono].map((f) => f.variable).join(" ");

// The H1 face for each language. Newsreader italic is only used lower down, so it loads on demand.
// URLs match styles/fonts.css exactly.
const DISPLAY = {
  ar: ["/fonts/amiri-400-arabic.woff2?v=1"],
  en: ["/fonts/newsreader-latin.woff2?v=1"],
};

export function preloadDisplayFont(lang: "ar" | "en") {
  for (const href of DISPLAY[lang]) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}
