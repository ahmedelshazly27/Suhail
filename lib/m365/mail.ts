import "server-only";
import { delegatedToken, graph, m365Live } from "./graph";

// Mail bodies are never stored in Supabase: lists come from Graph, bodies are fetched live, and only ids,
// links and the metadata needed for linking go into mail_links.
export type Mailbox = { id: string; name: string; address: string; unread: number };
export type MailMsg = {
  id: string; mailbox: string; from: string; fromEmail: string; subject: string; snippet: string; received: string; unread: boolean;
  webLink: string; hasAttachments: boolean; conversationId?: string;
};
export type MailBody = MailMsg & { bodyText: string; attachments: { id: string; name: string; size: number }[] };

export interface MailProvider {
  readonly live: boolean;
  mailboxes(): Promise<Mailbox[]>;
  list(mailbox: string): Promise<MailMsg[]>;
  get(mailbox: string, id: string): Promise<MailBody | null>;
  reply(mailbox: string, id: string, text: string): Promise<void>;
}

const SHARED = (process.env.SHARED_MAILBOXES || "hello@suhail.build,partners@suhail.build,tasks@suhail.build").split(",").map((s) => s.trim()).filter(Boolean);
type GMsg = { id: string; subject: string; bodyPreview: string; receivedDateTime: string; isRead: boolean; webLink: string; hasAttachments: boolean; conversationId: string; from?: { emailAddress: { name: string; address: string } }; body?: { content: string } };
const root = (mb: string) => (mb === "me" ? "/me" : `/users/${encodeURIComponent(mb)}`);
const toMsg = (mb: string, m: GMsg): MailMsg => ({ id: m.id, mailbox: mb, from: m.from?.emailAddress.name || "", fromEmail: m.from?.emailAddress.address || "", subject: m.subject, snippet: m.bodyPreview, received: m.receivedDateTime, unread: !m.isRead, webLink: m.webLink, hasAttachments: m.hasAttachments, conversationId: m.conversationId });

class GraphMail implements MailProvider {
  live = true;
  constructor(private token: string) {}
  async mailboxes() {
    const boxes: Mailbox[] = [{ id: "me", name: "My inbox", address: "", unread: 0 }];
    for (const a of SHARED) boxes.push({ id: a, name: a.split("@")[0] + "@", address: a, unread: 0 });
    await Promise.all(boxes.map(async (b) => {
      try { b.unread = (await graph<{ unreadItemCount: number }>(this.token, `${root(b.id)}/mailFolders/inbox?$select=unreadItemCount`)).unreadItemCount; } catch { b.unread = -1; } // -1: no access
    }));
    return boxes.filter((b) => b.unread >= 0);
  }
  async list(mb: string) {
    const j = await graph<{ value: GMsg[] }>(this.token, `${root(mb)}/mailFolders/inbox/messages?$top=40&$select=id,subject,bodyPreview,receivedDateTime,isRead,webLink,hasAttachments,conversationId,from&$orderby=receivedDateTime desc`);
    return j.value.map((m) => toMsg(mb, m));
  }
  async get(mb: string, id: string) {
    const m = await graph<GMsg>(this.token, `${root(mb)}/messages/${id}?$select=id,subject,bodyPreview,receivedDateTime,isRead,webLink,hasAttachments,conversationId,from,body`, { headers: { Prefer: 'outlook.body-content-type="text"' } });
    const att = m.hasAttachments ? (await graph<{ value: { id: string; name: string; size: number }[] }>(this.token, `${root(mb)}/messages/${id}/attachments?$select=id,name,size`)).value : [];
    return { ...toMsg(mb, m), bodyText: m.body?.content || "", attachments: att };
  }
  async reply(mb: string, id: string, text: string) {
    // Sent through Outlook, so it lands in Sent Items of that mailbox.
    await graph(this.token, `${root(mb)}/messages/${id}/reply`, { method: "POST", body: JSON.stringify({ comment: text }) });
  }
}

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const S = (mailbox: string, id: string, from: string, fromEmail: string, subject: string, snippet: string, h: number, body: string, file?: string): MailBody => ({
  id, mailbox, from, fromEmail, subject, snippet, received: ago(h), unread: h < 12, webLink: "#", hasAttachments: !!file, bodyText: body, attachments: file ? [{ id: file, name: file, size: 182_000 }] : [],
});
const SAMPLE: MailBody[] = [
  S("partners@suhail.build", "s1", "Noura, [Sponsor company]", "noura@example.com", "Sponsorship tiers for Hackathon Kuwait", "Thanks for the deck. We are interested in the Gold tier if…", 2, "Hi Sara,\n\nThanks for sending the deck. We are interested in the Gold tier, on two conditions: a branded challenge track, and two of our engineers as mentors on the day.\n\nCould you share the final venue and expected attendance by next week? Our budget closes on the 10th.\n\nBest,\nNoura", "sponsorship-requirements.pdf"),
  S("partners@suhail.build", "s2", "Venue bookings", "bookings@example.com", "Hall availability 14 to 15 November", "The main hall is available, deposit due within 7 days…", 70, "Hello,\n\nThe main hall is available on 14 and 15 November for up to 250 people. A deposit of KWD 600 is due within seven days to hold the date.\n\nRegards", "hall-floorplan.pdf"),
  S("hello@suhail.build", "s3", "[University] Innovation Office", "innovation@example.edu", "Student teams for November", "We have 40 students interested in joining your hackathon…", 3, "Dear Suhail team,\n\nAround 40 of our engineering students would like to take part in the November hackathon. Is there a way to register as a group, and could one of your team speak on campus beforehand?\n\nKind regards"),
  S("hello@suhail.build", "s4", "Reem", "reem@example.com", "Podcast guest suggestion", "You should talk to the founder behind…", 50, "Hello,\n\nLoved episode 2. You should talk to a founder I know who built a logistics company from Riyadh with a team of six. Happy to introduce.\n\nReem"),
  S("tasks@suhail.build", "s5", "Sara (forwarded)", "sara@suhail.build", "FW: Catering quote #hackathon-kuwait", "Turned into a ticket and filed in Hackathon Kuwait", 1, "Forwarded to tasks@ with #hackathon-kuwait in the subject.", "catering-quote.pdf"),
  S("me", "s6", "Yousef", "yousef@suhail.build", "Benchmark dataset licence question", "Can we release the dialect set under CC BY, or does the source forbid it?", 26, "Hi Ahmed,\n\nBefore we publish the dialect evaluation set, I want to confirm the licence. Two of the sources are CC BY-NC, so we may need to drop them or ask permission.\n\nCan we decide this week?\n\nYousef"),
];
class SampleMail implements MailProvider {
  live = false;
  async mailboxes() {
    return [{ id: "me", name: "My inbox", address: "", unread: 1 }, ...SHARED.map((a) => ({ id: a, name: a.split("@")[0] + "@", address: a, unread: SAMPLE.filter((m) => m.mailbox === a && m.unread).length }))];
  }
  async list(mb: string) { return SAMPLE.filter((m) => m.mailbox === mb); }
  async get(mb: string, id: string) { return SAMPLE.find((m) => m.mailbox === mb && m.id === id) ?? null; }
  async reply() { throw new Error("Replies are sent through Outlook once Microsoft 365 is connected."); }
}

export async function mail(profileId: string): Promise<MailProvider> {
  if (m365Live()) { const t = await delegatedToken(profileId); if (t) return new GraphMail(t); }
  return new SampleMail();
}
