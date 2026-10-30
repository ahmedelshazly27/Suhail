import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Newsreader } from "next/font/google";

// Only Newsreader, the English display face, is preloaded, with display "optional" so the H1 never repaints on a late swap
// (it uses the metric-matched fallback for that one view and the cached font afterwards): Amiri's Arabic files are large and would load on English pages too. The rest load on demand, and the
// browser fetches a subset only when its glyphs render, so English pages skip the Arabic files and vice versa.
// Each face sets a --ff-* variable; design-system/tokens.css picks Latin or Arabic faces by <html lang>.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"], variable: "--ff-newsreader", display: "optional" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--ff-plex", display: "swap", preload: false });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["300", "400", "500", "600"], variable: "--ff-plex-arabic", display: "swap", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--ff-plex-mono", display: "swap", preload: false });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--ff-amiri", display: "swap", preload: false });

export const fontVars = [newsreader, plex, plexArabic, plexMono, amiri].map((f) => f.variable).join(" ");
