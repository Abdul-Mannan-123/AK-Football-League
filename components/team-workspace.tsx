"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Pencil, Upload, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Team = { id: string; name: string; short_code: string; logo_url: string | null; is_disqualified: boolean };
type Player = { id: string; name: string; jersey_number: number | null; position: string; is_active: boolean; team_id: string; photo_url: string | null };

export default function TeamWorkspace() {
  const [client] = useState(() => createClient());
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("MID");
  const [photo, setPhoto] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  async function load() {
    const [teamResult, playerResult] = await Promise.all([client.from("teams").select("id,name,short_code,logo_url,is_disqualified").order("name"), client.from("players").select("id,name,jersey_number,position,is_active,team_id,photo_url").order("name")]);
    if (teamResult.error || playerResult.error) setNotice(teamResult.error?.message ?? playerResult.error?.message ?? "Could not load team workspace.");
    setTeams((teamResult.data ?? []) as Team[]); setPlayers((playerResult.data ?? []) as Player[]);
  }
  useEffect(() => { void load(); }, [client]);
  const team = teams.find((item) => item.id === teamId);
  const roster = players.filter((player) => player.team_id === teamId);
  function editPlayer(player: Player) { setEditing(player); setName(player.name); setNumber(player.jersey_number?.toString() ?? ""); setPosition(player.position); setPhoto(null); }
  function reset() { setEditing(null); setName(""); setNumber(""); setPosition("MID"); setPhoto(null); }
  async function savePlayer(event: FormEvent) {
    event.preventDefault();
    if (!teamId || !name.trim()) return setNotice("Select a team and enter a player name.");
    const jersey = number.trim() ? Number(number) : null;
    if (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) return setNotice("Jersey number must be between 0 and 99.");
    const result = editing ? await client.from("players").update({ name: name.trim(), jersey_number: jersey, position }).eq("id", editing.id).select("id").single() : await client.from("players").insert({ team_id: teamId, name: name.trim(), jersey_number: jersey, position, is_active: true }).select("id").single();
    if (result.error || !result.data) return setNotice(result.error?.message ?? "Player could not be saved.");
    if (photo) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return setNotice("Use a JPG, PNG, or WebP image.");
      if (photo.size > 2 * 1024 * 1024) return setNotice("Images must be smaller than 2 MB.");
      const extension = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${result.data.id}/${Date.now()}.${extension}`;
      const uploadResult = await client.storage.from("player-photos").upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadResult.error) return setNotice(uploadResult.error.message);
      const publicUrl = client.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
      const { error } = await client.from("players").update({ photo_url: publicUrl }).eq("id", result.data.id);
      if (error) return setNotice(error.message);
    }
    setNotice(editing ? "Player updated." : "Player added."); reset(); await load();
  }
  async function togglePlayer(player: Player) {
    const { error } = await client.from("players").update({ is_active: !player.is_active }).eq("id", player.id);
    if (error) setNotice(error.message); else await load();
  }
  async function toggleTeam() {
    if (!team) return;
    const { error } = await client.rpc("set_team_disqualification", { target_team_id: team.id, disqualified: !team.is_disqualified, reason: team.is_disqualified ? null : "Disqualified by competition administration" });
    if (error) setNotice(error.message); else { setNotice(team.is_disqualified ? "Team reinstated." : "Team disqualified."); await load(); }
  }
  return <div className="space-y-5">
    {notice && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink/60 p-3 text-sm text-white/70" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Select a team</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.short_code})</option>)}</Select>{team && <Button type="button" onClick={() => void toggleTeam()} className={team.is_disqualified ? "bg-electric text-ink" : "bg-red-500/80 text-white"}>{team.is_disqualified ? <><Check size={15} /> Reinstate team</> : "Disqualify team"}</Button>}</div>
    {teamId && <><form onSubmit={savePlayer} className="grid gap-3 rounded-2xl border border-white/10 bg-ink/40 p-4 sm:grid-cols-[1fr_120px_150px_auto]"><Input placeholder="Player name" value={name} onChange={(event) => setName(event.target.value)} /><Input type="number" min="0" max="99" placeholder="Number" value={number} onChange={(event) => setNumber(event.target.value)} /><Select value={position} onChange={(event) => setPosition(event.target.value)}><option value="GK">Goalkeeper</option><option value="DEF">Defender</option><option value="MID">Midfielder</option><option value="FWD">Forward</option></Select><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60"><Upload size={16} className="text-electric" /><span className="min-w-0 flex-1 truncate">{photo?.name ?? "Player picture"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label><Button className="gap-2 bg-electric text-ink">{editing ? <Pencil size={15} /> : <UserPlus size={15} />}{editing ? "Update" : "Add player"}</Button></form><div className="grid gap-2">{roster.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">No players in this roster yet.</p> : roster.map((player) => <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink/40 p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-black text-electric">#{player.jersey_number ?? "—"}</span><div><p className="font-bold text-white">{player.name}</p><p className="text-xs text-white/45">{player.position} · {player.is_active ? "Active" : "Inactive"}</p></div></div><div className="flex gap-2"><Button type="button" onClick={() => editPlayer(player)} className="bg-white/10 text-white"><Pencil size={14} /></Button><Button type="button" onClick={() => void togglePlayer(player)} className="bg-white/10 text-white">{player.is_active ? "Deactivate" : "Activate"}</Button></div></div>)}</div></>}
    {!teams.length && <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">Create a team in League Setup first.</p>}
  </div>;
}
