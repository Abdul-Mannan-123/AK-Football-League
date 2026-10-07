import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/public-header";

export const revalidate = 30;

export default async function NewsPage() {
  const supabase = await createClient();
  const { data: news } = supabase
    ? await supabase.from("news").select("id,title,content,cover_image_url,published_at").order("published_at", { ascending: false })
    : { data: [] };

  return (
    <main className="public-theme min-h-screen bg-ink">
      <PublicHeader />
      <header className="border-b border-white/10 px-5 py-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-electric">From around AKFL</p>
          <h1 className="page-heading mt-3 font-display text-4xl font-black">Latest league news</h1>
          <p className="mt-2 text-white/60">Match reports, announcements, and stories from across the league.</p>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {news?.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {news.map((item, index) => (
              <Link href={`/news/${item.id}`} key={item.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-panel">
                <div className={`relative h-48 bg-gradient-to-br ${index % 3 === 0 ? "from-sky/60 to-panel" : index % 3 === 1 ? "from-electric/35 to-panel" : "from-purple-500/40 to-panel"}`}>
                  {item.cover_image_url ? <img src={item.cover_image_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <Flag className="absolute left-5 top-5 text-white" />}
                </div>
                <div className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{new Date(item.published_at).toLocaleDateString()}</p>
                  <h2 className="mt-3 font-display text-xl font-black leading-tight text-white group-hover:text-electric">{item.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/55">{item.content}</p>
                  <p className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-electric">Read story <ArrowRight size={14} /></p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/55">No league stories have been published yet.</p>
        )}
      </section>
    </main>
  );
}
