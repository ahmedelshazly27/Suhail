// Token names for the /team/design specimen, read from design-system/tokens.json.
import t from "@/design-system/tokens.json";
export const COLORS = ["bg", "fg", "muted", "faint", "line", "soft", "accent", "on-accent", "scene", "scene-hi", "fg-2", "band-bg", "band-fg", "band-scene", "band-scene-hi", "band-accent", "art-bg", "art-scene", "art-scene-hi", "paper-photo", "st-backlog", "st-todo", "st-progress", "st-review", "st-done", "st-cancel", "st-danger", "accent-tint", "accent-ink"] as const;
export const RADII = ["r-0", "r-sm", "r-sm-md", "r-md", "r-md-lg", "r-card", "r-lg", "r-pill"] as const;
export const SPACE = ["s-1", "s-2", "s-3", "s-4", "s-5", "s-6", "s-7", "s-8", "s-9"] as const;
export const TOKENS = t;
