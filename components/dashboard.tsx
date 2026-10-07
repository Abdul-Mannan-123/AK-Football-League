"use client";

import Link from "next/link";
import { useState } from "react";
import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Flag,
  Goal,
  HandHelping,
  Menu,
  Shield,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { FeaturedMatch, HomepagePlayer, Leader, NewsItem, Standing } from "@/lib/types";
import { TeamBadge } from "@/components/team-badge";

type DashboardProps = {
  standings: Standing[];
  scorers: Leader[];
  assists: Leader[];
  news: NewsItem[];
  featuredMatch: FeaturedMatch | null;
  matches: FeaturedMatch[];
  players: HomepagePlayer[];
};

const navItems = [
  { label: "Matches", href: "#match-center" },
  { label: "Tables", href: "#tables" },
  { label: "Stats", href: "#stats" },
  { label: "Players", href: "/players" },
  { label: "Officials", href: "/referees" },
  { label: "Admin", href: "/admin" },
];

const demoMatches = [
  { home: "AK United", homeCode: "AKU", homeLogo: "/teams/team_logo_1.jpeg", away: "Northside FC", awayCode: "NSF", awayLogo: "/teams/team_logo_2.jpeg", score: "2 - 1", status: "LIVE", time: "72'", venue: "National Stadium", events: ["18' Ahmadi", "41' Rahimi YC", "64' Sadiq"] },
  { home: "Kabul Stars", homeCode: "KBS", homeLogo: "/teams/team_logo_3.jpeg", away: "Pamir Athletic", awayCode: "PMA", awayLogo: "/teams/team_logo_4.jpeg", score: "—", status: "19:30", time: "Today", venue: "Central Arena", events: [] },
  { home: "Capital City", homeCode: "CAP", homeLogo: "/teams/team_logo_5.jpeg", away: "Herat Lions", awayCode: "HRL", awayLogo: "/teams/team_logo_6.jpeg", score: "3 - 0", status: "FT", time: "Full time", venue: "Ground 1", events: ["12' Omar", "55' Wali", "81' Omar"] },
];

const demoPlayers = [
  { id: "p1", name: "Omid Ahmadi", team: "AK United", code: "AKU", number: 9, position: "FWD", photo: "/players/default.png", goals: 9, assists: 3 },
  { id: "p2", name: "Farid Sadiq", team: "Northside FC", code: "NSF", number: 10, position: "MID", photo: "/players/default.png", goals: 6, assists: 7 },
  { id: "p3", name: "Zubair Rahimi", team: "Kabul Stars", code: "KBS", number: 7, position: "FWD", photo: "/players/default.png", goals: 7, assists: 4 },
];

export function Dashboard({ standings, scorers, assists, news, featuredMatch, matches, players }: DashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const groupOptions = useMemo(() => {
    const uniqueGroups = new Map<string, string>();
    (standings.length ? standings : [{ group_id: "group-a", group_name: "Group A" }]).forEach((row) => {
      const key = row.group_id ?? "league-phase";
      uniqueGroups.set(key, row.group_name ?? "League Phase");
    });
    return Array.from(uniqueGroups, ([id, name]) => ({ id, name }));
  }, [standings]);
  const [group, setGroup] = useState("");
  const selectedGroup = group || groupOptions[0]?.id || "league-phase";
  const displayStandings = standings.length ? standings : [
    { team_id: "1", team_name: "AK United", short_code: "AKU", logo_url: "/teams/team_logo_1.jpeg", p: 7, w: 6, d: 1, l: 0, gd: 14, pts: 19 },
    { team_id: "2", team_name: "Northside FC", short_code: "NSF", logo_url: "/teams/team_logo_2.jpeg", p: 7, w: 5, d: 1, l: 1, gd: 9, pts: 16 },
    { team_id: "3", team_name: "Kabul Stars", short_code: "KBS", logo_url: "/teams/team_logo_3.jpeg", p: 7, w: 4, d: 1, l: 2, gd: 5, pts: 13 },
    { team_id: "4", team_name: "Pamir Athletic", short_code: "PMA", logo_url: "/teams/team_logo_4.jpeg", p: 7, w: 3, d: 1, l: 3, gd: 1, pts: 10 },
  ] as Standing[];
  const visibleStandings = displayStandings.filter((row) => (row.group_id ?? "league-phase") === selectedGroup);
  const scorer = scorers[0] ?? { player_id: "p1", player_name: "Omid Ahmadi", team_name: "AK United", short_code: "AKU", photo_url: null, total_goals: 9 };
  const assistant = assists[0] ?? { player_id: "p2", player_name: "Farid Sadiq", team_name: "Northside FC", short_code: "NSF", photo_url: null, total_assists: 7 };
  const homepageMatches = matches.length ? matches : demoMatches.map((match, index) => ({
    id: `demo-${index}`,
    status: index === 0 ? "live" : index === 2 ? "completed" : "scheduled",
    kickoff_time: new Date().toISOString(),
    pitch_location: match.venue,
    home_score: index === 0 ? 2 : index === 2 ? 3 : 0,
    away_score: index === 0 ? 1 : 0,
    home: { name: match.home, short_code: match.homeCode, logo_url: match.homeLogo },
    away: { name: match.away, short_code: match.awayCode, logo_url: match.awayLogo },
    events: [],
  } satisfies FeaturedMatch));
  const homepagePlayers = players.length ? players : demoPlayers.map((player) => ({ id: player.id, name: player.name, photo_url: player.photo, jersey_number: player.number, position: player.position, team_name: player.team, short_code: player.code, goals: player.goals, assists: player.assists }));
  const matchLabel = featuredMatch?.status === "live" ? "LIVE NOW" : featuredMatch?.status === "halftime" ? "HALF TIME" : featuredMatch?.status === "completed" ? "LAST FINISH" : "NEXT FIXTURE";
  const matchTime = featuredMatch?.status === "live" || featuredMatch?.status === "halftime" ? "LIVE" : featuredMatch ? new Date(featuredMatch.kickoff_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No fixture selected";

  return (
    <main className="public-theme min-h-screen bg-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-electric text-white shadow-glow"><Trophy size={21} /></div>
            <div><p className="text-sm font-black uppercase tracking-[0.22em] text-white">AKFL</p><p className="text-[10px] uppercase tracking-[0.28em] text-white/45">AK Football League</p></div>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">{navItems.map((item) => <Link key={item.label} href={item.href} className="text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:text-electric">{item.label}</Link>)}</nav>
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-xl border border-white/10 p-2 text-white lg:hidden" aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {menuOpen && <nav className="grid gap-4 border-t border-white/10 px-5 py-5 lg:hidden">{navItems.map((item) => <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className="text-sm font-black uppercase tracking-widest text-white/70">{item.label}</Link>)}</nav>}
      </header>

      <div className="border-b border-white/10 bg-[#101722]">
        <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-5 py-3 lg:px-8">
          <span className="flex shrink-0 items-center gap-2 text-xs font-black uppercase tracking-widest text-electric"><span className="h-2 w-2 animate-pulse rounded-full bg-electric" /> Match ticker</span>
          {homepageMatches.slice(0, 4).map((match) => <Link href="#match-center" key={match.id} className="flex shrink-0 items-center gap-2 text-xs font-bold text-white/65 hover:text-white"><TeamBadge src={match.home.logo_url ?? "/teams/team_logo_1.jpeg"} alt={match.home.short_code} className="h-5 w-5" />{match.home.short_code}<b className="text-white">{match.status === "scheduled" ? "—" : `${match.home_score} - ${match.away_score}`}</b>{match.away.short_code}<TeamBadge src={match.away.logo_url ?? "/teams/team_logo_2.jpeg"} alt={match.away.short_code} className="h-5 w-5" /><span className={`rounded-full px-2 py-1 text-[10px] font-black ${match.status === "live" || match.status === "halftime" ? "bg-cyan text-ink" : match.status === "completed" ? "bg-white/10 text-white/50" : "bg-cyan/15 text-cyan"}`}>{match.status === "completed" ? "FT" : match.status === "live" ? "LIVE" : match.status === "halftime" ? "HT" : "UPCOMING"}</span></Link>)}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pt-20">
        <div className="mb-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div><p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.3em] text-electric"><Zap size={14} fill="currentColor" /> 2026/27 season</p><h1 className="page-heading max-w-3xl font-display text-5xl font-black leading-[0.95] tracking-tight text-white">Your Pitch.<br /><span className="text-electric">Your Stage. Your Legacy.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-white/55">Live football, real tables, player stories and every fixture from AK Football League.</p></div>
          <Link href="/matches" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-electric px-5 py-3 text-sm font-black text-ink transition hover:bg-white">Open match center <ArrowRight size={17} /></Link>
        </div>

        <article id="match-center" className="relative overflow-hidden rounded-3xl border border-white/10 bg-panel p-6 shadow-glow sm:p-9">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-electric/10 blur-3xl" />
          <div className="relative flex items-center justify-between"><div><span className="inline-flex items-center gap-2 rounded-full bg-electric px-3 py-1 text-[10px] font-black uppercase tracking-widest text-ink"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" /> {matchLabel}</span><p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-white/40">{featuredMatch?.pitch_location ?? "Venue TBC"} · {matchTime}</p></div><Activity className="text-electric" /></div>
          {featuredMatch ? <><div className="relative mt-10 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]"><TeamHero name={featuredMatch.home.name} code={featuredMatch.home.short_code} logo={featuredMatch.home.logo_url ?? "/teams/team_logo_1.jpeg"} side="HOME" /><div className="text-center"><p className="font-display text-5xl font-black text-white sm:text-7xl">{featuredMatch.status === "scheduled" ? "—" : `${featuredMatch.home_score} - ${featuredMatch.away_score}`}</p><span className="mt-2 inline-flex items-center gap-1 text-sm font-black text-electric"><Clock3 size={14} /> {matchTime}</span></div><TeamHero name={featuredMatch.away.name} code={featuredMatch.away.short_code} logo={featuredMatch.away.logo_url ?? "/teams/team_logo_2.jpeg"} side="AWAY" /></div><div className="relative mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs font-bold text-white/55">{featuredMatch.events.map((event) => <span key={event.id} className="flex items-center gap-2"><Goal size={14} className="text-electric" />{event.minute}' {event.player_name} <span className="text-white/35">({event.event_type.replace("_", " ")})</span></span>)}</div></> : <p className="relative py-16 text-center text-white/55">No live, completed, or scheduled matches are available.</p>}
        </article>
      </section>

      <section id="tables" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><SectionHeading eyebrow="The competition" title="Tables & groups" action="View all" href="/leagues" /><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="flex flex-wrap gap-2 border-b border-slate-200 bg-[#002D72] p-3" role="tablist" aria-label="League groups">{groupOptions.map((tab) => <button type="button" role="tab" aria-selected={selectedGroup === tab.id} key={tab.id} onClick={() => setGroup(tab.id)} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${selectedGroup === tab.id ? "bg-[#F59E0B] text-[#002D72]" : "text-white/70 hover:text-white"}`}>{tab.name}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[650px] bg-white text-left text-sm text-[#1a1a1a]"><thead className="bg-[#002D72] text-[10px] font-black uppercase tracking-[0.2em] text-white"><tr><th className="w-20 px-5 py-4">Pos</th><th className="py-4">Club</th>{["P", "W", "D", "L", "GD", "PTS"].map((head) => <th key={head} className="px-3 py-4 text-center">{head}</th>)}</tr></thead><tbody>{visibleStandings.slice(0, 6).map((row, index) => <tr key={row.team_id} className={`border-t border-slate-200 ${index % 2 ? "bg-slate-50" : "bg-white"}`}><td className="px-5 py-4"><span className={`mr-3 inline-block h-6 w-1 rounded-full ${index < 4 ? "bg-[#F59E0B]" : "bg-slate-300"}`} />{index + 1}</td><td className="py-4"><div className="flex items-center gap-3"><TeamBadge src={row.logo_url} alt={row.short_code} className="h-8 w-8" /><span className="font-bold">{row.team_name}</span></div></td>{[row.p, row.w, row.d, row.l, row.gd, row.pts].map((value, valueIndex) => <td key={valueIndex} className={`px-3 py-4 text-center ${valueIndex === 5 ? "font-black text-[#002D72]" : "text-gray-500"}`}>{value > 0 && valueIndex === 4 ? `+${value}` : value}</td>)}</tr>)}</tbody></table>{visibleStandings.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No standings are available for this group yet.</p>}</div></div></section>

      <section id="stats" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><SectionHeading eyebrow="Numbers that matter" title="Leaders & player cards" action="All stats" href="#players" /><div className="grid gap-5 md:grid-cols-2"><LeaderCard title="Top scorer" leader={scorer} stat={scorer.total_goals ?? 0} unit="goals" accent="electric" /><LeaderCard title="Assist leader" leader={assistant} stat={assistant.total_assists ?? 0} unit="assists" accent="sky" /></div></section>

      <section id="players" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><SectionHeading eyebrow="Player profiles" title="Meet the players" action="View directory" href="/players" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{homepagePlayers.map((player) => <Link href={`/players/${player.id}`} key={player.id} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-panel p-4 transition hover:-translate-y-1 hover:border-electric/40"><div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white/10"><img src={player.photo_url || "/players/default.png"} alt={`${player.name} profile`} className="h-full w-full object-cover" /></div><div><p className="text-xs font-black text-electric">#{player.jersey_number ?? "—"} · {player.position}</p><h3 className="mt-1 font-display text-lg font-black text-white group-hover:text-electric">{player.name}</h3><p className="text-sm text-white/45">{player.team_name} · {player.goals} goals · {player.assists} assists</p></div></Link>)}</div></section>

      <section id="calendar" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><SectionHeading eyebrow="Calendar" title="Fixtures & results" action="Match center" href="/matches" /><div className="grid gap-4 md:grid-cols-3">{homepageMatches.slice(0, 3).map((match) => <MatchCard key={match.id} match={match} />)}</div></section>

      <section id="news" className="mx-auto max-w-7xl px-5 pb-24 lg:px-8"><SectionHeading eyebrow="From around AKFL" title="Latest league news" action="All stories" href="/news" /><div className="grid gap-5 md:grid-cols-3">{news.map((item, index) => <Link href={`/news/${item.id}`} key={item.id} className="group overflow-hidden rounded-3xl border border-white/10 bg-panel"><div className={`relative h-40 bg-gradient-to-br ${index === 0 ? "from-sky/60 to-panel" : index === 1 ? "from-electric/35 to-panel" : "from-purple-500/40 to-panel"}`}>{item.cover_image_url ? <img src={item.cover_image_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <Flag className="absolute left-5 top-5 text-white" />}</div><div className="p-6"><p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{formatDate(item.published_at)}</p><h3 className="mt-3 font-display text-xl font-black leading-tight text-white group-hover:text-electric">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{item.content}</p><p className="mt-5 text-[10px] font-black uppercase tracking-widest text-electric">Read story →</p></div></Link>)}</div></section>

      <footer className="border-t border-white/10 px-5 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-white/35 sm:flex-row"><span>© 2026 AK Football League</span><span className="flex items-center gap-4"><Link href="/players" className="hover:text-electric">Players</Link><Link href="/referees" className="hover:text-electric">Officials</Link><Link href="/admin" className="hover:text-electric">Operations</Link></span></div></footer>
    </main>
  );
}

function TeamHero({ name, code, logo, side }: { name: string; code: string; logo: string; side: string }) { return <div className="text-center"><TeamBadge src={logo} alt={code} className="mx-auto h-20 w-20 sm:h-28 sm:w-28" /><h2 className="mt-4 font-display text-lg font-black text-white sm:text-2xl">{name}</h2><p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/35">{side}</p></div>; }
function MatchCard({ match }: { match: FeaturedMatch }) { const status = match.status === "completed" ? "FT" : match.status === "live" ? "LIVE" : match.status === "halftime" ? "HALF TIME" : "UPCOMING"; return <article className="rounded-2xl border border-white/10 bg-panel p-5"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40"><span>{match.pitch_location ?? "Venue TBC"}</span><span className={match.status === "live" || match.status === "halftime" ? "text-cyan" : "text-white/45"}>{status}</span></div><div className="mt-6 flex items-center justify-between gap-3"><div className="text-center"><TeamBadge src={match.home.logo_url ?? "/teams/team_logo_1.jpeg"} alt={match.home.short_code} className="mx-auto h-12 w-12" /><p className="mt-2 text-xs font-bold text-white">{match.home.short_code}</p></div><p className="font-display text-xl font-black text-white">{match.status === "scheduled" ? "—" : `${match.home_score} - ${match.away_score}`}</p><div className="text-center"><TeamBadge src={match.away.logo_url ?? "/teams/team_logo_2.jpeg"} alt={match.away.short_code} className="mx-auto h-12 w-12" /><p className="mt-2 text-xs font-bold text-white">{match.away.short_code}</p></div></div><p className="mt-5 flex items-center justify-center gap-2 text-xs text-white/45"><CalendarDays size={14} /> {new Date(match.kickoff_time).toLocaleString()}</p></article>; }
function LeaderCard({ title, leader, stat, unit, accent }: { title: string; leader: Leader; stat: number; unit: string; accent: "electric" | "sky" }) { const statColor = accent === "electric" ? "text-gold" : "text-cyan"; const glowColor = accent === "electric" ? "bg-gold/10" : "bg-cyan/10"; return <Link href={`/players/${leader.player_id}`} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-panel p-7 transition hover:border-white/25"><div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${glowColor}`} /><div className="relative flex items-center gap-5"><img src={leader.photo_url || "/players/default.png"} alt="" className="h-20 w-20 rounded-2xl object-cover" /><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{title}</p><h3 className="mt-2 font-display text-2xl font-black text-white group-hover:text-cyan">{leader.player_name}</h3><p className="text-sm text-white/45">{leader.team_name} · #{leader.short_code}</p></div><div className="ml-auto text-right"><p className={`font-display text-5xl font-black ${statColor}`}>{stat}</p><p className="text-[10px] font-black uppercase tracking-widest text-white/40">{unit}</p></div></div></Link>; }
function SectionHeading({ eyebrow, title, action, href }: { eyebrow: string; title: string; action: string; href: string }) { return <div className="mb-7 flex items-end justify-between"><div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-electric">{eyebrow}</p><h2 className="page-heading font-display text-3xl font-black tracking-tight text-white">{title}</h2></div><Link href={href} className="hidden items-center gap-2 text-xs font-black uppercase tracking-widest text-white/45 transition hover:text-electric sm:flex">{action} <ArrowRight size={14} /></Link></div>; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }); }
