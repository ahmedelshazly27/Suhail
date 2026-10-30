import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM for Microsoft Graph refresh tokens at rest. Key: TOKEN_ENCRYPTION_KEY (hex or any string, hashed to 32 bytes).
const key = () => createHash("sha256").update(env.tokenKey() || "missing-key").digest();

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string) {
  const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
