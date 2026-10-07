"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { publicAssetUrl } from "@/lib/assets";

type Player = {
  id: string; name: string; photo_url: string | null; jersey_number: number | null; position: string;
  team: { name: string; short_code: string } | null;
  stats: { goals: number; assists: number; yellow_cards: number; red_cards: number; man_of_matches: number; average_rating: number | null; saves: number };
};

export default function PlayerDirectory({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [position, setPosition] = useState("all");
  const teams = Array.from(new Set(players.map((player) => player.team?.name).filter((name): name is string => Boolean(name)))).sort();
  const filtered = useMemo(() => players.filter((player) => {
    const text = `${player.name} ${player.team?.name ?? ""} ${player.team?.short_code ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (team === "all" || player.team?.name === team) && (position === "all" || player.position === position);
  }), [players, position, query, team]);
  return <div><div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-panel p-4 md:grid-cols-[1fr_180px_160px]"><label className="relative block"><Search size={16} className="absolute left-3 top-3 text-white/35" /><input aria-label="Search players" placeholder="Search players or teams" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-white/10 bg-ink py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-electric" /></label><select aria-label="Filter by team" value={team} onChange={(event) => setTeam(event.target.value)} className="rounded-xl border border-white/10 bg-ink px-3 text-sm text-white"><option value="all">All teams</option>{teams.map((name) => <option key={name} value={name}>{name}</option>)}</select><select aria-label="Filter by position" value={position} onChange={(event) => setPosition(event.target.value)} className="rounded-xl border border-white/10 bg-ink px-3 text-sm text-white"><option value="all">All positions</option>{["GK", "DEF", "MID", "FWD"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>{filtered.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50">No players match these filters.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((player) => <Link href={`/players/${player.id}`} key={player.id} className="group rounded-2xl border border-white/10 bg-panel p-4 transition hover:-translate-y-1 hover:border-electric/40"><div className="flex items-center gap-4"><img src={publicAssetUrl(player.photo_url) || "/players/default.png"} alt={`${player.name} profile`} width={72} height={72} className="h-[72px] w-[72px] rounded-2xl object-cover" /><div><h2 className="font-display text-lg font-black text-white group-hover:text-electric">{player.name}</h2><p className="text-sm text-white/50">{player.team?.name ?? "Unassigned"} · {player.position}</p><p className="mt-1 text-xs font-bold text-electric">#{player.jersey_number ?? "—"} · {player.team?.short_code ?? "AKFL"}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-[10px] font-black uppercase tracking-widest text-white/40"><span><b className="block text-base text-white">{player.stats.goals}</b>Goals</span><span><b className="block text-base text-white">{player.stats.assists}</b>Assists</span><span><b className="block text-base text-electric">{player.stats.average_rating ?? "—"}</b>Rating</span></div></Link>)}</div>}</div>;
}
