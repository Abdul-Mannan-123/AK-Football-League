export default function LoadingPlayers() {
  return <main className="min-h-screen bg-ink px-5 py-24"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-12 w-56 rounded bg-white/10" /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-panel" />)}</div></div></main>;
}
