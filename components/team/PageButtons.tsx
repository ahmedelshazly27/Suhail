"use client";
import { openPalette } from "./Palette";
import { tt, type TLang } from "@/lib/team-i18n";

export const SearchButton = ({ lang }: { lang: TLang }) => (
  <button type="button" className="search-btn" onClick={() => openPalette()}>{tt(lang, "search")} <span className="k">⌘K</span></button>
);
export const NewTicketButton = ({ lang }: { lang: TLang }) => (
  <button type="button" className="b" onClick={() => openPalette("new")}>{tt(lang, "newTicket")} <span className="k">C</span></button>
);
