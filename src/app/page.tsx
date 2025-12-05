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
  const [used, setUsed] = useState(0)

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      setUser(u)
      if (u) loadCount(u.id)
    }
    fetchSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user
      setUser(u)
      if (u) loadCount(u.id)
      else setUsed(0)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const loadCount = async (uid: string) => {
    const { data } = await supabase.from('users').select('report_count').eq('id', uid).single()
    setUsed(data?.report_count ?? 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUsed(0)
  }

  const getCoef = async (mode: string) => {
    const map: Record<string, number> = {
      road: 0.025,
      sea: 0.0085,
      air: 0.501,
      rail: 0.010
    }
    return map[mode.toLowerCase()] || 0.025
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setLoading(true)

    // 检查是否已付费（users 表存在该 email）
    const { data } = await supabase.from('users').select('email').eq('email', user.email).single()
    if (!data) {
      alert('Please complete payment at the top of this page first.')
      setLoading(false)
      return
    }

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      const out: any[][] = []
      for (let i = 0; i < data.length; i++) {
        if (i === 0) { out.push([...data[i], 'CO2e']); continue }
        const [prod, qty, wt, dist, mode] = data[i]
        const coef = await getCoef(mode || 'Road')
        const totalEmission_tCO2e = (qty * wt * dist * coef) / 1_000_000
        out.push([prod, qty, wt, dist, mode, totalEmission_tCO2e])
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

      // 存储报告并更新计数
      await fetch('/api/store', { method: 'POST', body: JSON.stringify({ reportNo, payload, signatureHex }) })
      const { data: newCount, error } = await supabase.rpc('increment_report_by_email', { email: user.email.trim().toLowerCase() })
      if (!error && newCount !== null) setUsed(newCount)
    } catch (e) {
      console.error('handleFile error', e)
      alert('Failed to process file. Check console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-800">Carbon Scope-3 Transport Report</h1>
          <p className="text-slate-500 mt-2">EN 16258:2013 methodology · System-generated with integrity hash · 30-second delivery</p>
        </div>

        <div className="w-full max-w-4xl bg-white rounded-xl shadow p-6 mb-6 text-center">
          <a
            href="https://lopezian316.gumroad.com/l/carbondrop"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700"
          >
            ✅ Pay $1,499 → Get Instant Access & Generate Reports Now
          </a>
          <p className="text-xs text-slate-500 mt-2">
            Pay with any email, then use that same email to log in and generate reports.<br />
            If your submission is rejected by CDP/EcoVadis due to a calculation error on our part, email support@emissionreport.top within 30 days with evidence for a refund.
          </p>
        </div>

        <div className="w-full max-w-4xl bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How to use</h2>
          <ul className="list-disc ml-6 text-slate-600 space-y-1">
            <li>Upload one XLSX file with columns: Product, Quantity, Weight (kg), Distance (km), Mode (Road/Rail/Sea/Air; blank = Road)</li>
            <li>We calculate CO₂e using the GLEC Framework v2.0 (2023) — the global standard for logistics emissions — in accordance with EN 16258:2013.</li>
            <li>Download a system-generated PDF supporting disclosure preparation for CDP, EcoVadis, ESRS or SEC reporting.</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Why us</h3>
          <ul className="list-disc ml-6 text-slate-600 space-y-1">
            <li>30-second turnaround · no consultancy fees</li>
            <li>Uses GLEC v2.0 emission factors referenced in EU and US regulatory guidance</li>
            <li>Includes ±22% uncertainty estimate per GLEC recommendations</li>
            <li>SHA-256 integrity hash + unique report ID · verify online</li>
            <li>One fixed price: $1,499/year — unlimited reports</li>
          </ul>
        </div>

        {/* 魔法链接登录 - 完全还原你应有的原始交互 */}
        {user ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Logged in: {user.email}</span>
            <span className="text-sm text-slate-600">Reports this year: {used}</span>
            <button onClick={handleLogout} className="text-sm underline text-slate-600 hover:text-slate-800">
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Email for magic link login</label>
            <div className="flex gap-2">
              <input
                type="email"
                id="magic-email"
                placeholder="your@email.com"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const email = (e.target as HTMLInputElement).value.trim()
                    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      supabase.auth.signInWithOtp({ email })
                      alert(`Magic link sent to ${email}. Check your inbox.`)
                    } else {
                      alert('Please enter a valid email address.')
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('magic-email') as HTMLInputElement
                  const email = input?.value.trim()
                  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    supabase.auth.signInWithOtp({ email })
                    alert(`Magic link sent to ${email}. Check your inbox.`)
                  } else {
                    alert('Please enter a valid email address.')
                  }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 whitespace-nowrap"
              >
                Send magic link
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Use the same email you paid with on Gumroad.
            </p>
          </div>
        )}

        <div className="border-t border-slate-200"></div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Upload XLSX file</label>
          <div className="flex items-center gap-3">
            <input
              ref={(el) => {
                if (!el) return
                el.style.width = '0'
                el.style.height = '0'
                el.style.opacity = '0'
                el.style.position = 'absolute'
              }}
              type="file"
              accept=".xlsx"
              disabled={loading || !user}
              onChange={handleFile}
            />
            <button
              onClick={() =>
                document.querySelector<HTMLInputElement>('input[type="file"][accept=".xlsx"]')?.click()
              }
              disabled={!user}
              className={`px-4 py-2 border rounded-md shadow-sm text-sm font-semibold ${
                !user
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              Choose file
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center text-xs text-slate-500">Calculating & signing...</div>
        )}

        {pdfBlob && (
          <div className="text-center">
            <a
              href={URL.createObjectURL(pdfBlob)}
              download="carbon-report.pdf"
              className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Download PDF
            </a>
          </div>
        )}
        <div className="text-xs text-slate-400 text-center mt-4">
          SHA-256 integrity hash + unique report ID · Calculated in accordance with ISO 14064-1 & EN 16258:2013<br />
          If your submission is rejected by CDP/EcoVadis due to a calculation error on our part, email support@emissionreport.top within 30 days with evidence for a refund.
        </div>
      </div>
    </main>
  )
}