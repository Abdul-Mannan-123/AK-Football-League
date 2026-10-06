"use client";

import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Match = { id: string; status: string; home_team_id: string; away_team_id: string; homeName: string; awayName: string };
type Player = { id: string; name: string; position: string; team_id: string };
type Stat = { player_id: string; rating: string; is_man_of_match: boolean; saves: string };

export default function PlayerMatchStatsEditor() {
  const [client] = useState(() => createClient());
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [matchId, setMatchId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void Promise.all([
      client.from("matches").select("id,status,home_team_id,away_team_id,kickoff_time").eq("status", "completed").order("kickoff_time", { ascending: false }),
      client.from("teams").select("id,name"),
    ]).then(([matchResult, teamResult]) => {
      if (matchResult.error || teamResult.error) {
        setNotice(matchResult.error?.message ?? teamResult.error?.message ?? "Could not load completed matches.");
        return;
      }
      const teamNames = new Map((teamResult.data ?? []).map((team) => [team.id, team.name]));
      setMatches(((matchResult.data ?? []) as Omit<Match, "homeName" | "awayName">[]).map((match) => ({
        ...match,
        homeName: teamNames.get(match.home_team_id) ?? "Home team",
        awayName: teamNames.get(match.away_team_id) ?? "Away team",
      })));
    });
  }, [client]);

  useEffect(() => {
    if (!matchId) return;
    const match = matches.find((item) => item.id === matchId);
    if (!match) return;
    void Promise.all([
      client.from("players").select("id,name,position,team_id").in("team_id", [match.home_team_id, match.away_team_id]).order("name"),
      client.from("player_match_stats").select("player_id,rating,is_man_of_match,saves").eq("match_id", matchId),
    ]).then(([playerResult, statResult]) => {
      if (playerResult.error || statResult.error) return setNotice(playerResult.error?.message ?? statResult.error?.message ?? "Could not load player stats.");
      setPlayers((playerResult.data ?? []) as Player[]);
      setStats(Object.fromEntries((statResult.data ?? []).map((row) => [row.player_id, { player_id: row.player_id, rating: row.rating?.toString() ?? "", is_man_of_match: row.is_man_of_match, saves: row.saves?.toString() ?? "0" }])));
    });
  }, [client, matchId, matches]);

  function update(player: Player, field: keyof Stat, value: string | boolean) {
    if (field === "rating" && typeof value === "string" && value !== "") {
      const rating = Number(value);
      if (!Number.isFinite(rating)) return;
      value = String(Math.min(10, Math.max(0, rating)));
    }
    setStats((current) => ({ ...current, [player.id]: { ...(current[player.id] ?? { player_id: player.id, rating: "", is_man_of_match: false, saves: "0" }), [field]: value } }));
  }
  async function save() {
    const match = matches.find((item) => item.id === matchId);
    if (!match) return;
    const rows = players.map((player) => {
      const stat = stats[player.id] ?? { player_id: player.id, rating: "", is_man_of_match: false, saves: "0" };
      return { match_id: matchId, player_id: player.id, rating: stat.rating ? Number(stat.rating) : null, is_man_of_match: stat.is_man_of_match, saves: player.position === "GK" ? Number(stat.saves || 0) : 0 };
    });
    if (rows.some((row) => row.rating !== null && (!Number.isFinite(row.rating) || row.rating < 0 || row.rating > 10))) return setNotice("Ratings must be between 0 and 10.");
    if (rows.filter((row) => row.is_man_of_match).length > 1) return setNotice("Select only one Man of the Match.");
    if (rows.some((row) => row.saves < 0 || !Number.isInteger(row.saves))) return setNotice("Saves must be whole numbers.");
    const { error: clearMotmError } = await client.from("player_match_stats").update({ is_man_of_match: false }).eq("match_id", matchId).eq("is_man_of_match", true);
    if (clearMotmError) return setNotice(clearMotmError.message);
    const { error } = await client.from("player_match_stats").upsert(rows, { onConflict: "match_id,player_id" });
    setNotice(error ? error.message : "Player match stats saved.");
  }
  return <section className="rounded-3xl border border-white/10 bg-panel p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-electric">Post-match stats</p><h2 className="mt-2 font-display text-2xl font-black text-white">Ratings & awards</h2><p className="mt-1 text-sm text-white/50">Enter ratings, one Man of the Match award, and goalkeeper saves.</p></div><Check className="text-electric" /></div><Select className="mt-5" value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">Select completed match</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.homeName} vs {match.awayName} · {match.status}</option>)}</Select>{matches.length === 0 && !notice && <p className="mt-3 text-sm text-white/45">No completed matches are available yet.</p>}{notice && <p className="mt-3 text-sm text-red-200">{notice}</p>}{matchId && <div className="mt-5 space-y-2">{players.map((player) => { const stat = stats[player.id] ?? { player_id: player.id, rating: "", is_man_of_match: false, saves: "0" }; return <div key={player.id} className="grid items-center gap-2 rounded-xl border border-white/10 bg-ink/40 p-3 sm:grid-cols-[1fr_100px_120px_110px]"><div><p className="font-bold text-white">{player.name}</p><p className="text-xs text-white/45">{player.position}</p></div><input aria-label={`${player.name} rating`} type="number" min="0" max="10" step="0.1" placeholder="Rating" value={stat.rating} onChange={(event) => update(player, "rating", event.target.value)} className="rounded-lg border border-white/10 bg-ink px-2 py-2 text-sm text-white" /><label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={stat.is_man_of_match} onChange={(event) => update(player, "is_man_of_match", event.target.checked)} /> MOTM</label>{player.position === "GK" ? <input aria-label={`${player.name} saves`} type="number" min="0" step="1" value={stat.saves} onChange={(event) => update(player, "saves", event.target.value)} className="rounded-lg border border-white/10 bg-ink px-2 py-2 text-sm text-white" placeholder="Saves" /> : <span className="text-xs text-white/25">No saves</span>}</div>; })}<Button type="button" onClick={() => void save()} className="mt-3 gap-2 bg-electric text-ink"><Save size={16} /> Save match stats</Button></div>}</section>;
}
