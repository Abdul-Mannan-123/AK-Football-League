import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

export const revalidate = 30;

export default async function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("news").select("id,title,content,cover_image_url,published_at").eq("id", id).maybeSingle() : { data: null };
  if (!data) notFound();
  return <main className="public-theme min-h-screen bg-ink"><PublicHeader /><article className="mx-auto max-w-4xl px-5 py-12"><Link href="/" className="text-xs font-black uppercase tracking-[0.25em] text-electric"><ArrowLeft size={14} className="mr-2 inline" />AKFL home</Link><p className="mt-10 text-xs font-bold uppercase tracking-widest text-white/40">{new Date(data.published_at).toLocaleDateString()}</p><h1 className="mt-3 font-display text-4xl font-black leading-tight text-white sm:text-6xl">{data.title}</h1>{data.cover_image_url && <img src={data.cover_image_url} alt="" className="mt-8 max-h-[28rem] w-full rounded-3xl border border-white/10 object-cover" />}<div className="mt-8 rounded-3xl border border-white/10 bg-panel p-6 text-base leading-8 text-white/70 sm:p-10">{data.content}</div></article></main>;
}
