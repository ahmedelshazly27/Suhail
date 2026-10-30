import { tt, type Status, type TLang } from "@/lib/team-i18n";

export const StatusDot = ({ s }: { s: string }) => <span className={`dot ${s}`} aria-hidden="true" />;
export const StatusChip = ({ s, lang }: { s: Status; lang: TLang }) => (
  <span className={`chip${s === "in_progress" ? " attn" : ""}`}><StatusDot s={s} />{tt(lang, s)}</span>
);
export const Chip = ({ children, attn, dashed }: { children: React.ReactNode; attn?: boolean; dashed?: boolean }) => (
  <span className={`chip${attn ? " attn" : ""}${dashed ? " dashed" : ""}`}>{children}</span>
);
export const Empty = ({ text, action }: { text: string; action?: React.ReactNode }) => <div className="empty"><p>{text}</p>{action}</div>;
export const Dither = ({ className = "" }: { className?: string }) => <div className={`dither ${className}`} aria-hidden="true" />;
