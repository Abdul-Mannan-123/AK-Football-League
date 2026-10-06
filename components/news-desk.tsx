"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Story = { id: string; title: string; content: string; cover_image_url: string | null; published_at: string };

export default function NewsDesk() {
  const [client] = useState(() => createClient());
  const [stories, setStories] = useState<Story[]>([]);
  const [editing, setEditing] = useState<Story | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    const { data, error } = await client.from("news").select("id,title,content,cover_image_url,published_at").order("published_at", { ascending: false });
    if (error) setNotice(error.message);
    else setStories((data ?? []) as Story[]);
  }
  useEffect(() => { void load(); }, [client]);

  function startEdit(story: Story) {
    setEditing(story); setTitle(story.title); setContent(story.content); setImageUrl(story.cover_image_url ?? "");
  }
  function reset() { setEditing(null); setTitle(""); setContent(""); setImageUrl(""); setImageFile(null); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return setNotice("Enter a headline and story.");
    if (imageFile && (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type) || imageFile.size > 2 * 1024 * 1024)) {
      return setNotice("Cover images must be JPG, PNG, or WebP files smaller than 2 MB.");
    }
    const payload = { title: title.trim(), content: content.trim(), cover_image_url: imageUrl.trim() || null };
    const result = editing
      ? await client.from("news").update(payload).eq("id", editing.id).select("id").single()
      : await client.from("news").insert(payload).select("id").single();
    if (result.error || !result.data) return setNotice(result.error?.message ?? "Could not save story.");
    if (imageFile) {
      const extension = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${result.data.id}/${Date.now()}.${extension}`;
      const uploadResult = await client.storage.from("news-images").upload(path, imageFile, { contentType: imageFile.type });
      if (uploadResult.error) return setNotice(uploadResult.error.message);
      const { data: publicUrl } = client.storage.from("news-images").getPublicUrl(path);
      const imageResult = await client.from("news").update({ cover_image_url: publicUrl.publicUrl }).eq("id", result.data.id);
      if (imageResult.error) return setNotice(imageResult.error.message);
    }
    setNotice(editing ? "Story updated." : "Story published."); reset(); await load();
  }
  async function remove(story: Story) {
    if (!window.confirm(`Delete “${story.title}”?`)) return;
    const { data: files } = await client.storage.from("news-images").list(story.id);
    if (files?.length) {
      await client.storage.from("news-images").remove(files.map((file) => `${story.id}/${file.name}`));
    }
    const { error } = await client.from("news").delete().eq("id", story.id);
    if (error) setNotice(error.message); else { setNotice("Story and its cover image were deleted."); await load(); }
  }
  return <div className="space-y-5">
    {notice && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink/60 p-3 text-sm text-white/70" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    <form onSubmit={save} className="grid gap-3 rounded-2xl border border-white/10 bg-ink/40 p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-widest text-white/40">{editing ? "Edit story" : "New story"}</p>{editing && <button type="button" onClick={reset} className="text-xs text-white/50 hover:text-white">Cancel</button>}</div>
      <Input placeholder="Headline" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea aria-label="Story content" className="min-h-32 rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-electric" placeholder="Story content" value={content} onChange={(event) => setContent(event.target.value)} />
      <div className="grid gap-2"><label htmlFor="news-cover" className="text-xs font-bold text-white/55">Cover image (JPG, PNG, or WebP; max 2 MB)</label><input id="news-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-electric file:px-3 file:py-2 file:font-bold file:text-ink" />{imageUrl && !imageFile && <p className="text-xs text-white/40">Existing cover image will be kept unless you choose a replacement.</p>}</div>
      <Button className="w-fit gap-2 bg-electric text-ink"><FileText size={16} />{editing ? "Update story" : "Publish story"}</Button>
    </form>
    <div className="grid gap-3">{stories.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">No stories published yet.</p> : stories.map((story) => <article key={story.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-ink/40 p-4 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{new Date(story.published_at).toLocaleDateString()}</p><h3 className="mt-1 font-display font-bold text-white">{story.title}</h3><p className="mt-1 line-clamp-2 text-sm text-white/45">{story.content}</p></div><div className="flex shrink-0 gap-2"><Button type="button" onClick={() => startEdit(story)} className="gap-2 bg-white/10 text-white"><Pencil size={14} />Edit</Button><Button type="button" onClick={() => void remove(story)} className="gap-2 bg-red-500/10 text-red-200"><Trash2 size={14} />Delete</Button></div></article>)}</div>
  </div>;
}
