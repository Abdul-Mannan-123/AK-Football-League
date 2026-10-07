import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LiveMatchLogger from "@/components/live-match-logger";
import ManualFixtureEditor from "@/components/manual-fixture-editor";
import AdminControlCenter from "@/components/admin-control-center";
import AdminSignOut from "@/components/admin-sign-out";
import AssetManager from "@/components/asset-manager";
import NewsDesk from "@/components/news-desk";
import TeamWorkspace from "@/components/team-workspace";
import PlayerMatchStatsEditor from "@/components/player-match-stats-editor";

export const metadata = {
  title: "Admin Portal | AK Football League",
  description: "Manage fixtures and live match events for AK Football League.",
};

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  const { data: roleRows } = user
    ? await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("is_active", true)
    : { data: [] };
  const roles = new Set((roleRows ?? []).map((row) => row.role));
  if (user?.app_metadata?.role) roles.add(user.app_metadata.role);
  if (!user || !["admin", "competition_coordinator", "referee", "news_coordinator", "team_manager"].some((role) => roles.has(role))) {
    redirect("/admin/login?error=unauthorized");
  }
  const isAdmin = roles.has("admin");
  const canManageCompetition = isAdmin || roles.has("competition_coordinator");
  const canOperateMatches = canManageCompetition || roles.has("referee");
  const canManageNews = isAdmin || roles.has("news_coordinator");
  const canManageTeam = isAdmin || roles.has("team_manager");

  return (
    <main className="min-h-screen bg-ink">
      <header className="border-b border-white/10 bg-ink/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-electric">AKFL operations</p>
            <h1 className="mt-2 font-display text-3xl font-black text-white">{isAdmin ? "Admin Portal" : "Operations Portal"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-electric hover:text-electric">
              <ArrowLeft size={16} /> Back to site
            </Link>
            <AdminSignOut />
          </div>
        </div>
      </header>

      <div className="admin-theme mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#F59E0B]">Getting started</p>
          <h2 className="mt-2 font-display text-2xl font-black text-[#002D72]">Build your league workspace</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">If the forms are empty, that is expected. Add your season and teams first, then players, groups, fixtures, staff roles, news, and match events.</p>
          <div className="mt-5 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "Create season and teams", "League setup"],
              ["2", "Add the roster", "Team workspace"],
              ["3", "Schedule fixtures", "Fixture editor"],
              ["4", "Publish updates", "News desk"],
            ].map(([number, title, area]) => <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="font-display text-xl font-black text-[#0055A4]">{number}</span><p className="mt-2 font-bold text-[#002D72]">{title}</p><p className="mt-1 text-xs text-gray-500">{area}</p></div>)}
          </div>
        </section>
        {isAdmin && <section className="rounded-3xl border border-electric/20 bg-panel p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-electric">Administrator controls</p>
            <h2 className="mt-2 font-display text-2xl font-black text-white">League command center</h2>
            <p className="mt-2 text-sm text-white/50">Role assignments and irreversible competition actions are protected by database RPCs and RLS.</p>
          </div>
          <AdminControlCenter />
          <div className="mt-6"><AssetManager /></div>
        </section>}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Player accounts", "Manage player access and profiles"],
            ["Team managers", "Club contacts and permissions"],
            ["Lineups", "Prepare matchday starting elevens"],
            ["Auto schedule", "Generate fixtures by phase"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-panel p-5">
              <p className="text-xs font-black uppercase tracking-widest text-electric">Workspace</p>
              <h2 className="mt-4 font-display text-lg font-black text-white">{title}</h2>
              <p className="mt-2 text-sm leading-5 text-white/45">{description}</p>
              {title === "Lineups" ? <Link href="/admin/lineups" className="mt-5 inline-block rounded-full bg-electric px-3 py-1 text-[10px] font-black uppercase tracking-widest text-ink">Open editor</Link> : <span className="mt-5 inline-block rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/40">Available in command center</span>}
            </div>
          ))}
        </section>
        {canManageCompetition && <section className="rounded-3xl border border-white/10 bg-panel p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-electric text-ink"><CalendarDays size={21} /></div>
            <div>
              <h2 className="font-display text-2xl font-black text-white">Fixture editor</h2>
              <p className="mt-1 text-sm text-white/50">Create, update, and remove scheduled matches.</p>
            </div>
          </div>
          <ManualFixtureEditor />
        </section>}

        {canOperateMatches && <section className="rounded-3xl border border-white/10 bg-panel p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-400 text-ink"><Radio size={21} /></div>
            <div>
              <h2 className="font-display text-2xl font-black text-white">Live match logger</h2>
              <p className="mt-1 text-sm text-white/50">Use this during a live match to record goals and cards.</p>
            </div>
          </div>
          <LiveMatchLogger />
          <div className="mt-6"><PlayerMatchStatsEditor /></div>
        </section>}

        {canManageNews && <section className="rounded-3xl border border-white/10 bg-panel p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-electric">News desk</p>
          <h2 className="mt-2 font-display text-2xl font-black text-white">News management</h2>
          <p className="mt-2 text-sm text-white/50">Create, edit, publish, delete, and attach cover images to league stories.</p>
          <div className="mt-6"><NewsDesk /></div>
        </section>}

        {canManageTeam && <section className="rounded-3xl border border-white/10 bg-panel p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-electric">Team workspace</p>
          <h2 className="mt-2 font-display text-2xl font-black text-white">Roster & lineups</h2>
          <p className="mt-2 text-sm text-white/50">Maintain player profiles, activate or deactivate players, and manage team eligibility.</p>
          <div className="mt-6"><TeamWorkspace /></div>
        </section>}
      </div>
    </main>
  );
}
