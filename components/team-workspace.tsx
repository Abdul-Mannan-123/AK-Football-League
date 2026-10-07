"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Pencil, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { publicAssetUrl } from "@/lib/assets";

type Team = { id: string; name: string; short_code: string; logo_url: string | null; is_disqualified: boolean };
type Player = { id: string; name: string; jersey_number: number | null; position: string; is_active: boolean; team_id: string; photo_url: string | null };

const imageTypes = ["image/jpeg", "image/png", "image/webp"];

function assetUrl(value: string | null, bucket: string) {
  return publicAssetUrl(value, bucket);
}

export default function TeamWorkspace() {
  const [client] = useState(() => createClient());
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamId, setTeamId] = useState("");
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("MID");
  const [playerPhoto, setPlayerPhoto] = useState<File | null>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    const [teamResult, playerResult] = await Promise.all([
      client.from("teams").select("id,name,short_code,logo_url,is_disqualified").order("name"),
      client.from("players").select("id,name,jersey_number,position,is_active,team_id,photo_url").order("name"),
    ]);
    if (teamResult.error || playerResult.error) setNotice(teamResult.error?.message ?? playerResult.error?.message ?? "Could not load team workspace.");
    setTeams((teamResult.data ?? []) as Team[]);
    setPlayers((playerResult.data ?? []) as Player[]);
  }

  useEffect(() => { void load(); }, [client]);

  const team = teams.find((item) => item.id === teamId);
  const roster = players.filter((player) => player.team_id === teamId);

  function startTeamEdit() {
    if (!team) return;
    setEditingTeam(true);
    setTeamName(team.name);
    setTeamCode(team.short_code);
    setTeamLogo(null);
  }

  function startPlayerEdit(player: Player) {
    setEditingPlayer(player);
    setPlayerName(player.name);
    setPlayerNumber(player.jersey_number?.toString() ?? "");
    setPlayerPosition(player.position);
    setPlayerPhoto(null);
  }

  function resetPlayer() {
    setEditingPlayer(null);
    setPlayerName("");
    setPlayerNumber("");
    setPlayerPosition("MID");
    setPlayerPhoto(null);
  }

  async function uploadAsset(bucket: "team-logos" | "player-photos", id: string, file: File) {
    if (!imageTypes.includes(file.type)) {
      setNotice("Use a JPG, PNG, or WebP image.");
      return null;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Images must be smaller than 2 MB.");
      return null;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${id}/${Date.now()}.${extension}`;
    const uploadResult = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadResult.error) {
      setNotice(`Upload failed: ${uploadResult.error.message}`);
      return null;
    }
    return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    if (!team || !teamName.trim() || !teamCode.trim()) return setNotice("Enter a team name and short code.");
    const { error } = await client.from("teams").update({ name: teamName.trim(), short_code: teamCode.trim().toUpperCase() }).eq("id", team.id);
    if (error) return setNotice(error.message);
    if (teamLogo) {
      const url = await uploadAsset("team-logos", team.id, teamLogo);
      if (!url) return;
      const { error: imageError } = await client.from("teams").update({ logo_url: url }).eq("id", team.id);
      if (imageError) return setNotice(imageError.message);
    }
    setEditingTeam(false);
    setNotice("Team updated.");
    await load();
  }

  async function savePlayer(event: FormEvent) {
    event.preventDefault();
    if (!teamId || !playerName.trim()) return setNotice("Select a team and enter a player name.");
    const jersey = playerNumber.trim() ? Number(playerNumber) : null;
    if (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) return setNotice("Jersey number must be between 0 and 99.");
    const result = editingPlayer
      ? await client.from("players").update({ name: playerName.trim(), jersey_number: jersey, position: playerPosition }).eq("id", editingPlayer.id).select("id").single()
      : await client.from("players").insert({ team_id: teamId, name: playerName.trim(), jersey_number: jersey, position: playerPosition, is_active: true }).select("id").single();
    if (result.error || !result.data) return setNotice(result.error?.message ?? "Player could not be saved.");
    if (playerPhoto) {
      const url = await uploadAsset("player-photos", result.data.id, playerPhoto);
      if (!url) return;
      const { error } = await client.from("players").update({ photo_url: url }).eq("id", result.data.id);
      if (error) return setNotice(error.message);
    }
    setNotice(editingPlayer ? "Player updated." : "Player added.");
    resetPlayer();
    await load();
  }

  async function togglePlayer(player: Player) {
    const { error } = await client.from("players").update({ is_active: !player.is_active }).eq("id", player.id);
    if (error) setNotice(error.message); else await load();
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`Delete ${player.name}? This cannot be undone.`)) return;
    const { error } = await client.from("players").delete().eq("id", player.id);
    if (error) setNotice(error.message); else { setNotice("Player deleted."); resetPlayer(); await load(); }
  }

  async function toggleTeam() {
    if (!team) return;
    const { error } = await client.rpc("set_team_disqualification", { target_team_id: team.id, disqualified: !team.is_disqualified, reason: team.is_disqualified ? null : "Disqualified by competition administration" });
    if (error) setNotice(error.message); else { setNotice(team.is_disqualified ? "Team reinstated." : "Team disqualified."); await load(); }
  }

  return <div className="space-y-5">
    {notice && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink/60 p-3 text-sm text-white/70" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <Select value={teamId} onChange={(event) => { setTeamId(event.target.value); setEditingTeam(false); resetPlayer(); }}><option value="">Select a team</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.short_code})</option>)}</Select>
      {team && <Button type="button" onClick={startTeamEdit} className="gap-2 bg-white/10 text-white"><Pencil size={15} /> Edit team</Button>}
      {team && <Button type="button" onClick={() => void toggleTeam()} className={team.is_disqualified ? "bg-electric text-ink" : "bg-red-500/80 text-white"}>{team.is_disqualified ? <><Check size={15} /> Reinstate</> : "Disqualify"}</Button>}
    </div>
    {team && <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink/40 p-4"><img src={assetUrl(team.logo_url, "team-logos") ?? "/players/default.png"} alt={`${team.name} logo`} className="h-16 w-16 rounded-xl bg-white object-contain p-1" /><div><p className="font-display text-xl font-black text-white">{team.name}</p><p className="text-sm text-white/45">{team.short_code} · {team.logo_url ? "Logo uploaded" : "No logo uploaded"}</p></div></div>}
    {editingTeam && team && <form onSubmit={saveTeam} className="grid gap-3 rounded-2xl border border-electric/30 bg-ink/40 p-4"><p className="text-xs font-black uppercase tracking-widest text-electric">Edit team</p><Input placeholder="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} /><Input placeholder="Short code" maxLength={6} value={teamCode} onChange={(event) => setTeamCode(event.target.value)} /><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60"><Upload size={16} className="text-electric" /><span className="min-w-0 flex-1 truncate">{teamLogo?.name ?? "Replace team logo (optional)"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setTeamLogo(event.target.files?.[0] ?? null)} /></label><div className="flex gap-2"><Button className="bg-electric text-ink">Save team</Button><Button type="button" onClick={() => setEditingTeam(false)} className="bg-white/10 text-white">Cancel</Button></div></form>}
    {teamId && <><form onSubmit={savePlayer} className="grid gap-3 rounded-2xl border border-white/10 bg-ink/40 p-4 sm:grid-cols-[1fr_120px_150px_auto]"><Input placeholder="Player name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} /><Input type="number" min="0" max="99" placeholder="Number" value={playerNumber} onChange={(event) => setPlayerNumber(event.target.value)} /><Select value={playerPosition} onChange={(event) => setPlayerPosition(event.target.value)}><option value="GK">Goalkeeper</option><option value="DEF">Defender</option><option value="MID">Midfielder</option><option value="FWD">Forward</option></Select><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60"><Upload size={16} className="text-electric" /><span className="min-w-0 flex-1 truncate">{playerPhoto?.name ?? "Add or replace player picture"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setPlayerPhoto(event.target.files?.[0] ?? null)} /></label><Button className="gap-2 bg-electric text-ink">{editingPlayer ? <Pencil size={15} /> : <UserPlus size={15} />}{editingPlayer ? "Update player" : "Add player"}</Button></form>{editingPlayer && <button type="button" onClick={resetPlayer} className="text-xs text-white/45 hover:text-white">Cancel player edit</button>}<div className="grid gap-2">{roster.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">No players in this roster yet.</p> : roster.map((player) => <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink/40 p-3"><div className="flex items-center gap-3"><img src={assetUrl(player.photo_url, "player-photos") ?? "/players/default.png"} alt={`${player.name} picture`} className="h-11 w-11 rounded-xl bg-white/10 object-cover" /><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-black text-electric">#{player.jersey_number ?? "—"}</span><div><p className="font-bold text-white">{player.name}</p><p className="text-xs text-white/45">{player.position} · {player.is_active ? "Active" : "Inactive"} · {player.photo_url ? "Photo uploaded" : "No photo"}</p></div></div><div className="flex flex-wrap justify-end gap-2"><Button type="button" onClick={() => startPlayerEdit(player)} className="bg-white/10 text-white"><Pencil size={14} /> Edit</Button><Button type="button" onClick={() => void togglePlayer(player)} className="bg-white/10 text-white">{player.is_active ? "Deactivate" : "Activate"}</Button><Button type="button" onClick={() => void deletePlayer(player)} className="bg-red-500/15 text-red-200"><Trash2 size={14} /></Button></div></div>)}</div></>}
    {!teams.length && <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">Create a team in League Setup first.</p>}
  </div>;
}
