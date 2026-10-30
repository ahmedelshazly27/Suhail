import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketDetail } from "@/components/team/TicketDetail";
import { requireMe } from "@/lib/auth";
import { ticketCtx } from "@/lib/data/ctx";
import { getTicket } from "@/lib/data/tickets";

export async function generateMetadata({ params }: PageProps<"/team/tickets/[key]">) { return { title: (await params).key }; }

export default async function TicketPage({ params }: PageProps<"/team/tickets/[key]">) {
  const me = await requireMe();
  const { key } = await params;
  const [data, ctx] = await Promise.all([getTicket(key), ticketCtx(me)]);
  if (!data) notFound();
  return (
    <div style={{ maxWidth: "46rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <span className="eb">{data.project ? <Link href={`/team/projects/${data.project.slug}`} style={{ textDecoration: "none" }}>{data.project.name}</Link> : ""} {data.ticket.key}</span>
      <TicketDetail data={data} ctx={ctx} />
    </div>
  );
}
