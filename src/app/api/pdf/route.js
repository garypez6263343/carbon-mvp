// app/api/pdf/route.js
import React from 'react'
import crypto from 'crypto'
import { pdf } from '@react-pdf/renderer'
import ReportPDF from '@/components/ReportPDF'

const reports = new Map()

export async function POST(req) {
  const body = await req.json()
  const { rows, total, company, reportNo, signatureHex } = body

  // 补当天日期
  const date = new Date().toISOString().split('T')[0]

  // 存报告
  reports.set(reportNo, {
    payload: JSON.stringify({ rows, total, company, reportNo, date }),
    signatureHex,
    publicKey: process.env.RSA_PUBLIC_PEM
  })

  const blob = await pdf(React.createElement(ReportPDF, { ...body, date })).toBlob()
  return new Response(blob, { headers: { 'Content-Type': 'application/pdf' } })
}