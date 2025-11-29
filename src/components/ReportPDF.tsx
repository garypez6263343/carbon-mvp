import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 10, lineHeight: 1.4 },
  h1: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  h2: { fontSize: 12, marginBottom: 6 },
  tableRow: { flexDirection: 'row', marginBottom: 3 },
  col: { width: '14%' },
  link: { color: 'blue', textDecoration: 'underline' },
  footer: { marginTop: 30, fontSize: 8, color: '#555' }
})

export default function ReportPDF({ company, reportNo, date, rows, total, signer = 'Environmental Manager' }: any) {
  // 写死 Road+Diesel 因子 (DEFRA 2025 v1.0  Table 12  WTW)
  const EF_WTT = 0.021
  const EF_TTW = 0.084

  return (
    <Document>
      {/* ① Cover */}
      <Page style={styles.page}>
        <Text style={styles.h1}>Carbon Scope-3 Transport Report</Text>
        <Text>Company: {company}</Text>
        <Text>Report No.: {reportNo}</Text>
        <Text>Date: {date}</Text>
        <Text style={styles.h2}>1. Executive Summary</Text>
        <Text>This document presents the greenhouse gas (GHG) emissions for transport chain activities of the above-named company, calculated in accordance with EN 16258:2013 and ISO 14064-1:2018.</Text>
        <Text>Total transport emissions: {(total/1000).toFixed(3)} tCO₂e</Text>
      </Page>

      {/* ② Method */}
      <Page style={styles.page}>
        <Text style={styles.h2}>2. Methodology & Factors</Text>
        <Text>• Standard: EN 16258:2013 (Well-to-Wheel, WTW)</Text>
        <Text>• Conversion factors: UK DEFRA 2025 v1.0, Table 12 (Road freight)</Text>
        <Text>• GWP values: IPCC AR6 (100-year)</Text>
        <Text>• Formula: E = Σ (mass[t] × distance[km] × EF[kg CO₂e/t·km])</Text>
        <Text>• Boundary: transport leg from supplier gate to recipient gate</Text>
        <Text>• Default mode: Road, Diesel (client can override in app)</Text>
        <Text>• Data quality: company ERP export, ±5 % uncertainty</Text>
        <Link src="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025">Factor source (hyperlinked)</Link>
      </Page>

      {/* ③ Result */}
      <Page style={styles.page}>
        <Text style={styles.h2}>3. Results</Text>
        <View style={styles.tableRow}>
          <Text style={styles.col}>Product</Text>
          <Text style={styles.col}>Qty</Text>
          <Text style={styles.col}>Weight(t)</Text>
          <Text style={styles.col}>Distance(km)</Text>
          <Text style={styles.col}>Mode</Text>
          <Text style={styles.col}>Fuel</Text>
          <Text style={styles.col}>WTT(tCO₂e)</Text>
          <Text style={styles.col}>TTW(tCO₂e)</Text>
          <Text style={styles.col}>Total(tCO₂e)</Text>
        </View>
        // 在 map 里先解构，避免 TS 抱怨
{rows.map((r: any, i: number) => {
  // 如果外部还是按列传，就按索引读；否则直接读对象
  const product   = Array.isArray(r) ? r[0] : r.product;
  const qty       = Array.isArray(r) ? r[1] : r.qty;
  const weightG   = Array.isArray(r) ? r[2] : r.weightG;
  const distance  = Array.isArray(r) ? r[3] : r.distance;
  const mode      = Array.isArray(r) ? 'Road' : (r.mode ?? 'Road');
  const fuel      = Array.isArray(r) ? 'Diesel' : (r.fuel ?? 'Diesel');
  const weightT   = weightG / 1000;
  const wtt       = weightT * distance * EF_WTT;
  const ttw       = weightT * distance * EF_TTW;
  const totalRow  = wtt + ttw;
  return (
    <View style={styles.tableRow} key={i}>
      <Text style={styles.col}>{product}</Text>
      <Text style={styles.col}>{qty}</Text>
      <Text style={styles.col}>{weightT.toFixed(3)}</Text>
      <Text style={styles.col}>{distance}</Text>
      <Text style={styles.col}>{mode}</Text>
      <Text style={styles.col}>{fuel}</Text>
      <Text style={styles.col}>{wtt.toFixed(4)}</Text>
      <Text style={styles.col}>{ttw.toFixed(4)}</Text>
      <Text style={styles.col}>{totalRow.toFixed(4)}</Text>
    </View>
  );
})}
        <Text style={{ marginTop: 10 }}>Total: {(total/1000).toFixed(3)} tCO₂e</Text>
        <Text style={styles.footer}>Uncertainty: ±5 % (DEFRA 2025 Table 12 Road Freight)</Text>
      </Page>

      {/* ④ Sign */}
      <Page style={styles.page}>
        <Text style={styles.h2}>4. Electronic Signature</Text>
        <Text>This report has been digitally signed in accordance with ISO 14064-1:2018 and EN 16258:2013.</Text>
        <Text> </Text>
        <Text>Signer: {signer}</Text>
        <Text>Position: Environmental Manager</Text>
        <Text>Date: {date}</Text>
        <Text>Unique report ID: {reportNo}</Text>
        <Link src={`http://localhost:3000/verify/${reportNo}`}>Verify signature</Link>
        <Text style={styles.footer}>RSA-2048 digital signature applied – verify at http://localhost:3000/verify/{reportNo}</Text>
      </Page>
    </Document>
  )
}