import { supabase } from '../../../../lib/supabase'

export async function POST(req) {
  const { reportNo, payload, signatureHex } = await req.json()
  const { error } = await supabase
    .from('reports')
    .insert({ report_no: reportNo, payload, signature_hex: signatureHex })
  if (error) {
    console.error('store insert error', error)
    return new Response('FAIL', { status: 500 })
  }
  return new Response('OK')
}