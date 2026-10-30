"use client";
import { useRef } from "react";
import { updateProject } from "@/app/actions/projects";
import { Editor, type Doc } from "./Editor";
import type { Person } from "@/lib/data/shell";
import type { TLang } from "@/lib/team-i18n";

/** The project's page for briefs, runbooks and notes. Saves as you type. */
export function ProjectDoc({ id, doc, lang, people }: { id: string; doc: unknown; lang: TLang; people: Person[] }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <div style={{ maxWidth: "48rem" }}>
      <Editor value={doc as Doc} people={people} label={lang === "ar" ? "مستند المشروع" : "Project doc"} placeholder={lang === "ar" ? "اكتب الملخص أو خطة التشغيل. / للأوامر" : "Write the brief or runbook. / for commands, @ to mention"}
        onChange={(d) => { clearTimeout(timer.current); timer.current = setTimeout(() => updateProject(id, { doc: d as { type: "doc" } }), 800); }} />
    </div>
  );
}
