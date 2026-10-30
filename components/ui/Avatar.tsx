export const initials = (name: string) => { const w = (name || "?").split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase(); };

/** 22px circle: Microsoft photo when there is one, else initials on --soft. */
export function Avatar({ name, src, size = "sm", ink, me, title }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; ink?: boolean; me?: boolean; title?: string }) {
  return (
    <span className={`av ${size === "sm" ? "" : size}${ink ? " ink" : ""}${me ? " me" : ""}`} title={title ?? name} aria-label={title ?? name} role="img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
