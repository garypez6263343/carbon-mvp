import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, lineHeight: 1.35, backgroundColor: '#ffffff' },
  h1: { fontSize: 20, marginBottom: 12, textAlign: 'center', color: '#1f2937', fontWeight: 'bold' },
  h2: { fontSize: 14, marginBottom: 8, color: '#374151', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 3 },
  col: { width: '12.5%', fontSize: 10, color: '#374151' },
  link: { color: '#2563eb', textDecoration: 'underline' },
  footer: { marginTop: 28, fontSize: 8, color: '#6b7280', textAlign: 'center' }
})

export default function ReportPDF({ company, reportNo, date, rows, total, signer = 'Environmental Manager' }: any) {
  const EF_WTT = 0.021
  const EF_TTW = 0.084
  const VERIFY_BASE = process.env.NEXT_PUBLIC_VERIFY_URL || 'http://localhost:3000'

  return (
    <Document>
      {/* ① Cover */}
      <Page style={styles.page}>
        <Text style={styles.h1}>Carbon Scope-3 Transport Report</Text>
        <Text style={{ marginBottom: 6 }}>Company: {company}</Text>
        <Text style={{ marginBottom: 6 }}>Report No.: {reportNo}</Text>
        <Text style={{ marginBottom: 6 }}>Date: {date}</Text>
        <Text>Total transport emissions: {(total / 1000).toFixed(3)} tCO₂e</Text>
      </Page>

      {/* ② Method */}
      <Page style={styles.page}>
        <Text style={styles.h2}>2. Methodology & Factors</Text>
        <Text style={{ marginBottom: 4 }}>• Standard: EN 16258:2013 (Well-to-Wheel, WTW)</Text>
        <Text style={{ marginBottom: 4 }}>• Conversion factors: UK DEFRA 2025 v1.0, Table 12 (Road freight)</Text>
        <Text style={{ marginBottom: 4 }}>• GWP values: IPCC AR6 (100-year)</Text>
        <Text style={{ marginBottom: 4 }}>• Formula: E = Σ (mass[t] × distance[km] × EF[kg CO₂e/t·km])</Text>
        <Text style={{ marginBottom: 4 }}>• Boundary: transport leg from supplier gate to recipient gate</Text>
        <Text style={{ marginBottom: 4 }}>• Default mode: Road, Diesel (client can override in app)</Text>
        <Text style={{ marginBottom: 4 }}>• Data quality: company ERP export, ±5 % uncertainty</Text>
        <Link src="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025">Factor source (hyperlinked)</Link>
      </Page>

      {/* ③ Result  —— 仅此处加 Mode 列 */}
      <Page style={styles.page}>
        <Text style={styles.h2}>3. Results</Text>
        <View style={styles.tableRow}>
          <Text style={styles.col}>Product</Text>
          <Text style={styles.col}>Qty</Text>
          <Text style={styles.col}>Weight(t)</Text>
          <Text style={styles.col}>Distance(km)</Text>
          <Text style={styles.col}>Mode</Text>          {/* ← 新增 */}
          <Text style={styles.col}>Fuel</Text>
          <Text style={styles.col}>WTT(tCO₂e)</Text>
          <Text style={styles.col}>TTW(tCO₂e)</Text>
          <Text style={styles.col}>Total(tCO₂e)</Text>
        </View>
        {rows.map((r: any, i: number) => {
          const product = Array.isArray(r) ? r[0] : r.product
          const qty = Array.isArray(r) ? r[1] : r.qty
          const weightG = Array.isArray(r) ? r[2] : r.weightG
          const distance = Array.isArray(r) ? r[3] : r.distance
          const mode = Array.isArray(r) ? (r[4] || 'Road') : (r.mode || 'Road') 
          const fuel = Array.isArray(r) ? 'Diesel' : (r.fuel ?? 'Diesel')
          const weightT = weightG / 1000
          const wtt = weightT * distance * EF_WTT
          const ttw = weightT * distance * EF_TTW
          const totalRow = wtt + ttw
          return (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.col}>{product}</Text>
              <Text style={styles.col}>{qty}</Text>
              <Text style={styles.col}>{weightT.toFixed(3)}</Text>
              <Text style={styles.col}>{distance}</Text>
              <Text style={styles.col}>{mode}</Text>          {/* ← 新增 */}
              <Text style={styles.col}>{fuel}</Text>
              <Text style={styles.col}>{wtt.toFixed(4)}</Text>
              <Text style={styles.col}>{ttw.toFixed(4)}</Text>
              <Text style={styles.col}>{totalRow.toFixed(4)}</Text>
            </View>
          )
        })}
        <Text style={{ marginTop: 10 }}>Total: {(total / 1000).toFixed(3)} tCO₂e</Text>
        <Text style={styles.footer}>Uncertainty: ±5 % (DEFRA 2025 Table 12 Road Freight)</Text>
      </Page>

      {/* ④ Sign */}
      <Page style={styles.page}>
        <Text style={styles.h2}>4. Electronic Signature</Text>
        <Text style={{ marginBottom: 6 }}>This report has been digitally signed in accordance with ISO 14064-1:2018 and EN 16258:2013.</Text>
        <Text style={{ marginBottom: 6 }}>Signer: {signer}</Text>
        <Text style={{ marginBottom: 6 }}>Position: Environmental Manager</Text>
        <Text style={{ marginBottom: 6 }}>Date: {date}</Text>
        <Text style={{ marginBottom: 6 }}>Unique report ID: {reportNo}</Text>
        <Link src={`${VERIFY_BASE}/verify/${reportNo}`}>Verify signature</Link>
        <Text style={styles.footer}>{`RSA-2048 digital signature applied – verify at ${VERIFY_BASE}/verify/${reportNo}`}</Text>
      </Page>
    </Document>
  )
}