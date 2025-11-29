// app/api/sign/route.js
import crypto from 'crypto'
import { readFileSync } from 'fs'

const privateKey = process.env.RSA_PRIVATE_PEM

export async function POST(req) {
  const payload = await req.text()          // ① 直接读字符串
  console.log('签名原始串:', payload)       // ← 打印放这里，别放外面
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(payload)
    .sign(privateKey, 'hex')               // ② 签名

  return new Response(signature, { status: 200 })
}