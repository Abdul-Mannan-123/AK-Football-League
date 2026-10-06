"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormField, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Option = { id: string; name: string };
type Fixture = {
  id: string;
  season_id: string;
  group_id: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_time: string;
  pitch_location: string | null;
  status: "scheduled" | "live" | "completed";
};
type FormState = {
  seasonId: string;
  groupId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffTime: string;
  pitchLocation: string;
};
type Toast = { type: "success" | "error"; message: string } | null;

const emptyForm: FormState = {
  seasonId: "",
  groupId: "",
  homeTeamId: "",
  awayTeamId: "",
  kickoffTime: "",
  pitchLocation: "",
};

export default function ManualFixtureEditor() {
  const [seasons, setSeasons] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Supabase is not configured." });
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [seasonResult, groupResult, teamResult, fixtureResult] = await Promise.all([
      supabase.from("seasons").select("id, name").order("name", { ascending: false }),
      supabase.from("groups").select("id, name").order("name"),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("matches").select("id, season_id, group_id, home_team_id, away_team_id, kickoff_time, pitch_location, status").eq("status", "scheduled").order("kickoff_time"),
    ]);

    const firstError = seasonResult.error ?? groupResult.error ?? teamResult.error ?? fixtureResult.error;
    if (firstError) {
      setToast({ type: "error", message: firstError.message });
    } else {
      setSeasons((seasonResult.data ?? []) as Option[]);
      setGroups((groupResult.data ?? []) as Option[]);
      setTeams((teamResult.data ?? []) as Option[]);
      setFixtures((fixtureResult.data ?? []) as Fixture[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(null), 4500);
      return () => window.clearTimeout(timeout);
    }
  }, [toast]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "homeTeamId" || field === "awayTeamId" || field === "kickoffTime") {
      setConflict(false);
    }
  };

  const submitFixture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    if (!form.seasonId || !form.homeTeamId || !form.awayTeamId || !form.kickoffTime || !form.pitchLocation.trim()) {
      setToast({ type: "error", message: "Complete all required fixture fields." });
      return;
    }
    if (form.homeTeamId === form.awayTeamId) {
      setConflict(true);
      setToast({ type: "error", message: "Home and away teams must be different." });
      return;
    }

    setSaving(true);
    const kickoff = new Date(form.kickoffTime);
    if (Number.isNaN(kickoff.getTime())) {
      setSaving(false);
      setToast({ type: "error", message: "The date and kickoff time is invalid. Choose the date and time again." });
      return;
    }
    const dayStart = new Date(kickoff);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const { data: sameDayMatches, error: conflictError } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, kickoff_time")
      .in("status", ["scheduled", "live", "halftime"])
      .lt("kickoff_time", dayEnd.toISOString())
      .gte("kickoff_time", dayStart.toISOString())
      .neq("id", editingId ?? "00000000-0000-0000-0000-000000000000");
    if (conflictError) {
      setSaving(false);
      setToast({ type: "error", message: `Could not check fixture conflicts: ${conflictError.message}` });
      return;
    }
    if (sameDayMatches?.some((match) => [match.home_team_id, match.away_team_id].some((teamId) => teamId === form.homeTeamId || teamId === form.awayTeamId))) {
      setConflict(true);
      setSaving(false);
      setToast({ type: "error", message: "A selected team is already scheduled on this date." });
      return;
    }
    const payload = {
      season_id: form.seasonId,
      group_id: form.groupId || null,
      home_team_id: form.homeTeamId,
      away_team_id: form.awayTeamId,
      kickoff_time: kickoff.toISOString(),
      pitch_location: form.pitchLocation.trim(),
    };
    const result = editingId
      ? await supabase.from("matches").update(payload).eq("id", editingId).select("id").maybeSingle()
      : await supabase.from("matches").insert({ ...payload, status: "scheduled" as const, home_score: 0, away_score: 0 }).select("id").single();

    if (result.error || !result.data) {
      setToast({ type: "error", message: result.error?.message ?? "Could not save fixture. You may not have permission to edit this match." });
    } else {
      setToast({ type: "success", message: editingId ? "Fixture updated." : "Fixture scheduled." });
      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    }
    setSaving(false);
  };

  const startEditing = (fixture: Fixture) => {
    const date = new Date(fixture.kickoff_time);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingId(fixture.id);
    setForm({
      seasonId: fixture.season_id,
      groupId: fixture.group_id ?? "",
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      kickoffTime: localDate,
      pitchLocation: fixture.pitch_location ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteFixture = async (id: string) => {
    if (!supabase || !window.confirm("Delete this scheduled fixture?")) return;
    const { error } = await supabase.from("matches").delete().eq("id", id).eq("status", "scheduled");
    if (error) {
      setToast({ type: "error", message: error.message });
    } else {
      setToast({ type: "success", message: "Fixture deleted." });
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await loadData();
    }
  };

  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? "Unknown team";
  const seasonName = (id: string) => seasons.find((season) => season.id === id)?.name ?? "Unknown season";
  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "League Phase";
  const awayTeams = teams.filter((team) => team.id !== form.homeTeamId);
  const homeTeams = teams.filter((team) => team.id !== form.awayTeamId);

  return (
    <section className="mx-auto max-w-6xl space-y-8 p-5 text-white lg:p-8">
      {toast && (
        <div className={`fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "success" ? "border-electric/40 bg-[#1a2513] text-electric" : "border-red-400/40 bg-[#291417] text-red-200"}`}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-electric">Coordinator tools</p>
        <h1 className="font-display text-3xl font-black">Manual fixture editor</h1>
        <p className="mt-2 text-sm text-white/50">Create and maintain scheduled matches without automation.</p>
      </div>

      <form onSubmit={submitFixture} className="rounded-3xl border border-white/10 bg-panel p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
          <h2 className="font-display text-xl font-bold">{editingId ? "Edit scheduled fixture" : "Create a fixture"}</h2>
          {editingId && <Button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="gap-2 bg-white/10 text-white hover:bg-white/15"><XCircle size={16} /> Cancel</Button>}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField><FormLabel htmlFor="season">Season *</FormLabel><Select id="season" value={form.seasonId} onChange={(event) => updateField("seasonId", event.target.value)} required><option value="">Select season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select></FormField>
          <FormField><FormLabel htmlFor="group">Group / phase</FormLabel><Select id="group" value={form.groupId} onChange={(event) => updateField("groupId", event.target.value)}><option value="">League Phase</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></FormField>
          <FormField><FormLabel htmlFor="home-team">Home team *</FormLabel><Select id="home-team" value={form.homeTeamId} onChange={(event) => updateField("homeTeamId", event.target.value)} required><option value="">Select home team</option>{homeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FormField>
          <FormField><FormLabel htmlFor="away-team">Away team *</FormLabel><Select id="away-team" value={form.awayTeamId} onChange={(event) => updateField("awayTeamId", event.target.value)} required><option value="">Select away team</option>{awayTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></FormField>
          <FormField><FormLabel htmlFor="kickoff-time">Date & kickoff time *</FormLabel><Input id="kickoff-time" type="datetime-local" step="60" value={form.kickoffTime} onChange={(event) => updateField("kickoffTime", event.target.value)} required /></FormField>
          <FormField><FormLabel htmlFor="pitch-location">Pitch / venue *</FormLabel><Input id="pitch-location" placeholder="Main Stadium" value={form.pitchLocation} onChange={(event) => updateField("pitchLocation", event.target.value)} required /></FormField>
        </div>
        <Button type="submit" disabled={saving || loading || !form.homeTeamId || !form.awayTeamId || form.homeTeamId === form.awayTeamId || conflict} className="mt-6 gap-2 bg-electric text-ink hover:bg-[#e4ff70]">{editingId ? <Pencil size={17} /> : <Plus size={17} />}{saving ? "Saving..." : editingId ? "Update fixture" : "Schedule fixture"}</Button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-panel p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3"><CalendarDays className="text-electric" size={20} /><div><h2 className="font-display text-xl font-bold">Scheduled fixtures</h2><p className="text-sm text-white/40">{fixtures.length} upcoming fixture{fixtures.length === 1 ? "" : "s"}</p></div></div>
        {loading ? <p className="py-8 text-sm text-white/45">Loading fixtures...</p> : fixtures.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">No scheduled fixtures yet.</p> : <div className="space-y-3">{fixtures.map((fixture) => <div key={fixture.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-electric">{seasonName(fixture.season_id)} · {groupName(fixture.group_id)}</p><p className="mt-2 font-display font-bold text-white">{teamName(fixture.home_team_id)} <span className="px-2 text-white/25">vs</span> {teamName(fixture.away_team_id)}</p><p className="mt-1 text-xs text-white/45">{new Date(fixture.kickoff_time).toLocaleString()} · {fixture.pitch_location}</p></div><div className="flex shrink-0 gap-2"><Button type="button" onClick={() => startEditing(fixture)} className="gap-2 bg-white/10 text-white hover:bg-white/15"><Pencil size={15} /> Edit</Button><Button type="button" onClick={() => void deleteFixture(fixture.id)} className="gap-2 bg-red-500/10 text-red-200 hover:bg-red-500/20"><Trash2 size={15} /> Delete</Button></div></div>)}</div>}
      </div>
    </section>
  );
}
