'use client'
import { useEffect, useState } from 'react'

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const [result, setResult] = useState<any>(null)
  const [id, setId] = useState<string>('')

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      fetch(`/api/verify/${p.id}`)
        .then(r => r.json())
        .then(setResult)
    })
  }, [params])

  if (!result) return <p>Loading verification...</p>

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Digital Signature Verification</h1>
      <p className="mb-2">Report ID: {id}</p>
      <p className={result.valid ? 'text-green-600' : 'text-red-600'}>{result.message}</p>
      {/* 下面这段把公钥里的 \r 去掉，保证显示和验证字节一致 */}
      <pre className="mt-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
    </main>
  )
}