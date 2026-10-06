"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "unauthorized") {
      setError("This account does not have an admin or referee role.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/admin");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-panel p-7 shadow-glow sm:p-9">
        <div className="mb-8 flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-electric text-ink"><ShieldCheck size={24} /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.25em] text-electric">Restricted access</p><h1 className="mt-1 font-display text-2xl font-black text-white">Admin Portal</h1></div>
        </div>
        <p className="mb-6 text-sm leading-6 text-white/55">Sign in with the email and password created in Supabase Authentication. Only accounts assigned the admin or referee role can continue.</p>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-white/70">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-white outline-none focus:border-electric" autoComplete="email" /></label>
          <label className="grid gap-2 text-sm font-bold text-white/70">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-white outline-none focus:border-electric" autoComplete="current-password" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={busy} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-electric px-4 py-3 font-black text-ink disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole size={17} />{busy ? "Signing in..." : "Sign in securely"}</button>
        </form>
        <Link href="/" className="mt-6 block text-center text-sm font-bold text-white/45 hover:text-electric">Back to public site</Link>
      </section>
    </main>
  );
}
