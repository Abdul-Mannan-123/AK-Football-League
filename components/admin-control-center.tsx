"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, Check, FileText, ShieldCheck, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Option = { id: string; name: string };
type Notice = { type: "success" | "error"; text: string } | null;

export default function AdminControlCenter() {
  const [client] = useState(() => createClient());
  const [seasons, setSeasons] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("active");
  const [userId, setUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState("competition_coordinator");
  const [teamScope, setTeamScope] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [groupId, setGroupId] = useState("");
  const [newsId, setNewsId] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newSeason, setNewSeason] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [newTeamLogo, setNewTeamLogo] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("MID");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    void Promise.all([
      client.from("seasons").select("id,name").order("name", { ascending: false }),
      client.from("teams").select("id,name").order("name"),
    ]).then(([seasonResult, teamResult]) => {
      if (seasonResult.error || teamResult.error) {
        setNotice({ type: "error", text: seasonResult.error?.message ?? teamResult.error?.message ?? "Could not load control data." });
        return;
      }
      setSeasons((seasonResult.data ?? []) as Option[]);
      setTeams((teamResult.data ?? []) as Option[]);
    });
  }, [client]);

  async function callRpc<T>(name: string, args: Record<string, unknown>, success: string) {
    const { error } = await client.rpc(name, args);
    setNotice(error ? { type: "error", text: error.message } : { type: "success", text: success });
  }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    if (!userId.trim()) return setNotice({ type: "error", text: "Enter the Supabase Auth user UUID." });
    await callRpc("set_user_role", {
      target_user_id: userId.trim(),
      target_role: role,
      target_team_id: role === "team_manager" ? teamScope || null : null,
      enabled,
    }, enabled ? "Role granted." : "Role revoked.");
  }

  async function inviteUser(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim()) return setNotice({ type: "error", text: "Enter an email address to invite." });
    const response = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) });
    const result = await response.json() as { userId?: string; error?: string };
    if (!response.ok || !result.userId) return setNotice({ type: "error", text: result.error ?? "Could not invite user." });
    setUserId(result.userId);
    setInviteEmail("");
    setNotice({ type: "success", text: "Invitation sent. Review the selected role, then save it for this new account." });
  }

  async function changeSeason(event: FormEvent) {
    event.preventDefault();
    if (!seasonId) return setNotice({ type: "error", text: "Select a season first." });
    await callRpc("set_season_status", { target_season_id: seasonId, next_status: status }, `Season marked ${status}.`);
  }

  async function disqualifyTeam(event: FormEvent) {
    event.preventDefault();
    if (!teamId) return setNotice({ type: "error", text: "Select a team first." });
    const reason = window.prompt("Reason for disqualification (optional):") ?? "";
    await callRpc("set_team_disqualification", { target_team_id: teamId, disqualified: true, reason }, "Team disqualified.");
  }

  async function generateSchedule(event: FormEvent) {
    event.preventDefault();
    if (!seasonId || !scheduleDate) return setNotice({ type: "error", text: "Select a season and kickoff date." });
    await callRpc("generate_round_robin_schedule", {
      target_season_id: seasonId,
      target_group_id: groupId || null,
      first_kickoff: new Date(scheduleDate).toISOString(),
      days_between_rounds: 7,
    }, "Schedule generated for eligible team pairs.");
  }

  async function saveNews(event: FormEvent) {
    event.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) return setNotice({ type: "error", text: "Enter a news title and story." });
    const result = newsId
      ? await client.from("news").update({ title: newsTitle.trim(), content: newsContent.trim() }).eq("id", newsId)
      : await client.from("news").insert({ title: newsTitle.trim(), content: newsContent.trim() });
    setNotice(result.error ? { type: "error", text: result.error.message } : { type: "success", text: newsId ? "News updated." : "News published." });
    if (!result.error) { setNewsId(""); setNewsTitle(""); setNewsContent(""); }
  }

  async function createSeason(event: FormEvent) {
    event.preventDefault();
    if (!newSeason.trim()) return setNotice({ type: "error", text: "Enter a season name, for example 2026/2027." });
    const { error } = await client.from("seasons").insert({ name: newSeason.trim(), status: "draft" });
    setNotice(error ? { type: "error", text: error.message } : { type: "success", text: "Season created." });
    if (!error) { setNewSeason(""); await reloadOptions(); }
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!newTeam.trim() || !newTeamCode.trim()) return setNotice({ type: "error", text: "Enter a team name and short code." });
    const { error } = await client.from("teams").insert({ name: newTeam.trim(), short_code: newTeamCode.trim().toUpperCase(), logo_url: newTeamLogo.trim() || null });
    setNotice(error ? { type: "error", text: error.message } : { type: "success", text: "Team created." });
    if (!error) { setNewTeam(""); setNewTeamCode(""); setNewTeamLogo(""); await reloadOptions(); }
  }

  async function createPlayer(event: FormEvent) {
    event.preventDefault();
    if (!playerTeam || !playerName.trim()) return setNotice({ type: "error", text: "Select a team and enter a player name." });
    const parsedNumber = playerNumber.trim() ? Number(playerNumber) : null;
    if (parsedNumber !== null && (!Number.isInteger(parsedNumber) || parsedNumber < 0 || parsedNumber > 99)) {
      return setNotice({ type: "error", text: "Jersey number must be between 0 and 99." });
    }
    const { error } = await client.from("players").insert({ team_id: playerTeam, name: playerName.trim(), jersey_number: parsedNumber, position: playerPosition, is_active: true });
    setNotice(error ? { type: "error", text: error.message } : { type: "success", text: "Player created." });
    if (!error) { setPlayerName(""); setPlayerNumber(""); }
  }

  async function reloadOptions() {
    const [seasonResult, teamResult] = await Promise.all([
      client.from("seasons").select("id,name").order("name", { ascending: false }),
      client.from("teams").select("id,name").order("name"),
    ]);
    if (!seasonResult.error) setSeasons((seasonResult.data ?? []) as Option[]);
    if (!teamResult.error) setTeams((teamResult.data ?? []) as Option[]);
  }

  return <section className="space-y-6">
    {notice && <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${notice.type === "success" ? "border-electric/30 bg-electric/10 text-electric" : "border-red-400/30 bg-red-400/10 text-red-100"}`}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <ControlCard icon={<CalendarClock />} title="League setup" description="Create the records needed before scheduling fixtures and lineups.">
        <div className="space-y-5">
          <form onSubmit={createSeason} className="grid gap-2"><p className="text-xs font-black uppercase tracking-widest text-white/40">New season</p><div className="flex gap-2"><Input placeholder="2026/2027" value={newSeason} onChange={(e) => setNewSeason(e.target.value)} /><Button className="shrink-0 bg-electric text-ink">Create</Button></div></form>
          <form onSubmit={createTeam} className="grid gap-2"><p className="text-xs font-black uppercase tracking-widest text-white/40">New team</p><Input placeholder="Team name" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} /><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Short code, e.g. AKU" maxLength={6} value={newTeamCode} onChange={(e) => setNewTeamCode(e.target.value)} /><Input placeholder="Logo URL (optional)" value={newTeamLogo} onChange={(e) => setNewTeamLogo(e.target.value)} /></div><Button className="bg-electric text-ink">Add team</Button></form>
          <form onSubmit={createPlayer} className="grid gap-2"><p className="text-xs font-black uppercase tracking-widest text-white/40">New player</p><Select value={playerTeam} onChange={(e) => setPlayerTeam(e.target.value)}><option value="">Select team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Input placeholder="Player name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} /><div className="grid gap-2 sm:grid-cols-2"><Input type="number" min="0" max="99" placeholder="Jersey number" value={playerNumber} onChange={(e) => setPlayerNumber(e.target.value)} /><Select value={playerPosition} onChange={(e) => setPlayerPosition(e.target.value)}><option value="GK">Goalkeeper</option><option value="DEF">Defender</option><option value="MID">Midfielder</option><option value="FWD">Forward</option></Select></div><Button className="bg-electric text-ink">Add player</Button></form>
        </div>
      </ControlCard>
      <ControlCard icon={<ShieldCheck />} title="User roles & invitations" description="Invite accounts through the server, then grant or revoke their role.">
        <form onSubmit={inviteUser} className="mb-4 flex gap-2"><Input type="email" placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /><Button className="bg-white/10 text-white">Invite</Button></form>
        <form onSubmit={saveRole} className="grid gap-3"><Input placeholder="Auth user UUID" value={userId} onChange={(e) => setUserId(e.target.value)} /><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">Admin</option><option value="competition_coordinator">Competition coordinator</option><option value="referee">Referee</option><option value="news_coordinator">News coordinator</option><option value="team_manager">Team manager</option><option value="player">Player</option></Select>{role === "team_manager" && <Select value={teamScope} onChange={(e) => setTeamScope(e.target.value)}><option value="">Select team scope</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>}<label className="flex items-center gap-2 text-sm text-white/60"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Active role</label><Button className="bg-electric text-ink"><Users size={16} /> Save role</Button></form>
      </ControlCard>
      <ControlCard icon={<CalendarClock />} title="Season lifecycle" description="Only competition staff can activate or close a season."><form onSubmit={changeSeason} className="grid gap-3"><Select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}><option value="">Select season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">Draft</option><option value="active">Active / start season</option><option value="completed">Completed / end season</option><option value="cancelled">Cancelled</option></Select><Button className="bg-electric text-ink"><Check size={16} /> Update season</Button></form></ControlCard>
      <ControlCard icon={<Users />} title="Team discipline" description="Disqualify a team without deleting historical matches."><form onSubmit={disqualifyTeam} className="grid gap-3"><Select value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Select team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Button className="bg-red-500/80 text-white">Disqualify team</Button></form></ControlCard>
      <ControlCard icon={<CalendarClock />} title="Automatic schedule" description="Create missing round-robin pairings for a season/group."><form onSubmit={generateSchedule} className="grid gap-3"><Select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}><option value="">Select season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select><Input type="text" placeholder="Group UUID (optional)" value={groupId} onChange={(e) => setGroupId(e.target.value)} /><Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} /><Button className="bg-electric text-ink"><CalendarClock size={16} /> Generate schedule</Button></form></ControlCard>
      <ControlCard icon={<FileText />} title="News desk" description="Create or update stories. RLS still enforces the news coordinator role."><form onSubmit={saveNews} className="grid gap-3"><Input placeholder="Existing news UUID (leave blank to create)" value={newsId} onChange={(e) => setNewsId(e.target.value)} /><Input placeholder="Headline" value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} /><textarea className="min-h-28 rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-electric" placeholder="Story content" value={newsContent} onChange={(e) => setNewsContent(e.target.value)} /><Button className="bg-electric text-ink"><FileText size={16} /> {newsId ? "Update news" : "Publish news"}</Button></form></ControlCard>
    </div>
  </section>;
}

function ControlCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-white/10 bg-ink/40 p-5"><div className="mb-5 flex items-start gap-3"><div className="text-electric">{icon}</div><div><h3 className="font-display text-lg font-black text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-white/45">{description}</p></div></div>{children}</article>;
}
