"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  Flag,
  Minus,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type MatchStatus = "scheduled" | "live" | "halftime" | "completed";
type EventType = "goal" | "yellow_card" | "red_card";
type Team = { id: string; name: string; short_code: string };
type Player = { id: string; name: string; team_id: string; jersey_number: number | null; photo_url: string | null };
type Match = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_time: string;
  pitch_location: string | null;
  status: MatchStatus;
  home_score: number;
  away_score: number;
};
type MatchEvent = {
  id: string;
  match_id: string;
  player_id: string;
  assist_player_id: string | null;
  event_type: EventType;
  minute: number;
  created_at: string;
};
type Draft = {
  type: EventType;
  teamId: string;
  playerId: string;
  assistPlayerId: string;
  minute: string;
};
type Notice = { kind: "success" | "error"; message: string } | null;

const emptyDraft: Draft = {
  type: "goal",
  teamId: "",
  playerId: "",
  assistPlayerId: "",
  minute: "",
};

export default function LiveMatchLogger() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventLocked, setEventLocked] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    try {
      setSupabase(createClient());
      setNow(Date.now());
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Supabase is not configured." });
      setLoading(false);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [matchResult, teamResult] = await Promise.all([
      supabase.from("matches").select("id, home_team_id, away_team_id, kickoff_time, pitch_location, status, home_score, away_score").in("status", ["scheduled", "live", "halftime", "completed"]).order("kickoff_time"),
      supabase.from("teams").select("id, name, short_code").order("name"),
    ]);
    if (matchResult.error || teamResult.error) {
      setNotice({ kind: "error", message: matchResult.error?.message ?? teamResult.error?.message ?? "Could not load matches." });
      setLoading(false);
      return;
    }
    // Coordinators and administrators may prepare or start any upcoming
    // fixture, not only matches scheduled for the current calendar day.
    const available = ((matchResult.data ?? []) as Match[]).filter(
      (match) => match.status !== "completed",
    );
    setMatches(available);
    setTeams((teamResult.data ?? []) as Team[]);
    setSelectedMatchId((current) => current || available.find((match) => match.status === "live")?.id || available[0]?.id || "");
    setLoading(false);
  }, [supabase]);

  const loadMatchDetails = useCallback(async () => {
    if (!supabase || !selectedMatchId) {
      setEvents([]);
      return;
    }
    const selected = matches.find((match) => match.id === selectedMatchId);
    if (!selected) return;
    const [eventResult, playerResult] = await Promise.all([
      supabase.from("match_events").select("id, match_id, player_id, assist_player_id, event_type, minute, created_at").eq("match_id", selectedMatchId).order("minute", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("players").select("id, name, team_id, jersey_number, photo_url").in("team_id", [selected.home_team_id, selected.away_team_id]).eq("is_active", true).order("name"),
    ]);
    if (eventResult.error || playerResult.error) {
      setNotice({ kind: "error", message: eventResult.error?.message ?? playerResult.error?.message ?? "Could not load match details." });
      return;
    }
    setScore({ home: selected.home_score, away: selected.away_score });
    setStatus(selected.status);
    setPlayers((playerResult.data ?? []) as Player[]);
    setEvents((eventResult.data ?? []) as MatchEvent[]);
    setDraft((current) => ({ ...current, teamId: selected.home_team_id, minute: String(getCurrentMinute(selected, matchStartedAt)) }));
  }, [matches, matchStartedAt, selectedMatchId, supabase]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    void loadMatchDetails();
  }, [loadMatchDetails]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);
  const homeTeam = teams.find((team) => team.id === selectedMatch?.home_team_id);
  const awayTeam = teams.find((team) => team.id === selectedMatch?.away_team_id);
  const roster = players.filter((player) => player.team_id === draft.teamId);
  const assistRoster = roster.filter((player) => player.id !== draft.playerId);
  const minute = selectedMatch ? getCurrentMinute(selectedMatch, matchStartedAt, now) : 0;

  const selectMatch = async (matchId: string) => {
    setSelectedMatchId(matchId);
    const match = matches.find((item) => item.id === matchId);
    if (match && supabase) {
      const { data, error } = await supabase.from("players").select("id, name, team_id, jersey_number, photo_url").in("team_id", [match.home_team_id, match.away_team_id]).eq("is_active", true).order("name");
      if (error) setNotice({ kind: "error", message: error.message });
      else setPlayers((data ?? []) as Player[]);
    }
  };

  const updateMatchStatus = async (nextStatus: MatchStatus) => {
    if (!supabase || !selectedMatchId) return;
    const previous = status;
    setStatus(nextStatus);
    if (nextStatus === "live" && !matchStartedAt) setMatchStartedAt(Date.now());
    const { error } = await supabase.rpc("set_match_status", {
      target_match_id: selectedMatchId,
      next_status: nextStatus,
    });
    if (error) {
      setStatus(previous);
      setNotice({ kind: "error", message: error.message });
    } else {
      setMatches((current) => current.map((match) => match.id === selectedMatchId ? { ...match, status: nextStatus } : match));
      setNotice({ kind: "success", message: nextStatus === "completed" ? "Match marked full time." : nextStatus === "live" ? "Match started." : "Half time saved." });
    }
  };

  const openEventModal = async (type: EventType) => {
    if (!selectedMatchId || !selectedMatch || status !== "live" || eventLocked) {
      setNotice({ kind: "error", message: "Events can only be logged while the match is live." });
      return;
    }
    if (!players.length) {
      await selectMatch(selectedMatchId);
    }
    setDraft({ ...emptyDraft, type, teamId: selectedMatch.home_team_id, minute: String(minute) });
    setModalOpen(true);
  };

  const submitEvent = async () => {
    if (!supabase || !selectedMatch || status !== "live" || eventLocked || !draft.teamId || !draft.playerId || !draft.minute) {
      setNotice({ kind: "error", message: "Select a team, player, and minute." });
      return;
    }
    const eventType = draft.type;
    const minuteValue = Number(draft.minute);
    if (!Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 150) {
      setNotice({ kind: "error", message: "Minute must be a whole number from 0 to 150." });
      return;
    }
    setEventLocked(true);
    const isHome = draft.teamId === selectedMatch.home_team_id;
    setSaving(true);
    const { data: inserted, error: eventError } = await supabase.rpc("log_match_event", {
      p_match_id: selectedMatch.id,
      p_player_id: draft.playerId,
      p_assist_player_id: eventType === "goal" ? draft.assistPlayerId || null : null,
      p_event_type: eventType,
      p_minute: minuteValue,
    });
    if (eventError || !inserted) {
      setNotice({ kind: "error", message: eventError?.message ?? "Could not save event." });
      setSaving(false);
      window.setTimeout(() => setEventLocked(false), 2000);
      return;
    }
    const updatedScore = eventType === "goal"
      ? { ...score, [isHome ? "home" : "away"]: score[isHome ? "home" : "away"] + 1 }
      : score;
    setEvents((current) => [inserted as MatchEvent, ...current]);
    setScore(updatedScore);
    setMatches((current) => current.map((match) => match.id === selectedMatch.id ? { ...match, home_score: updatedScore.home, away_score: updatedScore.away } : match));
    setNotice({ kind: "success", message: "Match event logged." });
    setModalOpen(false);
    setSaving(false);
    window.setTimeout(() => setEventLocked(false), 2000);
  };

  const removeEvent = async (event: MatchEvent) => {
    if (!supabase || event.id.startsWith("optimistic-")) return;
    const isGoal = event.event_type === "goal";
    const eventPlayer = players.find((player) => player.id === event.player_id);
    const isHome = eventPlayer?.team_id === selectedMatch?.home_team_id;
    const previousScore = score;
    setEvents((current) => current.filter((item) => item.id !== event.id));
    const nextScore = isGoal ? { ...score, [isHome ? "home" : "away"]: Math.max(0, score[isHome ? "home" : "away"] - 1) } : score;
    if (isGoal) setScore(nextScore);
    const { error } = await supabase.rpc("undo_match_event", {
      p_match_event_id: event.id,
    });
    if (error) {
      setEvents((current) => [...current, event].sort((a, b) => b.minute - a.minute));
      setScore(previousScore);
      setNotice({ kind: "error", message: error.message });
      return;
    }
    setMatches((current) => current.map((match) => match.id === selectedMatchId ? { ...match, home_score: nextScore.home, away_score: nextScore.away } : match));
    setNotice({ kind: "success", message: "Event removed." });
  };

  const playerName = (id: string | null) => players.find((player) => player.id === id)?.name ?? "Unknown player";
  const teamLabel = (id: string) => id === selectedMatch?.home_team_id ? homeTeam?.short_code ?? "HOME" : awayTeam?.short_code ?? "AWAY";

  return (
    <main className="min-h-screen bg-ink px-4 pb-10 pt-4 text-white sm:px-6">
      {notice && <div className={`fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl ${notice.kind === "success" ? "border-electric/40 bg-[#172313] text-electric" : "border-red-400/40 bg-[#2a1417] text-red-100"}`}><span>{notice.kind === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}</span>{notice.message}</div>}
      <div className="mx-auto max-w-xl space-y-4">
        <header className="flex items-center justify-between py-2"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-electric text-ink"><Flag size={20} /></div><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-electric">Pitchside mode</p><h1 className="font-display text-xl font-black">Live Match Logger</h1></div></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${status === "live" ? "bg-red-500/15 text-red-300" : status === "completed" ? "bg-white/10 text-white/50" : status === "halftime" ? "bg-sky/15 text-sky" : "bg-yellow-400/15 text-yellow-200"}`}>{status === "halftime" ? "half time" : status}</span></header>

        <section className="rounded-3xl border border-white/10 bg-panel p-4 shadow-glow">
          <FormLabel htmlFor="match-selector">Active match</FormLabel>
          <div className="relative mt-2"><Select id="match-selector" value={selectedMatchId} onChange={(event) => void selectMatch(event.target.value)} disabled={loading}><option value="">{loading ? "Loading matches..." : "Select a match"}</option>{matches.map((match) => <option key={match.id} value={match.id}>{teams.find((team) => team.id === match.home_team_id)?.name ?? "Home"} vs {teams.find((team) => team.id === match.away_team_id)?.name ?? "Away"} · {new Date(match.kickoff_time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</option>)}</Select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-white/35" size={17} /></div>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div><p className="text-xs font-bold uppercase tracking-widest text-white/50">{homeTeam?.short_code ?? "HOME"}</p><p className="mt-1 font-display text-6xl font-black text-white">{score.home}</p></div><div><span className="text-sm font-black text-white/20">VS</span><p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-electric"><Clock3 size={13} /> {minute}&apos;</p></div><div><p className="text-xs font-bold uppercase tracking-widest text-white/50">{awayTeam?.short_code ?? "AWAY"}</p><p className="mt-1 font-display text-6xl font-black text-white">{score.away}</p></div></div>
          <div className="mt-6 grid grid-cols-3 gap-2"><Button type="button" onClick={() => void updateMatchStatus("live")} disabled={!selectedMatchId || status === "live" || status === "completed"} className="min-h-12 gap-1 bg-electric text-xs text-ink hover:bg-[#e4ff70]"><Play size={15} fill="currentColor" /> {status === "halftime" ? "Resume" : "Start"}</Button><Button type="button" onClick={() => void updateMatchStatus("halftime")} disabled={!selectedMatchId || status !== "live"} className="min-h-12 gap-1 bg-white/10 text-xs text-white hover:bg-white/15"><Pause size={15} /> Half time</Button><Button type="button" onClick={() => void updateMatchStatus("completed")} disabled={!selectedMatchId || status === "completed"} className="min-h-12 gap-1 bg-red-500/15 text-xs text-red-100 hover:bg-red-500/25"><CircleStop size={15} /> Full time</Button></div>
        </section>

        {status === "live" && <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><QuickButton disabled={eventLocked} label="Goal" color="bg-electric text-ink" icon={<Trophy size={22} />} onClick={() => void openEventModal("goal")} /><QuickButton disabled={eventLocked} label="Yellow" color="bg-yellow-300 text-ink" icon={<Minus size={22} />} onClick={() => void openEventModal("yellow_card")} /><QuickButton disabled={eventLocked} label="Red" color="bg-red-500 text-white" icon={<Minus size={22} />} onClick={() => void openEventModal("red_card")} /><QuickButton disabled={false} label="Substitute" color="bg-sky text-ink" icon={<RotateCcw size={22} />} onClick={() => setNotice({ kind: "success", message: "Substitution workflow is ready for lineup data." })} /></section>}

        <section className="rounded-3xl border border-white/10 bg-panel p-4"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-electric">Referee record</p><h2 className="mt-1 font-display text-xl font-bold">Live event stream</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">{events.length} events</span></div>{events.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Logged events will appear here.</div> : <div className="space-y-3">{events.map((event) => { const eventPlayer = players.find((player) => player.id === event.player_id); return <div key={event.id} className="flex items-center gap-3 border-l-2 border-white/10 pl-3"><PlayerAvatar player={eventPlayer} /><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${event.event_type === "goal" ? "bg-electric/15 text-electric" : event.event_type === "yellow_card" ? "bg-yellow-300/15 text-yellow-200" : "bg-red-500/15 text-red-200"}`}>{event.event_type === "goal" ? <Trophy size={17} /> : <Minus size={17} />}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white"><span className="mr-2 text-electric">{event.minute}&apos;</span>{event.event_type === "goal" ? "Goal" : event.event_type === "yellow_card" ? "Yellow card" : "Red card"} <span className="text-white/50">· {playerName(event.player_id)}</span></p><p className="text-xs text-white/35">{teamLabel(eventPlayer?.team_id ?? "")}{event.assist_player_id ? ` · Assist: ${playerName(event.assist_player_id)}` : ""}</p></div><Button type="button" onClick={() => void removeEvent(event)} className="h-10 w-10 shrink-0 rounded-xl bg-white/5 p-0 text-white/45 hover:bg-red-500/15 hover:text-red-200" aria-label="Undo event"><RotateCcw size={16} /></Button></div>; })}</div>}</section>
      </div>

      {modalOpen && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="w-full max-w-xl rounded-t-3xl border border-white/10 bg-[#111722] p-5 pb-7 sm:rounded-3xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-electric">New match event</p><h2 className="mt-1 font-display text-xl font-bold">{draft.type === "goal" ? "Goal" : draft.type === "yellow_card" ? "Yellow card" : "Red card"}</h2></div><Button type="button" onClick={() => setModalOpen(false)} className="h-10 w-10 rounded-xl bg-white/10 p-0 text-white/60"><X size={18} /></Button></div><div className="space-y-4"><div><FormLabel htmlFor="event-team">Team</FormLabel><Select id="event-team" className="mt-2" value={draft.teamId} onChange={(event) => setDraft({ ...draft, teamId: event.target.value, playerId: "", assistPlayerId: "" })}><option value={selectedMatch?.home_team_id}>{homeTeam?.name ?? "Home team"}</option><option value={selectedMatch?.away_team_id}>{awayTeam?.name ?? "Away team"}</option></Select></div><div><FormLabel htmlFor="event-player">Player</FormLabel><Select id="event-player" className="mt-2" value={draft.playerId} onChange={(event) => setDraft({ ...draft, playerId: event.target.value })}><option value="">Select player</option>{roster.map((player) => <option key={player.id} value={player.id}>{player.jersey_number ? `#${player.jersey_number} ` : ""}{player.name}</option>)}</Select></div>{draft.type === "goal" && <div><FormLabel htmlFor="assist-player">Assist player <span className="normal-case tracking-normal text-white/30">(optional)</span></FormLabel><Select id="assist-player" className="mt-2" value={draft.assistPlayerId} onChange={(event) => setDraft({ ...draft, assistPlayerId: event.target.value })}><option value="">No assist</option>{assistRoster.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</Select></div>}<div><FormLabel htmlFor="event-minute">Minute</FormLabel><Input id="event-minute" className="mt-2 text-lg font-bold" inputMode="numeric" type="number" min="0" max="150" value={draft.minute} onChange={(event) => setDraft({ ...draft, minute: event.target.value })} /></div><Button type="button" disabled={saving} onClick={() => void submitEvent()} className="min-h-12 w-full gap-2 bg-electric text-ink hover:bg-[#e4ff70]"><Check size={18} />{saving ? "Saving event..." : "Confirm event"}</Button></div></div></div>}
    </main>
  );
}

function QuickButton({ label, color, icon, onClick, disabled }: { label: string; color: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl text-sm font-black uppercase tracking-widest shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${color}`}><span>{icon}</span>+ {label}</button>;
}

function PlayerAvatar({ player }: { player?: Player }) {
  const [src, setSrc] = useState(player?.photo_url || "/players/default.png");
  return <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10"><Image src={src} alt={player?.name ? `${player.name} photo` : "Player photo"} fill sizes="36px" className="object-cover" onError={() => setSrc("/players/default.png")} /></div>;
}

function getCurrentMinute(match: Match, startedAt: number | null, timestamp = Date.now()) {
  if (startedAt) return Math.max(0, Math.floor((timestamp - startedAt) / 60000));
  return Math.max(0, Math.floor((timestamp - new Date(match.kickoff_time).getTime()) / 60000));
}
