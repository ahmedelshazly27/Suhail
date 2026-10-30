import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Newsreader } from "next/font/google";

// Each face sets a --ff-* variable; design-system/tokens.css picks Latin or Arabic faces by <html lang>.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"], variable: "--ff-newsreader", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--ff-plex", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["300", "400", "500", "600"], variable: "--ff-plex-arabic", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--ff-plex-mono", display: "swap" });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--ff-amiri", display: "swap" });

export const fontVars = [newsreader, plex, plexArabic, plexMono, amiri].map((f) => f.variable).join(" ");
