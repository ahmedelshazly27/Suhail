"use client";
import Image from "next/image";
import { useState } from "react";
import events from "@/content/events.json";
import { t, type Key, type Lang } from "@/lib/i18n";
import { Scene } from "./Scene";

const PHOTOS: Record<string, string> = { main: "/season/main.jpg", builders: "/season/builders.jpg", capital: "/season/capital.jpg" };

export function SeasonStages({ lang }: { lang: Lang }) {
  const stages = events.stages as [string, Key, Key, string][];
  const [cur, setCur] = useState("main");
  const st = stages.find((s) => s[0] === cur)!;
  return (
    <div className="stagebox">
      <div className="stagetabs" role="tablist">
        {stages.map((s) => (
          <button key={s[0]} type="button" role="tab" id={`tab-${s[0]}`} aria-controls="stagepane" aria-selected={s[0] === cur} onClick={() => setCur(s[0])}>{t(lang, s[1])}</button>
        ))}
      </div>
      <div className="stagepane" id="stagepane" role="tabpanel" aria-labelledby={`tab-${cur}`}>
        <div className="tx"><h3>{t(lang, st[1])}</h3><p>{t(lang, st[2])}</p></div>
        <div className="im">
          {st[3].startsWith("photo:") ? <Image src={PHOTOS[st[3].slice(6)]} alt="" fill sizes="(max-width: 760px) 100vw, 31rem" /> : <Scene kind="pattern" />}
        </div>
      </div>
    </div>
  );
}
