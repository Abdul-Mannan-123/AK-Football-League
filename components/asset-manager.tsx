"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Target = { id: string; label: string; currentUrl: string | null };
type AssetType = "team" | "player" | "referee";
const config: Record<AssetType, { bucket: string; column: string }> = {
  team: { bucket: "team-logos", column: "logo_url" },
  player: { bucket: "player-photos", column: "photo_url" },
  referee: { bucket: "referee-photos", column: "photo_url" },
};

export default function AssetManager() {
  const [client] = useState(() => createClient());
  const [type, setType] = useState<AssetType>("team");
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const queries: Record<AssetType, PromiseLike<{ data: unknown; error: { message: string } | null }>> = {
        team: client.from("teams").select("id,name,logo_url").order("name"),
        player: client.from("players").select("id,name,photo_url").order("name"),
        referee: client.from("referees").select("id,name,photo_url").order("name"),
      };
      const result = await queries[type];
      if (result.error) return setMessage(result.error.message);
      const rows = (result.data ?? []) as Array<Record<string, string | null>>;
      const next = rows.map((row) => ({ id: row.id ?? "", label: row.name ?? row.title ?? "Untitled", currentUrl: row[config[type].column] }));
      setTargets(next);
      setTargetId(next[0]?.id ?? "");
    };
    void load();
  }, [client, type]);

  async function upload() {
    const selected = targets.find((target) => target.id === targetId);
    if (!file || !selected) return setMessage("Choose a record and an image first.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setMessage("Use a JPG, PNG, or WebP image.");
    if (file.size > 2 * 1024 * 1024) return setMessage("Images must be smaller than 2 MB.");
    setBusy(true);
    const { bucket, column } = config[type];
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${selected.id}/${Date.now()}.${extension}`;
    const uploadResult = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (uploadResult.error) {
      setBusy(false);
      return setMessage(uploadResult.error.message);
    }
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    const table = type === "team" ? "teams" : type === "player" ? "players" : "referees";
    const updateResult = await client.from(table).update({ [column]: data.publicUrl }).eq("id", selected.id);
    setBusy(false);
    setMessage(updateResult.error ? updateResult.error.message : "Image uploaded and saved.");
    if (!updateResult.error) {
      setTargets((current) => current.map((target) => target.id === selected.id ? { ...target, currentUrl: data.publicUrl } : target));
      setFile(null);
    }
  }

  return <div className="rounded-2xl border border-white/10 bg-ink/40 p-5"><div className="flex items-start gap-3"><ImagePlus className="mt-1 text-electric" size={20} /><div><h3 className="font-display text-lg font-black text-white">Asset manager</h3><p className="text-sm text-white/45">Upload team logos, player photos, and referee photos. News cover images are uploaded directly in News Desk.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]"><Select value={type} onChange={(event) => setType(event.target.value as AssetType)}><option value="team">Team logo</option><option value="player">Player photo</option><option value="referee">Referee photo</option></Select><Select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Select record</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</Select><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="min-w-0 rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-electric file:px-3 file:py-2 file:font-bold file:text-ink" /><Button type="button" onClick={() => void upload()} disabled={busy} className="gap-2 bg-electric text-ink"><Upload size={16} />{busy ? "Uploading..." : "Upload"}</Button></div>{message && <p role="status" className="mt-3 text-sm text-electric">{message}</p>}</div>;
}
