// src/app/api/auth/route.ts
import { supabase } from '../../../../lib/supabase'

export async function POST(req: Request) {
  const { email } = await req.json()
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}