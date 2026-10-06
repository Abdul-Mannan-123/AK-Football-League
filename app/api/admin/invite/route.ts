import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = user
    ? await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").eq("is_active", true).maybeSingle()
    : { data: null };
  if (!user || (!role && user.app_metadata?.role !== "admin")) {
    return NextResponse.json({ error: "Administrator permission required." }, { status: 403 });
  }

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Server invite configuration is missing. Add SUPABASE_SERVICE_ROLE_KEY to the server environment only." }, { status: 503 });
  }

  const adminClient = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: invited, error } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (error || !invited.user) return NextResponse.json({ error: error?.message ?? "Could not invite user." }, { status: 400 });
  return NextResponse.json({ userId: invited.user.id });
}
