"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardList, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Match = { id: string; home_team_id: string; away_team_id: string; kickoff_time: string; status: string };
type Team = { id: string; name: string; short_code: string };
type Player = { id: string; team_id: string; name: string; jersey_number: number | null; position: string; is_active: boolean };
type Lineup = { id: string; match_id: string; team_id: string; player_id: string; is_starting: boolean; position: string | null };
type Notice = { type: "success" | "error"; text: string } | null;

export default function LineupEditor() {
  const supabase = useMemo(() => createClient(), []);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [matchId, setMatchId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [position, setPosition] = useState("");
  const [isStarting, setIsStarting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    const [matchResult, teamResult, playerResult] = await Promise.all([
      supabase.from("matches").select("id,home_team_id,away_team_id,kickoff_time,status").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time"),
      supabase.from("teams").select("id,name,short_code").order("name"),
      supabase.from("players").select("id,team_id,name,jersey_number,position,is_active").eq("is_active", true).order("name"),
    ]);
    const error = matchResult.error ?? teamResult.error ?? playerResult.error;
    if (error) setNotice({ type: "error", text: error.message });
    setMatches((matchResult.data ?? []) as Match[]);
    setTeams((teamResult.data ?? []) as Team[]);
    setPlayers((playerResult.data ?? []) as Player[]);
    setMatchId((current) => current || matchResult.data?.[0]?.id || "");
    setLoading(false);
  }, [supabase]);

  const loadLineups = useCallback(async () => {
    if (!matchId) {
      setLineups([]);
      return;
    }
    const { data, error } = await supabase.from("lineups").select("id,match_id,team_id,player_id,is_starting,position").eq("match_id", matchId);
    if (error) setNotice({ type: "error", text: error.message });
    setLineups((data ?? []) as Lineup[]);
  }, [matchId, supabase]);

  useEffect(() => { void loadBaseData(); }, [loadBaseData]);
  useEffect(() => { void loadLineups(); }, [loadLineups]);

  const selectedMatch = matches.find((match) => match.id === matchId);
  const matchTeams = teams.filter((team) => team.id === selectedMatch?.home_team_id || team.id === selectedMatch?.away_team_id);
  const teamPlayers = players.filter((player) => player.team_id === teamId);
  const selectedPlayerIds = new Set(lineups.filter((entry) => entry.team_id === teamId).map((entry) => entry.player_id));
  const teamLineups = lineups.filter((entry) => entry.team_id === teamId);
  const starters = teamLineups.filter((entry) => entry.is_starting);
  const substitutes = teamLineups.filter((entry) => !entry.is_starting);

  useEffect(() => {
    if (selectedMatch && !teamId) setTeamId(selectedMatch.home_team_id);
    if (selectedMatch && teamId && !matchTeams.some((team) => team.id === teamId)) setTeamId(selectedMatch.home_team_id);
  }, [matchTeams, selectedMatch, teamId]);

  async function addPlayer() {
    if (!matchId || !teamId || !playerId) {
      setNotice({ type: "error", text: "Select a match, team, and player." });
      return;
    }
    if (selectedPlayerIds.has(playerId)) {
      setNotice({ type: "error", text: "That player is already on this lineup." });
      return;
    }
    if (isStarting && starters.length >= 11) {
      setNotice({ type: "error", text: "A team can have no more than 11 starters." });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("lineups").insert({
      match_id: matchId,
      team_id: teamId,
      player_id: playerId,
      is_starting: isStarting,
      position: position || null,
    }).select("id,match_id,team_id,player_id,is_starting,position").single();
    if (error) setNotice({ type: "error", text: error.message });
    else {
      setLineups((current) => [...current, data as Lineup]);
      setPlayerId("");
      setPosition("");
      setNotice({ type: "success", text: "Player added to lineup." });
    }
    setSaving(false);
  }

  async function removePlayer(entry: Lineup) {
    const { error } = await supabase.from("lineups").delete().eq("id", entry.id);
    if (error) setNotice({ type: "error", text: error.message });
    else {
      setLineups((current) => current.filter((item) => item.id !== entry.id));
      setNotice({ type: "success", text: "Player removed from lineup." });
    }
  }

  function playerName(id: string) {
    const player = players.find((item) => item.id === id);
    return player ? `${player.jersey_number ? `#${player.jersey_number} ` : ""}${player.name}` : "Unknown player";
  }

  return <section className="rounded-3xl border border-white/10 bg-panel p-5 text-white sm:p-8">
    <div className="mb-6 flex items-start gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-electric text-ink"><ClipboardList size={21} /></div>
      <div><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">Matchday operations</p><h1 className="mt-2 font-display text-2xl font-black">Team lineups</h1><p className="mt-1 text-sm text-white/50">Select starters and substitutes before kickoff.</p></div>
    </div>
    {notice && <p className={`mb-5 rounded-xl border p-3 text-sm ${notice.type === "success" ? "border-electric/30 bg-electric/10 text-electric" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>{notice.text}</p>}
    {loading ? <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 size={16} className="animate-spin" /> Loading lineup data...</div> : matches.length === 0 || teams.length === 0 || players.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm leading-6 text-white/55">This editor is ready, but your league setup is empty. Go to <Link href="/admin" className="font-bold text-electric underline">Admin Portal → League setup</Link> to create a season, teams, and players. Then create a fixture in the Fixture Editor and return here.</div> : <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-white/45">Match<Select value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">Select match</option>{matches.map((match) => <option key={match.id} value={match.id}>{teamName(match.home_team_id)} vs {teamName(match.away_team_id)} · {new Date(match.kickoff_time).toLocaleDateString()} · {match.id}</option>)}</Select><span className="break-all text-[10px] normal-case tracking-normal text-white/35">Selected match ID: {matchId || "none"}</span></label>
        <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-white/45">Team<Select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Select team</option>{matchTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></label>
        <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-white/45">Player<Select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Select active player</option>{teamPlayers.filter((player) => !selectedPlayerIds.has(player.id)).map((player) => <option key={player.id} value={player.id}>{player.jersey_number ? `#${player.jersey_number} ` : ""}{player.name} · {player.position}</option>)}</Select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-xs font-black uppercase tracking-widest text-white/45">Position<Select value={position} onChange={(event) => setPosition(event.target.value)}><option value="">Use roster position</option><option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option></Select></label><label className="flex items-center gap-2 self-end pb-3 text-sm text-white/65"><input type="checkbox" checked={isStarting} onChange={(event) => setIsStarting(event.target.checked)} /> Starting XI</label></div>
        <Button type="button" disabled={saving} onClick={() => void addPlayer()} className="min-h-12 w-full gap-2 bg-electric text-ink"><Check size={17} /> {saving ? "Saving..." : "Add to lineup"}</Button>
      </div>
      <div className="space-y-5">
        <LineupList title={`Starting XI (${starters.length}/11)`} entries={starters} playerName={playerName} onRemove={removePlayer} />
        <LineupList title={`Substitutes (${substitutes.length})`} entries={substitutes} playerName={playerName} onRemove={removePlayer} />
      </div>
    </div>}
  </section>;

  function teamName(id: string) { return teams.find((team) => team.id === id)?.name ?? "Unknown team"; }
}

function LineupList({ title, entries, playerName, onRemove }: { title: string; entries: Lineup[]; playerName: (id: string) => string; onRemove: (entry: Lineup) => Promise<void> }) {
  return <div><div className="mb-2 flex items-center justify-between"><h2 className="font-display text-lg font-black text-white">{title}</h2>{entries.length > 0 && <span className="text-xs text-white/40">Saved</span>}</div><div className="space-y-2 rounded-2xl border border-white/10 bg-ink/40 p-3">{entries.length === 0 ? <p className="p-3 text-sm text-white/35">No players added yet.</p> : entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"><div><span className="text-sm font-bold text-white">{playerName(entry.player_id)}</span><span className="ml-2 text-xs text-electric">{entry.position ?? "Roster position"}</span></div><button type="button" onClick={() => void onRemove(entry)} className="rounded-lg p-2 text-white/35 hover:bg-red-500/15 hover:text-red-200" aria-label={`Remove ${playerName(entry.player_id)}`}><Trash2 size={15} /></button></div>)}</div></div>;
}
