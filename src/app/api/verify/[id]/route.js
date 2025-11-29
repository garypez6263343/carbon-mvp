import crypto from 'crypto'
import { supabase } from '../../../../../lib/supabase'

const publicKey = process.env.RSA_PUBLIC_PEM

export async function GET(_, { params }) {
  const id = await params.then(p => p.id)

  // 1. 取报告
  const { data, error } = await supabase
    .from('reports')
    .select('payload, signature_hex')
    .eq('report_no', id)
    .single()

  if (error || !data) {
    return Response.json({ valid: false, message: 'Report not found' }, { status: 404 })
  }

  // 2. 验签
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(Buffer.from(data.payload, 'utf8'))
  const valid = verifier.verify(publicKey, data.signature_hex, 'hex')

  // 3. 返回结果（不再带 public_key，减少信息泄露）
  return Response.json({
    valid,
    message: valid ? 'Signature is valid.' : 'Signature INVALID!'
  })
}