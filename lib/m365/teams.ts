import "server-only";
import { env } from "@/lib/env";

export type Card = { title: string; text: string; href?: string; facts?: [string, string][]; actions?: { title: string; verb: string; data?: Record<string, string> }[] };

export interface TeamsNotifier {
  readonly live: boolean;
  /** Team-wide card in the channel (Workflows webhook). */
  channel(card: Card): Promise<void>;
  /** Personal card in the person's 1:1 chat with the Suhail bot. */
  personal(profileId: string, card: Card): Promise<void>;
}

/** Adaptive Card 1.5 with Open and the card's own actions. Actions post back to /api/teams/messages via the bot. */
export function adaptiveCard(card: Card) {
  const base = env.siteUrl();
  return {
    type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.5",
    body: [
      { type: "TextBlock", text: card.title, weight: "Bolder", size: "Medium", wrap: true },
      ...(card.text ? [{ type: "TextBlock", text: card.text, wrap: true, isSubtle: true }] : []),
      ...(card.facts?.length ? [{ type: "FactSet", facts: card.facts.map(([title, value]) => ({ title, value })) }] : []),
    ],
    actions: [
      ...(card.href ? [{ type: "Action.OpenUrl", title: "Open", url: card.href.startsWith("http") ? card.href : base + card.href }] : []),
      ...(card.actions || []).map((a) => ({ type: "Action.Execute", title: a.title, verb: a.verb, data: a.data || {} })),
    ],
  };
}

class WebhookAndBot implements TeamsNotifier {
  live = true;
  async channel(card: Card) {
    const url = env.teamsWebhook();
    if (!url) return;
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: adaptiveCard(card) }] }) });
  }
  async personal(profileId: string, card: Card) {
    const { sendPersonalCard } = await import("./bot");
    await sendPersonalCard(profileId, adaptiveCard(card));
  }
}

class Off implements TeamsNotifier {
  live = false;
  async channel() {}
  async personal() {}
}

export const teamsNotifier = (): TeamsNotifier => (env.teamsWebhook() || (env.bot().id && env.bot().password) ? new WebhookAndBot() : new Off());
