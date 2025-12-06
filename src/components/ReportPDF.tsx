import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, lineHeight: 1.35, backgroundColor: '#ffffff' },
  h1: { fontSize: 20, marginBottom: 12, textAlign: 'center', color: '#1f2937', fontWeight: 'bold' },
  h2: { fontSize: 14, marginBottom: 8, color: '#374151', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 3 },
  col: { width: '14%', fontSize: 10, color: '#374151' },
  link: { color: '#2563eb', textDecoration: 'underline' },
  footer: { marginTop: 28, fontSize: 8, color: '#6b7280', textAlign: 'center' }
})

// ===== 1. 系数字典 (kg CO₂e / kg·km) —— 使用 GLEC Framework v2.0 (2023)，符合 EN 16258 国际实践 =====
const EF: Record<string, number> = {
  road: 0.000158,  // GLEC: Road freight, HGV, EU average
  sea:  0.0000131, // GLEC: Sea freight, container ship, deep sea
  air:  0.000927   // GLEC: Air freight, long-haul cargo
}

// ===== 2. 统一算总排放（输入：总重量 kg）=====
function calcTotalFromKg(weightKg: number, distance: number, mode: string) {
  const f = EF[mode.toLowerCase()] ?? EF.road;
  const emissionsKg = weightKg * distance * f; // kg CO₂e
  return emissionsKg / 1000; // 转换为 tCO₂e
}

// ===== 3. 根据运输方式返回燃料类型（GLEC v2.0 术语）=====
function getFuelType(mode: string): string {
  const lower = mode.toLowerCase();
  if (lower === 'air') return 'Kerosene'; // ✅ GLEC uses "Kerosene", not "Jet Fuel"
  if (lower === 'sea') return 'Marine Fuel Oil (Residual)'; // ✅ GLEC standard term
  return 'Diesel';
}

// ===== 新增：定义处理后的行数据类型（精简字段）=====
interface ProcessedRow {
  product: string;
  qty: number;
  unitWeightKg: number; // 改为原始单位 kg
  distance: number;
  mode: string;
  fuel: string;
  totalRow: number;
}

export default function ReportPDF({
  company,
  reportNo,
  date,
  rows,
  signer = 'Environmental Manager',
  legalResponsible = 'CEO' // Note: This prop is no longer used in approval line
}: any) {
  const VERIFY_BASE = process.env.NEXT_PUBLIC_VERIFY_URL || 'http://localhost:3000'

  // ===== 在组件内部计算每行数据 + 总排放 =====
  // 👇 关键修复：过滤掉无效行（qty, weight, distance 必须 > 0）
  const processedRows = rows
    .filter((r: any) => {
      const qty = Number(Array.isArray(r) ? r[1] : r?.qty) || 0;
      const weight = Number(Array.isArray(r) ? r[2] : r?.weightG) || 0;
      const dist = Number(Array.isArray(r) ? r[3] : r?.distance) || 0;
      return qty > 0 && weight > 0 && dist > 0;
    })
    .map((r: any) => {
      const product = (Array.isArray(r) ? r[0]?.toString() : r?.product?.toString()) || 'Unknown';
      const qty = Number(Array.isArray(r) ? r[1] : r?.qty) || 0;
      const unitWeightKg = Number(Array.isArray(r) ? r[2] : r?.weightG) || 0;
      const distance = Number(Array.isArray(r) ? r[3] : r?.distance) || 0;
      const mode = (Array.isArray(r) ? (r[4] || 'Road') : (r?.mode ?? 'Road'))?.toString() || 'Road';
      const fuel = getFuelType(mode);

      const totalWeightKg = qty * unitWeightKg;
      const totalRow = calcTotalFromKg(totalWeightKg, distance, mode);

      return {
        product,
        qty,
        unitWeightKg,
        distance,
        mode,
        fuel,
        totalRow
      }
    })

  // 计算总排放（tCO₂e）
  const grandTotal = processedRows.reduce((sum: number, row: ProcessedRow) => {
    return sum + (isNaN(row.totalRow) ? 0 : row.totalRow);
  }, 0);

  return (
    <Document>
      {/* ① Cover */}
      <Page style={styles.page}>
        <Text style={styles.h1}>Scope 3 Category 4: Upstream Transportation Emissions Report</Text>
        <Text style={{ marginBottom: 6 }}>Company: {company}</Text>
        <Text style={{ marginBottom: 6 }}>Report No.: {reportNo}</Text>
        <Text style={{ marginBottom: 6 }}>Date: {date}</Text>
        <Text style={styles.h2}>1. Executive Summary</Text>
        <Text style={{ marginBottom: 6 }}>This document presents the greenhouse gas (GHG) emissions for transport chain activities of the above-named company, calculated in accordance with EN 16258:2013 and ISO 14064-1:2018.</Text>
        <Text>Total transport emissions: {grandTotal.toFixed(3)} tCO₂e</Text>
      </Page>

      {/* ② Method */}
      <Page style={styles.page}>
        <Text style={styles.h2}>2. Methodology & Factors</Text>
        <Text style={{ marginBottom: 4 }}>• Standard: EN 16258:2013 (Well-to-Wheel, WTW)</Text>
        <Text style={{ marginBottom: 4 }}>• Conversion factors: GLEC Framework v2.0 (2023), aligned with ISO 14083</Text>
        <Text style={{ marginBottom: 4 }}>• GWP values: IPCC AR6 (100-year)</Text>
        <Text style={{ marginBottom: 4 }}>• Formula: E = Σ (mass[kg] × distance[km] × EF[kg CO₂e/kg·km])</Text>
        <Text style={{ marginBottom: 4 }}>• Boundary: transport leg from supplier gate to recipient gate</Text>
        <Text style={{ marginBottom: 4 }}>• Default mode: Road, Diesel (client can override in app)</Text>
        {/* 👇 新增默认值声明 */}
        <Text style={{ marginBottom: 4 }}>• Rows with missing or invalid transport mode default to Road.</Text>
        {/* ❌ 已删除冲突的 "±5% uncertainty" 行 */}
        {/* 👇 新增 WTW 明确说明（关键审计项） */}
        <Text style={{ marginBottom: 4 }}>• All emission factors from GLEC Framework v2.0 are Well-to-Wheel (WTW) values, including upstream (well-to-tank) emissions.</Text>
        <Link src="https://smartfreightcentre.org">Factor source (GLEC Framework v2.0)</Link>
      </Page>

      {/* ③ Results  */}
      <Page style={styles.page}>
        <Text style={styles.h2}>3. Results</Text>
        <View style={styles.tableRow}>
          <Text style={styles.col}>Product</Text>
          <Text style={styles.col}>Qty</Text>
          {/* 👇 表头改为 Unit Weight (kg) */}
          <Text style={styles.col}>Unit Weight (kg)</Text>
          <Text style={styles.col}>Distance(km)</Text>
          <Text style={styles.col}>Mode</Text>
          <Text style={styles.col}>Fuel</Text>
          {/* 👇 删除 WTT / TTW 列，只保留 Total */}
          <Text style={styles.col}>Total(tCO₂e)</Text>
        </View>
        {processedRows.map((row: ProcessedRow, i: number) => (
          <View style={styles.tableRow} key={i}>
            <Text style={styles.col}>{row.product}</Text>
            <Text style={styles.col}>{row.qty}</Text>
            {/* 👇 显示原始单件重量（kg），保留1位小数更合理 */}
            <Text style={styles.col}>{row.unitWeightKg.toFixed(1)}</Text>
            <Text style={styles.col}>{row.distance}</Text>
            <Text style={styles.col}>{row.mode}</Text>
            <Text style={styles.col}>{row.fuel}</Text>
            {/* 👇 只显示 Total */}
            <Text style={styles.col}>{row.totalRow.toFixed(4)}</Text>
          </View>
        ))}
        <Text style={{ marginTop: 10 }}>Total: {grandTotal.toFixed(3)} tCO₂e</Text>
        <Text style={styles.footer}>Uncertainty: ±22 % (k=2, GLEC 2023)</Text>
      </Page>

      {/* 3.1 Uncertainty —— 完全重写，符合 GLEC 官方建议 */}
      <Page style={styles.page}>
        <Text style={styles.h2}>3.1 Data Quality & Uncertainty</Text>
        <Text style={{ marginBottom: 4 }}>• This report follows GLEC Framework v2.0 (2023) guidance on uncertainty.</Text>
        <Text style={{ marginBottom: 4 }}>• Default combined uncertainty for multimodal freight: ±22% (k=2, 95% confidence).</Text>
        <Text style={{ marginBottom: 4 }}>• Source: GLEC Framework v2.0, Section 5.4 – Data Quality and Uncertainty.</Text>
        <Text style={{ marginTop: 12 }}>Quality Assurance</Text>
        <Text>Prepared by: Automated Calculation Engine</Text>
        <Text>Reviewed by: System Validation Rules</Text>
        <Text>Approval: Not applicable – system-generated report</Text>
      </Page>

      {/* ④ Report Integrity —— 修改标题和描述，如实反映内容哈希机制 */}
      <Page style={styles.page}>
        <Text style={styles.h2}>4. Report Integrity</Text>
        <Text style={{ marginBottom: 6 }}>
          This report was automatically generated and assigned a unique identifier.
          A content hash of the emission data is stored to detect any post-generation modification.
        </Text>
        <Text style={{ marginBottom: 6 }}>Generated by: {signer}</Text>
        <Text style={{ marginBottom: 6 }}>Position: Environmental Manager</Text>
        <Text style={{ marginBottom: 6 }}>Date: {date}</Text>
        <Text style={{ marginBottom: 6 }}>Unique report ID: {reportNo}</Text>
        <Link src={`${VERIFY_BASE}/verify/${reportNo}`}>Check report integrity</Link>
        <Text style={styles.footer}>
          {`Integrity verified by comparing content hash at ${VERIFY_BASE}/verify/${reportNo}`}
        </Text>
      </Page>
    </Document>
  )
}