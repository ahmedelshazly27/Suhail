import "server-only";
import { delegatedToken, graph, m365Live } from "./graph";

export type DriveItem = { id: string; name: string; kind: "DIR" | "DOC" | "XLS" | "PPT" | "PDF" | "IMG" | "ZIP" | "FILE"; webUrl: string; path: string; modified: string; by: string; size?: number; children?: number };
export type Folder = { id: string; name: string; restricted?: boolean; access: string };

export interface DriveProvider {
  readonly live: boolean;
  folders(): Promise<Folder[]>;
  list(folderId: string | "root"): Promise<DriveItem[]>;
  recent(): Promise<DriveItem[]>;
  search(q: string): Promise<DriveItem[]>;
  createFolder(parentId: string, name: string): Promise<DriveItem>;
  createOffice(parentId: string, kind: "docx" | "xlsx" | "pptx", name: string): Promise<DriveItem>;
}

/** Top-level folders created at setup, and who can see them (docs/microsoft.md). */
export const DRIVE_FOLDERS: Folder[] = [
  { id: "brand", name: "Brand", access: "Everyone in the Suhail team · edit: Layla, Ahmed" },
  { id: "templates", name: "Templates", access: "Everyone in the Suhail team" },
  { id: "partnerships", name: "Partnerships", access: "Everyone in the Suhail team" },
  { id: "events", name: "Events", access: "Everyone in the Suhail team" },
  { id: "finance", name: "Finance", restricted: true, access: "Restricted: owners and Finance only" },
  { id: "team", name: "Team", access: "Everyone in the Suhail team" },
  { id: "projects", name: "Projects", access: "Created automatically for each project" },
];

const kindOf = (name: string, folder?: boolean): DriveItem["kind"] => {
  if (folder) return "DIR";
  const e = name.split(".").pop()?.toLowerCase();
  return ({ docx: "DOC", doc: "DOC", xlsx: "XLS", xls: "XLS", csv: "XLS", pptx: "PPT", ppt: "PPT", pdf: "PDF", png: "IMG", jpg: "IMG", jpeg: "IMG", zip: "ZIP" } as Record<string, DriveItem["kind"]>)[e || ""] ?? "FILE";
};
type GItem = { id: string; name: string; webUrl: string; folder?: { childCount: number }; lastModifiedDateTime: string; lastModifiedBy?: { user?: { displayName?: string } }; size?: number; parentReference?: { path?: string } };
const toItem = (g: GItem): DriveItem => ({ id: g.id, name: g.name, kind: kindOf(g.name, !!g.folder), webUrl: g.webUrl, path: (g.parentReference?.path || "").replace(/^.*root:/, ""), modified: g.lastModifiedDateTime, by: g.lastModifiedBy?.user?.displayName || "", size: g.size, children: g.folder?.childCount });

/** The "Suhail" SharePoint team site document library. SHAREPOINT_DRIVE_ID is set during setup. */
class GraphDrive implements DriveProvider {
  live = true;
  constructor(private token: string, private driveId = process.env.SHAREPOINT_DRIVE_ID || "") {}
  private base = () => `/drives/${this.driveId}`;
  async folders() {
    const j = await graph<{ value: GItem[] }>(this.token, `${this.base()}/root/children?$filter=folder ne null`);
    return j.value.map((g) => ({ id: g.id, name: g.name, restricted: g.name === "Finance", access: DRIVE_FOLDERS.find((f) => f.name === g.name)?.access ?? "" }));
  }
  async list(id: string) { return (await graph<{ value: GItem[] }>(this.token, `${this.base()}/${id === "root" ? "root" : `items/${id}`}/children?$top=200`)).value.map(toItem); }
  async recent() { return (await graph<{ value: GItem[] }>(this.token, `/me/drive/recent?$top=12`)).value.map(toItem); }
  async search(q: string) {
    const j = await graph<{ value: { hitsContainers: { hits?: { resource: GItem }[] }[] }[] }>(this.token, "/search/query", { method: "POST", body: JSON.stringify({ requests: [{ entityTypes: ["driveItem"], query: { queryString: q }, size: 10 }] }) });
    return (j.value[0]?.hitsContainers[0]?.hits || []).map((h) => toItem(h.resource));
  }
  async createFolder(parentId: string, name: string) {
    return toItem(await graph<GItem>(this.token, `${this.base()}/items/${parentId}/children`, { method: "POST", body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }) }));
  }
  async createOffice(parentId: string, kind: "docx" | "xlsx" | "pptx", name: string) {
    // An empty upload makes Office on the web create a fresh document on first open.
    const r = await fetch(`https://graph.microsoft.com/v1.0${this.base()}/items/${parentId}:/${encodeURIComponent(name)}.${kind}:/content`, { method: "PUT", headers: { authorization: `Bearer ${this.token}` }, body: new Uint8Array() });
    return toItem((await r.json()) as GItem);
  }
}

/** Sample data shown, and labelled as sample data, until Microsoft 365 is connected. */
class SampleDrive implements DriveProvider {
  live = false;
  private f = (kind: DriveItem["kind"], name: string, by: string, days: number, path: string): DriveItem => ({ id: `${path}/${name}`, name, kind, webUrl: "#", path, modified: new Date(Date.now() - days * 864e5).toISOString(), by });
  private files: Record<string, DriveItem[]> = {
    brand: [this.f("ZIP", "Suhail logo pack (star, wordmark, Arabic)", "Layla", 2, "/Brand"), this.f("ZIP", "Fonts: Newsreader, IBM Plex, Amiri", "Ahmed", 21, "/Brand"), this.f("PDF", "Brand guide", "Layla", 14, "/Brand"), this.f("PPT", "Master deck", "Ahmed", 7, "/Brand")],
    templates: [this.f("PPT", "Sponsor deck template", "Sara", 7, "/Templates"), this.f("DOC", "Partnership agreement template", "Ahmed", 14, "/Templates"), this.f("DOC", "Event run sheet", "Sara", 10, "/Templates"), this.f("XLS", "Event budget", "Finance", 12, "/Templates"), this.f("DOC", "Podcast guest brief", "Layla", 16, "/Templates")],
    partnerships: [this.f("PPT", "Sponsor deck v2", "Sara", 0, "/Partnerships")],
    events: [this.f("XLS", "Venue options", "Sara", 1, "/Events"), this.f("DOC", "Judging criteria", "Yousef", 4, "/Events")],
    finance: [this.f("XLS", "Budget 2026", "Finance", 0, "/Finance")],
    team: [this.f("DOC", "Onboarding: start here", "Ahmed", 14, "/Team"), this.f("DOC", "How we work: sprints and stand-up", "Ahmed", 14, "/Team"), this.f("DOC", "Roles and responsibilities", "Ahmed", 14, "/Team")],
    projects: [],
  };
  async folders() { return DRIVE_FOLDERS; }
  async list(id: string) { return id === "root" ? DRIVE_FOLDERS.map((x) => ({ id: x.id, name: x.name, kind: "DIR" as const, webUrl: "#", path: "/", modified: new Date().toISOString(), by: "", children: this.files[x.id]?.length ?? 0 })) : this.files[id] ?? []; }
  async recent() { return Object.values(this.files).flat().sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 4); }
  async search(q: string) { const s = q.toLowerCase(); return Object.values(this.files).flat().filter((x) => x.name.toLowerCase().includes(s)).slice(0, 10); }
  async createFolder(_: string, name: string): Promise<DriveItem> { return this.f("DIR", name, "", 0, "/"); }
  async createOffice(_: string, kind: "docx" | "xlsx" | "pptx", name: string): Promise<DriveItem> { return this.f(kindOf(`x.${kind}`), name, "", 0, "/"); }
}

export async function drive(profileId: string): Promise<DriveProvider> {
  if (m365Live()) { const t = await delegatedToken(profileId); if (t) return new GraphDrive(t); }
  return new SampleDrive();
}
