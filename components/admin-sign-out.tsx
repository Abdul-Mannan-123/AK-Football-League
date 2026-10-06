"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setBusy(false);
      return;
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-red-300/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut size={16} />
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
