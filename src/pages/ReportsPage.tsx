import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import srmLogo from '../assets/srmist-logo.png';
import UserMenu from '../components/UserMenu';
import '../components/SharedPageStyles.css';
import styles from './ReportsPage.module.css';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Download } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetricRow { label: string; value: any }
interface DeptData  { department: string; [key: string]: any }
interface MetricsResponse {
  report_year:            number;
  prev_month_label:       string;
  reporting_period_start: string;
  reporting_period_end:   string;
  overall:                any | null;
  departments:            DeptData[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: any): string =>
  typeof v === 'number' ? v.toLocaleString('en-IN') : String(v ?? '—');

const buildRows = (data: any, prevMonthLabel: string, reportYear: number): MetricRow[] => {
  if (!data) return [];
  const rows: MetricRow[] = [];
  const push = (label: string, key: string) => {
    if (data[key] != null) rows.push({ label, value: data[key] });
  };
  push('Total no. of Publications [consolidated] from all databases',                    'total_publications_all_databases');
  push('Total no. of journal papers published in Scopus [consolidated] since inception', 'total_journal_papers_in_scopus');
  if (data.total_publications_in_year    != null) rows.push({ label: `Total no. of Publications in Scopus in ${reportYear}`,           value: data.total_publications_in_year });
  if (data.total_publications_prev_month != null) rows.push({ label: `Total no. of Publications in Scopus during ${prevMonthLabel}`,   value: data.total_publications_prev_month });
  push('Total number of Citations in Scopus [consolidated] right from inception',        'total_citations_scopus_consolidated');
  // Citation index is now computed for both overall and each department in the backend
  push('Citation Index [consolidated] right from inception till date',                   'citation_index_consolidated');
  if (data.cumulative_impact_factor != null) rows.push({ label: `Cumulative Impact Factor for publications in ${reportYear}`, value: data.cumulative_impact_factor });
  if (data.cumulative_snip          != null) rows.push({ label: `Cumulative SNIP for publications in ${reportYear}`,         value: data.cumulative_snip });
  push('i-10 index in Scopus [consolidated]',  'i10_index_scopus_consolidated');
  push('h-index Scopus [consolidated]',         'h_index_scopus_consolidated');
  push('h-index Web of Science [consolidated]', 'h_index_wos_consolidated');
  return rows;
};

// ── PDF generation (jsPDF + autoTable) ───────────────────────────────────────
const generatePDF = async (
  metrics: MetricsResponse,
  prevMonthLabel: string,
  reportYear: number
) => {
  const jsPDFModule  = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const jsPDF        = jsPDFModule.default;
  const autoTable    = autoTableMod.default;

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const margin = 15;
  const colW   = pageW - margin * 2;

  const navy  = [18, 24, 61]    as [number, number, number];
  const gold  = [138, 114, 64]  as [number, number, number];
  const grey  = [107, 114, 128] as [number, number, number];
  const white = [255, 255, 255] as [number, number, number];
  const light = [250, 250, 250] as [number, number, number];

  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  // Header banner
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SRM Institute of Science and Technology', pageW / 2, 11, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Publication Metrics Report', pageW / 2, 19, { align: 'center' });

  doc.setTextColor(...grey);
  doc.setFontSize(8.5);
  doc.text(`Report Year: ${reportYear}   |   Generated: ${dateStr}`, pageW / 2, 35, { align: 'center' });

  let y = 42;

  const drawTable = (title: string, rows: MetricRow[]) => {
    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(title, margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: colW,
      head: [[
        { content: 'S.No.',               styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Publication Metrics', styles: { halign: 'left' } },
        { content: 'NUMBER',              styles: { halign: 'center', cellWidth: 34 } },
      ]],
      body: rows.map((r, i) => [
        { content: String(i + 1), styles: { halign: 'center' } },
        { content: r.label,       styles: { halign: 'left' } },
        { content: fmt(r.value),  styles: { halign: 'center', fontStyle: 'bold' } },
      ]),
      headStyles:           { fillColor: gold, textColor: white, fontSize: 8, fontStyle: 'bold', cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      bodyStyles:           { fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [31, 41, 55] as [number, number, number] },
      alternateRowStyles:   { fillColor: light },
      theme: 'grid',
      didDrawPage: () => {
        const pg = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7.5);
        doc.setTextColor(...grey);
        doc.text(`SRMIST — Publication Metrics Report   |   Page ${pg}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  };

  if (metrics.overall) {
    drawTable('All Departments (Overall)', buildRows(metrics.overall, prevMonthLabel, reportYear));
  }

  if (metrics.departments?.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...navy);
    doc.text('Per-Department Breakdown', margin, y);
    y += 7;

    for (const dept of metrics.departments) {
      const rows = buildRows(dept, prevMonthLabel, reportYear);
      if (rows.length === 0) continue;
      drawTable(dept.department, rows);
    }
  }

  if (y < doc.internal.pageSize.getHeight() - 20) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...grey);
    doc.text('* Metrics are sourced from Scopus data only.', margin, y);
  }

  doc.save(`SRMIST_Publication_Metrics_${reportYear}.pdf`);
};

// ── Component ─────────────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const [publicationMetrics, setPublicationMetrics] = useState<MetricsResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const { getAuthHeaders, isRestrictedFaculty } = useAuth();

  useEffect(() => {
    if (isRestrictedFaculty && isRestrictedFaculty()) {
      window.location.href = '/';
      return;
    }
    fetchPublicationMetrics();
  }, []);

  const fetchPublicationMetrics = async () => {
    try {
      const res = await axios.get('https://srm-sp-production.up.railway.app/api/publication-metrics', {
        headers: getAuthHeaders(),
      });
      setPublicationMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch publication metrics:', err);
    }
  };

  const handleGeneratePDF = async () => {
    if (!publicationMetrics) return;
    setGenerating(true);
    try {
      await generatePDF(
        publicationMetrics,
        publicationMetrics.prev_month_label ?? '',
        publicationMetrics.report_year ?? new Date().getFullYear() - 1,
      );
    } finally {
      setGenerating(false);
    }
  };

  const prevMonthLabel = publicationMetrics?.prev_month_label ?? '';
  const reportYear     = publicationMetrics?.report_year ?? new Date().getFullYear();
  const hasData        = !!(publicationMetrics && (publicationMetrics.overall || publicationMetrics.departments?.length > 0));

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100vh' }}>
      {/* Navbar */}
      <div className="shared-navbar">
        <a className="shared-logo">
          <img src={srmLogo} alt="SRM Logo" className="shared-nav-logo" />
          <span>SRM SP</span>
        </a>
        <UserMenu />
      </div>

      <div className={styles.container}>

        {/* ── Page header ──────────────────────────────────────────────────
            Order: back button → title → subtitle
        ────────────────────────────────────────────────────────────────── */}
        <div className={styles.pageHeader}>
          {/* Back button ABOVE the title */}
          <div className={styles.backRow}>
            <Link to="/dashboard" className="shared-back-button">« Back to Dashboard</Link>
          </div>
          <h1 className={styles.pageTitle}>Publication Metrics Report</h1>
          <p className={styles.pageSubtitle}>
            NAAC / NIRF-style consolidated publication metrics — sourced from Scopus
          </p>
        </div>

        {/* ── Action bar (Generate PDF only, outside the card) ─────────── */}
        <div className={styles.actionBar}>
          <button
            className={styles.reportBtn}
            onClick={handleGeneratePDF}
            disabled={!hasData || generating}
          >
            <Download size={15} />
            {generating ? 'Generating…' : 'Generate PDF Report'}
          </button>
        </div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <BookOpen size={18} />
            <span>Publication Metrics</span>
            {publicationMetrics && (
              <span className={styles.cardMeta}>Report Year: {reportYear}</span>
            )}
          </div>

          <div className={styles.cardBody}>
            {hasData ? (
              <>
                {publicationMetrics!.overall && (
                  <div className={styles.tableBlock}>
                    <h3 className={styles.tableBlockTitle}>All Departments (Overall)</h3>
                    <MetricsTable rows={buildRows(publicationMetrics!.overall, prevMonthLabel, reportYear)} />
                    <p className={styles.footnote}>* Metrics sourced from Scopus only. Report year: {reportYear}.</p>
                  </div>
                )}

                {publicationMetrics!.departments?.length > 0 && (
                  <>
                    <h2 className={styles.sectionDivider}>Per-Department Breakdown</h2>
                    <div className={styles.deptGrid}>
                      {publicationMetrics!.departments.map((d, idx) => (
                        <div key={d.department || idx} className={styles.deptBlock}>
                          <h4 className={styles.deptTitle}>{d.department}</h4>
                          <MetricsTable rows={buildRows(d, prevMonthLabel, reportYear)} compact />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className={styles.noData}>
                {publicationMetrics === null ? 'Loading metrics…' : 'No metrics available.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MetricsTable ──────────────────────────────────────────────────────────────
const MetricsTable: React.FC<{ rows: MetricRow[]; compact?: boolean }> = ({ rows, compact }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 12 : 13.5 }}>
      <thead>
        <tr>
          <th style={thS('sno')}>S.No.</th>
          <th style={thS('label')}>Publication Metrics</th>
          <th style={thS('value')}>NUMBER</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={tdS('sno')}>{i + 1}</td>
            <td style={tdS('label')}>{r.label}</td>
            <td style={tdS('value')}>{fmt(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const thS = (col: 'sno' | 'label' | 'value'): React.CSSProperties => ({
  padding: col === 'sno' ? '10px 12px' : col === 'label' ? '10px 18px' : '10px 14px',
  background: '#8a7240', color: '#fff', fontSize: 12, fontWeight: 700,
  textAlign: col !== 'label' ? 'center' : 'left',
  borderRight: col !== 'value' ? '1px solid rgba(255,255,255,0.15)' : 'none',
  width: col === 'sno' ? 56 : col === 'value' ? 120 : 'auto',
  letterSpacing: 0.3,
});

const tdS = (col: 'sno' | 'label' | 'value'): React.CSSProperties => ({
  padding: col === 'sno' ? '11px 12px' : col === 'label' ? '11px 18px' : '11px 14px',
  fontWeight: col === 'value' ? 700 : 400,
  color: col === 'value' ? '#12183d' : col === 'sno' ? '#6b7280' : '#1f2937',
  textAlign: col !== 'label' ? 'center' : 'left',
  borderBottom: '1px solid #f0f0f0',
  borderRight: col !== 'value' ? '1px solid #f0f0f0' : 'none',
  verticalAlign: 'top', lineHeight: 1.5,
});

export default ReportsPage;