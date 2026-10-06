"use client";

import { CalendarDays, Clock3, Radio } from "lucide-react";
import { useState } from "react";
import { TeamBadge } from "@/components/team-badge";

export type PublicMatch = {
  id: string; kickoff_time: string; pitch_location: string | null;
  status: "scheduled" | "live" | "halftime" | "completed";
  home_score: number; away_score: number;
  home: { name: string; short_code: string; logo_url: string | null };
  away: { name: string; short_code: string; logo_url: string | null };
  events: Array<{ id: string; event_type: string; minute: number; player_name: string }>;
};

export default function MatchCenter({ matches }: { matches: PublicMatch[] }) {
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "results">("all");
  const visible = matches.filter((match) => filter === "all" || (filter === "live" ? ["live", "halftime"].includes(match.status) : filter === "upcoming" ? match.status === "scheduled" : match.status === "completed"));
  return <div><div className="mb-8 flex flex-wrap gap-3" role="tablist" aria-label="Match filters">{(["all", "live", "upcoming", "results"] as const).map((value) => <button type="button" role="tab" aria-selected={filter === value} key={value} onClick={() => setFilter(value)} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${filter === value ? "bg-electric text-ink" : "border border-white/10 text-white/50 hover:text-white"}`}>{value}</button>)}</div>{visible.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50">No matches in this category yet.</p> : <div className="grid gap-4">{visible.map((match) => { const live = match.status === "live" || match.status === "halftime"; const label = match.status === "completed" ? "FT" : match.status === "halftime" ? "HALF TIME" : match.status === "live" ? "LIVE" : "UPCOMING"; return <article key={match.id} className="rounded-3xl border border-white/10 bg-panel p-6"><div className="flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-white/40"><span className="flex items-center gap-2"><CalendarDays size={14} /> {new Date(match.kickoff_time).toLocaleString()} · {match.pitch_location || "Venue TBC"}</span><span className={live ? "text-electric" : "text-white/55"}>{label}</span></div><div className="mt-7 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]"><div className="flex items-center justify-end gap-3"><p className="text-right font-display text-xl font-black text-white sm:text-2xl">{match.home.name}</p><TeamBadge src={match.home.logo_url} alt={match.home.short_code} className="h-10 w-10" /></div><div className="text-center"><p className="font-display text-3xl font-black text-white">{match.status === "scheduled" ? "—" : `${match.home_score} - ${match.away_score}`}</p><p className="mt-1 flex items-center justify-center gap-1 text-xs text-white/45"><Clock3 size={13} />{match.status === "scheduled" ? new Date(match.kickoff_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : label}</p></div><div className="flex items-center gap-3"><TeamBadge src={match.away.logo_url} alt={match.away.short_code} className="h-10 w-10" /><p className="font-display text-xl font-black text-white sm:text-2xl">{match.away.name}</p></div></div>{live && match.events.length > 0 && <div className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-sm text-white/60">{match.events.map((event) => <span key={event.id} className="flex items-center gap-2"><Radio size={14} className="text-electric" />{event.minute}' {event.player_name} <span className="text-white/35">({event.event_type.replace("_", " ")})</span></span>)}</div>}</article>; })}</div>}</div>;
}
