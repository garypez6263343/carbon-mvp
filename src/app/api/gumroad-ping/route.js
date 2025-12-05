import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request) {
  const formData = await request.formData()

  // === 终端调试：打印所有字段 ===
  console.log('🔔 Gumroad ping raw:')
  for (const [k, v] of formData.entries()) {
    console.log(`  ${k}: ${v}`)
  }

  const email   = formData.get('email')?.trim().toLowerCase()
  const reportNo = formData.get('report')
  const state   = formData.get('state') ?? 'paid'   // 测试模式无 state 时默认 paid

  if (state !== 'paid' || !email) {
    console.log('⏭️  skipped: state=' + state + ' email=' + email)
    return NextResponse.json({ message: 'skipped' }, { status: 200 })
  }

  console.log('✅ paid: email=' + email + ' report=' + reportNo)

  // 1. 写/更新用户（主键 = email，无其他字段）
  const { error: userErr } = await supabase.from('users').upsert(
    { email: email },               // 主键就是 email，无 id 字段
    { onConflict: 'email' }
  )
  if (userErr) console.error('user upsert', userErr)

  // 2. 写订单（保留，你之前说要，不删）
  const { error: orderErr } = await supabase.from('orders').insert({
    email,
    report_no: reportNo,
    status: 'paid',
    created_at: new Date().toISOString()
  })
  if (orderErr) console.error('order insert', orderErr)

  return NextResponse.json({ message: 'ok' }, { status: 200 })
}