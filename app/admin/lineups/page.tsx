import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LineupEditor from "@/components/lineup-editor";

export const metadata = { title: "Lineups | AK Football League" };

export default async function LineupsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  const { data: roleRows } = user ? await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("is_active", true) : { data: [] };
  const roles = new Set((roleRows ?? []).map((row) => row.role));
  if (user?.app_metadata?.role) roles.add(user.app_metadata.role);
  if (!user || !["admin", "competition_coordinator", "team_manager"].some((role) => roles.has(role))) redirect("/admin/login?error=unauthorized");
  return <main className="min-h-screen bg-ink"><header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">AKFL operations</p><h1 className="mt-2 font-display text-3xl font-black text-white">Lineup editor</h1></div><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-electric"><ArrowLeft size={16} /> Admin portal</Link></div></header><div className="mx-auto max-w-6xl px-5 py-8"><LineupEditor /></div></main>;
}
