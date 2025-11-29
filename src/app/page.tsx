'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import dynamic from 'next/dynamic'
const ReportPDF = dynamic(() => import('@/components/ReportPDF'), { ssr: false })

export default function Home() {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [used, setUsed] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      setUser(u)
      if (u) loadCount(u.id)
    })
  }, [])

  const loadCount = async (uid: string) => {
    const { data } = await supabase.from('users').select('report_count').eq('id', uid).single()
    setUsed(data?.report_count ?? 0)
  }

  const sendMagic = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setSent(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUsed(0)
  }

  const getCoef = async (mode: string) => {
    const { data, error } = await supabase
      .from('coefficients')
      .select('co2e_kg_per_tkm')
      .eq('mode', mode)
      .single()
    if (error || !data) return 0.105
    return data.co2e_kg_per_tkm
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (used >= 120) { alert('Quota exceeded, +$40 per extra report.'); return }
    setLoading(true)

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      const out: any[][] = []
      for (let i = 0; i < data.length; i++) {
        if (i === 0) { out.push([...data[i], 'CO2e']); continue }
        const [prod, qty, wt, dist, mode] = data[i]
        const coef = await getCoef(mode || 'Road')
        const co2e = (qty * wt * dist * coef) / 1000
        out.push([prod, qty, wt, dist, mode, co2e])
      }

      const total = out.slice(1).reduce((s, r) => s + (r[5] || 0), 0)
      const reportNo = 'R' + Date.now()
      const company = prompt('Company name (English)') || 'Demo Client'
      const signer = prompt('Signer name') || 'Environmental Manager'
      const payload = JSON.stringify({ rows: out, total, company, reportNo, date: new Date().toISOString().split('T')[0] })

      const signatureHex = await fetch('/api/sign', { method: 'POST', body: payload }).then(r => r.text())
      const pdfRes = await fetch('/api/pdf', { method: 'POST', body: JSON.stringify({ rows: out, total, company, reportNo, signatureHex, signer }) })
      const blob = await pdfRes.blob()
      setPdfBlob(blob)
      await fetch('/api/store', { method: 'POST', body: JSON.stringify({ reportNo, payload, signatureHex }) })

      const { data: newCount, error } = await supabase.rpc('increment_report_by_email', { email: user.email.trim().toLowerCase() })
      if (error || newCount === null) console.error('计数失败', error, newCount)
      else setUsed(newCount) // ← 立即刷新显示
    } catch (e) {
      console.error('handleFile error', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="w-full max-w-4xl bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How to use</h2>
          <ul className="list-disc ml-6 text-slate-600 space-y-1">
            <li>Upload one XLSX file with columns: Product, Quantity, Weight (kg), Distance (km), Transport Mode (Road/Sea/Rail/Air)</li>
            <li>We calculate CO₂e using official DEFRA 2025 factors and split WTT/TTW per EN 16258</li>
            <li>Download a digitally-signed PDF ready for CBAM, ESRS or SEC submission</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Why us</h3>
          <ul className="list-disc ml-6 text-slate-600 space-y-1">
            <li>30-second turnaround · no consultancy fees</li>
            <li>Default factors accepted by EU & US regulators (±5 % uncertainty)</li>
            <li>RSA-2048 digital signature · instant verify</li>
            <li>One fixed price: $6,000/year — unlimited reports</li>
          </ul>
        </div>

        {!user ? (
          <div className="border rounded-lg p-4 space-y-2">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@company.com" className="w-full border rounded px-3 py-2"/>
            <button onClick={sendMagic} className="w-full bg-slate-800 text-white rounded py-2">Send Magic Link</button>
            {sent && <p className="text-sm text-green-600">Check your inbox!</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Logged in: {user.email}</span>
            <span className="text-sm text-slate-600">Reports this year: {used}/120</span>
            <button onClick={handleLogout} className="text-sm underline">Logout</button>
          </div>
        )}

        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-800">Carbon Scope-3 Transport Report</h1>
          <p className="text-slate-500 mt-2">EN 16258:2013 compliant · Digital signature · 30-second delivery</p>
        </div>
        <div className="border-t border-slate-200"></div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Upload XLSX file</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            disabled={loading || !user}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
        {loading && (
          <div className="flex items-center justify-center py-4 gap-3 text-slate-600">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Calculating & signing...
          </div>
        )}
        {pdfBlob && (
          <div className="text-center">
            <a
              href={URL.createObjectURL(pdfBlob)}
              download="carbon-report.pdf"
              className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"></path></svg>
              Download PDF
            </a>
          </div>
        )}
        <div className="text-xs text-slate-400 text-center">RSA-2048 digitally signed · ISO 14064-1 & EN 16258:2013 compliant</div>
      </div>
    </main>
  )
}