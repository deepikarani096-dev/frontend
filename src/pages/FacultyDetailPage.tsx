import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Highcharts from 'highcharts';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import srmLogo from '../assets/srmist-logo.png';
import UserMenu from '../components/UserMenu';
import '../components/SharedPageStyles.css';
import '../components/FacultyDetailPage.css';

interface Faculty {
  scopus_ids?: string[];
  scopus_id?: string;
  name: string;
  docs_count: number;
  faculty_id: string;
  citation_count: number;
  h_index: number;
  fwci?: number | null;
  department?: string;
}

interface Paper {
  scopus_id: string;
  doi: string;
  title: string;
  type: string;
  publication_name: string;
  date: string;
  quartile?: string;
  quartile_year?: string;
  quartiles?: Record<string, string>;
  impact_factor_2025?: number | null;
  impact_factor_5year?: number | null;
}

interface FacultyDetailResponse {
  faculty: Faculty;
  papers: Paper[];
}

interface CountryPaper {
  title: string;
  date: string;
  doi: string;
  sdgs?: string;
  subjects?: string;
}

interface CountryStat {
  country: string;
  count: number;
  papers?: CountryPaper[];
}

interface ChartDataPoint {
  year: number;
  documents: number;
  citations: number;
  fwci: number | null;
}

const COUNTRY_PALETTE = [
  '#3679e0','#000347','#e05c36','#36b0e0','#8036e0',
  '#e0b836','#36e08a','#e03667','#36e0d4','#a0a0a0',
  '#e07836','#5436e0','#b8e036','#e03636','#36e054',
];

const FacultyDetailPage: React.FC = () => {
  const { facultyId, scopusId } = useParams<{ facultyId?: string; scopusId?: string }>();
  const id = facultyId || scopusId;
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [facultyData, setFacultyData] = useState<FacultyDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [quartileYear, setQuartileYear] = useState<string>('');
  const [selectedQuartile, setSelectedQuartile] = useState<string | null>(null);
  const [quartileSummaryAllYears, setQuartileSummaryAllYears] = useState<Record<string, {
    q1_count: number; q2_count: number; q3_count: number; q4_count: number;
  }> | null>(null);
  const { getAuthHeaders } = useAuth();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [typeCounts, setTypeCounts] = useState<{
    Journal: number; 'Conference Proceeding': number; Book: number;
  } | null>(null);

  const [countryStats, setCountryStats] = useState<CountryStat[]>([]);
  const countryChartRef = useRef<HTMLDivElement | null>(null);
  const countryChartInstance = useRef<any>(null);

  const [showFwciChart, setShowFwciChart] = useState<boolean>(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // ── Foreign collaboration modal ──────────────────────────────────────────
  const [countryModal, setCountryModal] = useState<{
    open: boolean;
    country: string;
    papers: CountryPaper[];
  }>({ open: false, country: '', papers: [] });

  const openCountryModal = (stat: CountryStat) => {
    setCountryModal({ open: true, country: stat.country, papers: stat.papers || [] });
  };
  const closeCountryModal = () => setCountryModal({ open: false, country: '', papers: [] });

  const searchParams        = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sdgFilter           = searchParams.get("sdg")    || "none";
  const domainFilter        = searchParams.get("domain") || "none";
  const yearFilter          = searchParams.get("year")   || "none";
  const criteriaStartFilter = searchParams.get("start")  || "";
  const criteriaEndFilter   = searchParams.get("end")    || "";

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCountryModal(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = countryModal.open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [countryModal.open]);

  const updateQuery = (key: string) => {
    const queryParams = new URLSearchParams(location.search);
    if (key === "start") {
      queryParams.delete("start");
      queryParams.delete("end");
    } else {
      queryParams.delete(key);
    }
    navigate({ pathname: location.pathname, search: queryParams.toString() });
  };

  const loadScript = useCallback((src: string, timeout = 10000) => new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement('script');
    s.src = src;
    const timer = setTimeout(() => {
      s.remove();
      reject(new Error(`Script load timeout (${timeout}ms): ${src}`));
    }, timeout);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to load script: ${src} (${err})`));
    };
    document.body.appendChild(s);
  }), []);

  useEffect(() => {
    const fetchFacultyDetails = async () => {
      if (!id) { setError('No faculty id provided'); setLoading(false); return; }
      try {
        setLoading(true);
        const headers = getAuthHeaders();
        const response = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/${id}`, {
          params: {
            sdg: sdgFilter !== "none" ? sdgFilter : undefined,
            domain: domainFilter !== "none" ? domainFilter : undefined,
            year: yearFilter !== "none" ? yearFilter : undefined,
            start: criteriaStartFilter || undefined,
            end: criteriaEndFilter || undefined,
            quartileYear: quartileYear || undefined,
          },
          headers,
        });
        setFacultyData(response.data);
        if (!criteriaStartFilter && !criteriaEndFilter) {
          try {
            const quartRes = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/${id}/quartile-summary`, { headers: getAuthHeaders() });
            const summaryData = quartRes.data || {};
            setQuartileSummaryAllYears(summaryData);
            const allYears = Object.keys(summaryData);
            if (!quartileYear && allYears.length > 0) {
              setQuartileYear(allYears.sort((a, b) => Number(b) - Number(a))[0]);
            }
          } catch (e) { setQuartileSummaryAllYears(null); }
        }
      } catch (err) { setError('Failed to fetch faculty details'); }
      finally { setLoading(false); }
    };
    fetchFacultyDetails();
  }, [id, sdgFilter, domainFilter, yearFilter, criteriaStartFilter, criteriaEndFilter, quartileYear]);

  useEffect(() => {
    const fetchTypeCounts = async () => {
      if (!id) return;
      if (criteriaStartFilter && criteriaEndFilter) { setTypeCounts(null); return; }
      try {
        const response = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/${id}/type-count`, {
          params: {
            sdg: sdgFilter !== "none" ? sdgFilter : undefined,
            domain: domainFilter !== "none" ? domainFilter : undefined,
            year: yearFilter !== "none" ? yearFilter : undefined,
          },
          headers: getAuthHeaders(),
        });
        setTypeCounts(response.data);
      } catch (err) { setTypeCounts(null); }
    };
    fetchTypeCounts();
  }, [id, sdgFilter, domainFilter, yearFilter, criteriaStartFilter, criteriaEndFilter]);

  useEffect(() => {
    const fetchCountryStats = async () => {
      if (!id) return;
      try {
        const res = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/${id}/country-stats`, { headers: getAuthHeaders() });
        setCountryStats(res.data || []);
      } catch (err) { setCountryStats([]); }
    };
    fetchCountryStats();
  }, [id]);

  useEffect(() => {
    if (!countryStats.length || !countryChartRef.current) return;
    let cancelled = false;
    const render = () => {
      try {
        console.log('[CountryChart] Attempting to render with', countryStats.length, 'countries, Highcharts available:', !!Highcharts);
        if (!Highcharts) {
          console.error('[CountryChart] Highcharts not available!');
          return;
        }
        if (cancelled || !countryChartRef.current) {
          console.warn('[CountryChart] Cancelled or no ref');
          return;
        }
        // Destroy old chart instance
        if (countryChartInstance.current) {
          try { countryChartInstance.current.destroy(); } catch (_) {}
          countryChartInstance.current = null;
        }
        countryChartRef.current.innerHTML = '';
        const rect = countryChartRef.current.getBoundingClientRect();
        console.log('[CountryChart] Container dimensions:', { width: rect.width, height: rect.height, clientWidth: countryChartRef.current.clientWidth, clientHeight: countryChartRef.current.clientHeight });
        console.log('[CountryChart] Creating chart in container');
        countryChartInstance.current = Highcharts.chart(countryChartRef.current, {
          chart: { type: 'pie', height: 420, style: { fontFamily: 'inherit' } },
          title: { text: 'Foreign Collaboration by Country', style: { fontSize: '16px', fontWeight: '600' } },
          subtitle: { text: 'Based on affiliated countries of international co-authors (excluding India)', style: { color: '#666' } },
          tooltip: { pointFormat: '<b>{point.name}</b><br/>Publications: <b>{point.y}</b><br/>Share: <b>{point.percentage:.1f}%</b>' },
          plotOptions: { pie: { allowPointSelect: true, cursor: 'pointer', borderWidth: 2, borderColor: '#ffffff', innerSize: '38%', dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.y}', style: { fontSize: '11px', fontWeight: '500', textOutline: 'none' }, distance: 18 }, showInLegend: true } },
          legend: { enabled: true, layout: 'horizontal', align: 'center', verticalAlign: 'bottom', maxHeight: 80, itemStyle: { fontSize: '11px', fontWeight: 'normal' } },
          series: [{ name: 'Publications', colorByPoint: true, data: countryStats.map((s, i) => ({ name: s.country, y: s.count, color: COUNTRY_PALETTE[i % COUNTRY_PALETTE.length] })) }],
          credits: { enabled: false }, exporting: { enabled: true },
        });
        console.log('[CountryChart] Chart created successfully');
        console.log('[CountryChart] Container innerHTML length:', countryChartRef.current?.innerHTML.length);
        console.log('[CountryChart] Container has SVG?', !!countryChartRef.current?.querySelector('svg'));
        if (countryChartRef.current?.querySelector('svg')) {
          const svg = countryChartRef.current.querySelector('svg');
          console.log('[CountryChart] SVG dimensions:', { width: svg?.getAttribute('width'), height: svg?.getAttribute('height'), viewBox: svg?.getAttribute('viewBox') });
          console.log('[CountryChart] SVG style:', svg?.getAttribute('style'));
          console.log('[CountryChart] SVG computed visibility:', window.getComputedStyle(svg!).visibility);
          console.log('[CountryChart] SVG computed display:', window.getComputedStyle(svg!).display);
          console.log('[CountryChart] Container computed style:', { display: window.getComputedStyle(countryChartRef.current).display, visibility: window.getComputedStyle(countryChartRef.current).visibility, overflow: window.getComputedStyle(countryChartRef.current).overflow });
          const svgChildren = svg?.querySelectorAll('*').length;
          console.log('[CountryChart] SVG has', svgChildren, 'child elements');
        }
      } catch (err) { console.error('[CountryChart] render error:', err); }
    };
    render();
    return () => { cancelled = true; };
  }, [countryStats]);

  const yearSummary = quartileSummaryAllYears && quartileYear && quartileSummaryAllYears[quartileYear]
    ? quartileSummaryAllYears[quartileYear]
    : { q1_count: 0, q2_count: 0, q3_count: 0, q4_count: 0 };

  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [fullHistory, setFullHistory] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    try { const saved = localStorage.getItem(`faculty_${id}_full_history`); if (saved !== null) setFullHistory(saved === 'true'); } catch (e) {}
  }, [id]);

  useEffect(() => {
    if (!id) return;
    try { localStorage.setItem(`faculty_${id}_full_history`, fullHistory ? 'true' : 'false'); } catch (e) {}
  }, [id, fullHistory]);

  const { user } = useAuth();
  const handleBack = () => { if (user?.accessLevel === 1 || user?.accessLevel === 2) navigate('/faculty'); else navigate('/'); };

  useEffect(() => {
    const renderChart = async () => {
      if (!id) return;
      if (sdgFilter !== 'none' || domainFilter !== 'none' || yearFilter !== 'none' || selectedQuartile || selectedType || criteriaStartFilter || criteriaEndFilter) {
        if (chartRef.current) chartRef.current.innerHTML = ''; return;
      }
      setChartLoading(true); setChartError(null);
      try {
        // Highcharts is already imported at top of file
        let res;
        try { res = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/${id}/author-performance`, fullHistory ? { params: { full: 'true' } } : {}); }
        catch { res = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/author-performance/${id}`, fullHistory ? { params: { full: 'true' } } : {}); }

        const data: ChartDataPoint[] = res.data?.chart_data || [];
        setChartData(data);

        const categories = data.map((r) => r.year);
        const maxLabels = 12;
        const labelStep = categories.length > maxLabels ? Math.ceil(categories.length / maxLabels) : 1;
        if (!Highcharts) { setChartError('Highcharts not available'); return; }
        // Wait for chart container to be available
        for (let i = 0; i < 50; i++) { if (chartRef.current) break; await new Promise(r => setTimeout(r, 50)); }
        if (!chartRef.current) { setChartError('Chart container not available'); return; }
        chartRef.current.innerHTML = '';

        const hasFwci = data.some(r => r.fwci !== null && r.fwci !== undefined);

        const series: any[] = [
          {
            name: 'Documents',
            type: 'column',
            yAxis: 0,
            data: data.map((r) => r.documents),
            color: '#3679e0',
            tooltip: { valueSuffix: ' documents' },
          },
          {
            name: 'Citations',
            type: 'line',
            yAxis: 1,
            data: data.map((r) => r.citations),
            color: '#000347',
            marker: { symbol: 'circle' },
            tooltip: { valueSuffix: ' citations' },
          },
        ];

        const yAxis: any[] = [
          { title: { text: 'Documents' }, labels: { style: { color: '#3679e0' } } },
          { title: { text: 'Citations' }, labels: { style: { color: '#000347' } }, opposite: true },
        ];

        if (showFwciChart && hasFwci) {
          yAxis.push({
            title: { text: 'FWCI', style: { color: '#e05c36' } },
            labels: { style: { color: '#e05c36' }, format: '{value:.2f}' },
            opposite: true,
            offset: 40,
          });
          series.push({
            name: 'FWCI',
            type: 'line',
            yAxis: 2,
            data: data.map((r) => r.fwci !== null && r.fwci !== undefined ? parseFloat(r.fwci.toFixed(4)) : null),
            color: '#e05c36',
            dashStyle: 'ShortDash',
            marker: { symbol: 'diamond', radius: 5 },
            tooltip: { valueSuffix: '', valueDecimals: 2 },
            connectNulls: true,
          });
        }

        Highcharts.chart(chartRef.current, {
          chart: { zoomType: 'xy' },
          title: { text: `Document and Citation Trends${fullHistory ? ' (Full history)' : ''}` },
          xAxis: {
            categories,
            crosshair: true,
            labels: { rotation: categories.length > maxLabels ? -45 : 0, step: labelStep },
            tickInterval: labelStep,
          },
          yAxis,
          tooltip: { shared: true, useHTML: true, headerFormat: '<b>Year: {point.key}</b><br>' },
          series,
          credits: { enabled: false },
          exporting: { enabled: true },
          accessibility: { enabled: false },
        });

        setIframeLoaded(true);
      } catch (err: any) { setChartError(err.message || 'Failed to load chart'); }
      finally { setChartLoading(false); }
    };
    renderChart();
  }, [id, sdgFilter, domainFilter, yearFilter, selectedQuartile, selectedType, criteriaStartFilter, criteriaEndFilter, fullHistory]);

  // ════════════════════════════════════════════════════════════════════════
  // PDF REPORT
  // ════════════════════════════════════════════════════════════════════════
  const generatePDF = async () => {
    if (!facultyData) { alert('No data to generate PDF'); return; }

    const { faculty, papers } = facultyData;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const ML = 15;
    const MR = 15;
    const MT = 15;
    const MB = 18;
    const cW = pageW - ML - MR;
    const HEADER_H = 14;
    const FOOTER_H = 10;
    const CONTENT_TOP = HEADER_H + 4;
    const CONTENT_BTM = pageH - FOOTER_H - 4;

    let y = 0;
    let pageNum = 0;

    const C = {
      navy:   [12, 35, 80]   as [number,number,number],
      blue:   [30, 90, 180]  as [number,number,number],
      teal:   [0, 115, 115]  as [number,number,number],
      green:  [25, 110, 55]  as [number,number,number],
      orange: [190, 100, 10] as [number,number,number],
      red:    [170, 40, 40]  as [number,number,number],
      purple: [90, 40, 160]  as [number,number,number],
      gold:   [155, 120, 0]  as [number,number,number],
      dark:   [25, 25, 45]   as [number,number,number],
      mid:    [90, 95, 115]  as [number,number,number],
      lgray:  [180, 185, 200]as [number,number,number],
      silver: [245, 246, 250]as [number,number,number],
      ice:    [232, 238, 252]as [number,number,number],
      white:  [255, 255, 255]as [number,number,number],
      rule:   [210, 215, 228]as [number,number,number],
      fwci:   [224, 92, 54]  as [number,number,number],
    };

    const QC: Record<string, [number,number,number]> = {
      Q1: C.green, Q2: C.blue, Q3: C.orange, Q4: C.red,
    };

    const clean = (v: any, fallback = 'N/A'): string => {
      if (v == null || v === '') return fallback;
      return String(v).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').trim() || fallback;
    };

    const truncate = (text: string, maxWidth: number): string => {
      if (doc.getTextWidth(text) <= maxWidth) return text;
      let t = text;
      while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) t = t.slice(0, -1);
      return t + '…';
    };

    const needPage = (need: number) => {
      if (y + need > CONTENT_BTM) {
        drawFooter();
        doc.addPage();
        pageNum++;
        drawSubheader();
        y = CONTENT_TOP + 4;
      }
    };

    const drawFooter = () => {
      const pg = (doc.internal as any).getCurrentPageInfo().pageNumber;
      doc.setFillColor(...C.navy);
      doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.lgray);
      doc.text('SRM Institute of Science and Technology  —  Faculty Research Report  —  Confidential', ML, pageH - 3.8);
      doc.text(`Page ${pg}`, pageW - MR, pageH - 3.8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    const facultyName = clean(faculty.name);
    const drawSubheader = () => {
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, pageW, HEADER_H, 'F');
      doc.setFillColor(...C.blue);
      doc.rect(0, HEADER_H, pageW, 0.8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(truncate(facultyName, 100), ML, 9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.lgray);
      doc.text('Faculty Research Report', pageW - MR, 9, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    const sectionHead = (title: string, accent: [number,number,number] = C.navy) => {
      needPage(14);
      doc.setFillColor(...C.ice);
      doc.rect(ML, y, cW, 9, 'F');
      doc.setFillColor(...accent);
      doc.rect(ML, y, 3, 9, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(title, ML + 7, y + 6.2);
      y += 12;
      doc.setTextColor(0, 0, 0);
    };

    const hRule = (color = C.rule) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + cW, y);
      doc.setDrawColor(0, 0, 0);
      y += 3;
    };

    const infoRow = (label: string, value: string, labelW = 42) => {
      needPage(7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.mid);
      doc.text(truncate(label, labelW - 2), ML, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.dark);
      const valX = ML + labelW;
      const valW = cW - labelW;
      const lines = doc.splitTextToSize(clean(value), valW);
      const maxLines = 2;
      lines.slice(0, maxLines).forEach((line: string, i: number) => {
        doc.text(line, valX, y + i * 4.5);
      });
      y += Math.min(lines.length, maxLines) * 4.5 + 2;
      doc.setTextColor(0, 0, 0);
    };

    const metricCard = (
      bx: number, by: number, bw: number, bh: number,
      val: string, lbl: string,
      bg: [number,number,number]
    ) => {
      doc.setFillColor(...bg);
      doc.roundedRect(bx, by, bw, bh, 2, 2, 'F');
      doc.setFillColor(Math.min(bg[0]+25,255), Math.min(bg[1]+25,255), Math.min(bg[2]+25,255));
      doc.roundedRect(bx, by, bw, bh * 0.35, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(truncate(val, bw - 4), bx + bw / 2, by + bh * 0.52, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(230, 235, 255);
      doc.text(truncate(lbl.toUpperCase(), bw - 4), bx + bw / 2, by + bh * 0.80, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    };

    const progressBar = (bx: number, by: number, bw: number, bh: number, pct: number, color: [number,number,number]) => {
      doc.setFillColor(...C.rule);
      doc.roundedRect(bx, by, bw, bh, 1, 1, 'F');
      if (pct > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(bx, by, Math.max(bw * Math.min(pct, 1), 1), bh, 1, 1, 'F');
      }
    };

    const pill = (px: number, py: number, text: string, bg: [number,number,number], maxW = 40) => {
      const label = truncate(text, maxW - 4);
      const tw = doc.getTextWidth(label);
      const pw = tw + 5;
      doc.setFillColor(...bg);
      doc.roundedRect(px, py - 3.5, pw, 5.5, 1.5, 1.5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(label, px + 2.5, py + 0.5);
      doc.setTextColor(0, 0, 0);
      return pw + 2;
    };

    // ── COVER PAGE ────────────────────────────────────────────────────────
    pageNum = 1;
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFillColor(...C.blue);
    doc.rect(0, 0, pageW, 3, 'F');
    doc.setFillColor(20, 55, 130);
    doc.rect(pageW - 55, 0, 55, 55, 'F');
    doc.setFillColor(...C.blue);
    doc.rect(pageW - 55, 0, 3, 55, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.lgray);
    doc.text('SRM INSTITUTE OF SCIENCE AND TECHNOLOGY', pageW / 2, 22, { align: 'center' });
    doc.setDrawColor(...C.blue);
    doc.setLineWidth(0.5);
    doc.line(ML + 20, 25, pageW - MR - 20, 25);

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text('FACULTY RESEARCH', pageW / 2, 38, { align: 'center' });
    doc.setTextColor(140, 175, 240);
    doc.text('PERFORMANCE REPORT', pageW / 2, 50, { align: 'center' });

    const nameBoxY = 62;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ML, nameBoxY, cW, 20, 3, 3, 'F');
    doc.setFillColor(...C.blue);
    doc.roundedRect(ML, nameBoxY, 4, 20, 2, 2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(ML + 2.5, nameBoxY, 2.5, 20, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text(truncate(facultyName, cW - 16), ML + 10, nameBoxY + 8);
    if (faculty.department) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.mid);
      doc.text(truncate(clean(faculty.department), cW - 16), ML + 10, nameBoxY + 15);
    }

    const cY = nameBoxY + 26;
    const cCardW = (cW - 9) / 4;
    const cCardH = 26;
    metricCard(ML,                      cY, cCardW, cCardH, String(faculty.docs_count || 0),     'Total Documents', C.blue);
    metricCard(ML + (cCardW + 3),       cY, cCardW, cCardH, String(faculty.citation_count || 0), 'Total Citations',  C.teal);
    metricCard(ML + (cCardW + 3) * 2,  cY, cCardW, cCardH, String(faculty.h_index ?? 'N/A'),    'H-Index',          C.purple);
    metricCard(ML + (cCardW + 3) * 3,  cY, cCardW, cCardH,
      faculty.fwci !== null && faculty.fwci !== undefined ? faculty.fwci.toFixed(2) : 'N/A',
      'FWCI', C.fwci);

    const detY = cY + cCardH + 8;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ML, detY, cW, 38, 3, 3, 'F');
    const detItems = [
      { label: 'Faculty ID',   value: faculty.faculty_id ? clean(faculty.faculty_id) : 'N/A' },
      { label: 'Department',   value: faculty.department ? clean(faculty.department)  : 'N/A' },
      { label: 'Scopus ID(s)', value: faculty.scopus_ids?.length ? faculty.scopus_ids.join(', ') : clean(faculty.scopus_id) },
      { label: 'Report Date',  value: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) },
    ];
    detItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = ML + 6 + col * (cW / 2);
      const iy = detY + 8 + row * 14;
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.mid);
      doc.text(item.label.toUpperCase(), ix, iy);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.dark);
      doc.text(truncate(item.value, cW / 2 - 10), ix, iy + 5.5);
    });

    const af: string[] = [];
    if (sdgFilter !== 'none') af.push(`SDG: ${sdgFilter}`);
    if (domainFilter !== 'none') af.push(`Domain: ${domainFilter}`);
    if (yearFilter !== 'none') af.push(`Year: ${yearFilter}`);
    if (criteriaStartFilter && criteriaEndFilter) af.push(`Period: ${criteriaStartFilter} – ${criteriaEndFilter}`);
    if (af.length > 0) {
      const filterY = detY + 46;
      doc.setFillColor(255, 248, 220);
      doc.roundedRect(ML, filterY, cW, 9, 2, 2, 'F');
      doc.setDrawColor(200, 160, 0); doc.setLineWidth(0.3);
      doc.roundedRect(ML, filterY, cW, 9, 2, 2, 'S');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 65, 0);
      doc.text('ACTIVE FILTERS: ' + truncate(af.join('  |  '), cW - 10), ML + 4, filterY + 6);
      doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.lgray);
    doc.text('This report is confidential and intended for internal use only.', pageW / 2, pageH - 22, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW / 2, pageH - 17, { align: 'center' });
    drawFooter();

    // ── CONTENT PAGES ─────────────────────────────────────────────────────
    doc.addPage();
    pageNum++;
    drawSubheader();
    y = CONTENT_TOP + 4;

    // ── 1. FACULTY PROFILE ────────────────────────────────────────────────
    sectionHead('1.  FACULTY PROFILE', C.navy);
    const scopusDisplay = faculty.scopus_ids?.length ? faculty.scopus_ids.join(', ') : clean(faculty.scopus_id);
    infoRow('Full Name',    facultyName);
    infoRow('Faculty ID',   faculty.faculty_id ? clean(faculty.faculty_id) : 'N/A');
    infoRow('Department',   faculty.department ? clean(faculty.department)  : 'N/A');
    infoRow('Scopus ID(s)', scopusDisplay);
    needPage(7);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.blue);
    doc.text(truncate(`https://www.scopus.com/authid/detail.uri?authorId=${faculty.scopus_ids?.[0] || faculty.scopus_id}`, cW - 4), ML, y);
    y += 8;
    doc.setTextColor(0, 0, 0);

    // ── 2. PUBLICATION METRICS ────────────────────────────────────────────
    sectionHead('2.  PUBLICATION METRICS', C.teal);
    needPage(36);

    const pmW = (cW - 9) / 4;
    const pmH = 24;
    metricCard(ML,                     y, pmW, pmH, String(faculty.docs_count || 0),     'Total Documents', C.navy);
    metricCard(ML + (pmW + 3),         y, pmW, pmH, String(faculty.citation_count || 0), 'Total Citations',  C.blue);
    metricCard(ML + (pmW + 3) * 2,    y, pmW, pmH, String(faculty.h_index ?? 'N/A'),    'H-Index',          C.purple);
    metricCard(ML + (pmW + 3) * 3,    y, pmW, pmH,
      faculty.fwci !== null && faculty.fwci !== undefined ? faculty.fwci.toFixed(2) : 'N/A',
      'FWCI', C.fwci);
    y += pmH + 6;

    // ── FWCI per-year table (if chart data available) ─────────────────────
    const fwciYearData = chartData.filter(r => r.fwci !== null && r.fwci !== undefined);
    if (fwciYearData.length > 0) {
      sectionHead('3.  FWCI BY YEAR', C.fwci);
      needPage(10);

      doc.setFillColor(...C.navy);
      doc.rect(ML, y, cW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text('Year',       ML + 6,       y + 5);
      doc.text('Documents',  ML + 50,      y + 5, { align: 'right' });
      doc.text('Citations',  ML + 95,      y + 5, { align: 'right' });
      doc.text('FWCI',       ML + cW - 4,  y + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 7;

      const maxFwci = Math.max(...fwciYearData.map(r => r.fwci as number));

      fwciYearData.forEach((row, ri) => {
        needPage(8);
        const bg: [number,number,number] = ri % 2 === 0 ? C.silver : C.white;
        doc.setFillColor(...bg);
        doc.rect(ML, y, cW, 7.5, 'F');

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
        doc.text(String(row.year), ML + 6, y + 5);

        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.dark);
        doc.text(String(row.documents), ML + 50, y + 5, { align: 'right' });
        doc.text(String(row.citations), ML + 95, y + 5, { align: 'right' });

        const fv = row.fwci as number;
        const fwciColor: [number,number,number] = fv >= 1 ? C.green : C.red;
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...fwciColor);
        doc.text(fv.toFixed(2), ML + cW - 4, y + 5, { align: 'right' });

        const barMaxW = 35;
        const barW = maxFwci > 0 ? (fv / maxFwci) * barMaxW : 0;
        doc.setFillColor(...C.fwci);
        doc.roundedRect(ML + 100, y + 2, Math.max(barW, 1), 3.5, 1, 1, 'F');

        doc.setTextColor(0, 0, 0);
        y += 7.5;
      });
      y += 5;
    }

    // ── PUBLICATION TYPE BREAKDOWN ─────────────────────────────────────────
    const pubTypeSectionNum = fwciYearData.length > 0 ? '4' : '3';
    if (typeCounts) {
      sectionHead(`${pubTypeSectionNum}.  PUBLICATION TYPE BREAKDOWN`, C.blue);
      const total = typeCounts.Journal + typeCounts['Conference Proceeding'] + typeCounts.Book;
      const typeRows = [
        { label: 'Journal Articles',       count: typeCounts.Journal,                 color: C.blue,   pct: total > 0 ? typeCounts.Journal / total : 0 },
        { label: 'Conference Proceedings', count: typeCounts['Conference Proceeding'], color: C.purple, pct: total > 0 ? typeCounts['Conference Proceeding'] / total : 0 },
        { label: 'Books / Book Chapters',  count: typeCounts.Book,                    color: C.gold,   pct: total > 0 ? typeCounts.Book / total : 0 },
      ];
      needPage(8);
      doc.setFillColor(...C.navy);
      doc.rect(ML, y, cW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text('Publication Type', ML + 5, y + 5);
      doc.text('Count', ML + 110, y + 5, { align: 'right' });
      doc.text('Share (%)', ML + 138, y + 5, { align: 'right' });
      doc.text('Distribution', ML + cW - 5, y + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 7;
      typeRows.forEach((t, i) => {
        needPage(8);
        const bg: [number,number,number] = i % 2 === 0 ? C.silver : C.white;
        doc.setFillColor(...bg);
        doc.rect(ML, y, cW, 7.5, 'F');
        doc.setFillColor(...t.color);
        doc.circle(ML + 4, y + 3.8, 2, 'F');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.dark);
        doc.text(truncate(t.label, 95), ML + 9, y + 5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
        doc.text(String(t.count), ML + 110, y + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.mid);
        doc.text(`${(t.pct * 100).toFixed(1)}%`, ML + 138, y + 5, { align: 'right' });
        progressBar(ML + 143, y + 2, 30, 3.5, t.pct, t.color);
        doc.setTextColor(0, 0, 0);
        y += 7.5;
      });
      needPage(8);
      doc.setFillColor(...C.ice);
      doc.rect(ML, y, cW, 7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
      doc.text('Total', ML + 9, y + 5);
      doc.text(String(total), ML + 110, y + 5, { align: 'right' });
      doc.text('100.0%', ML + 138, y + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // ── QUARTILE SUMMARY ───────────────────────────────────────────────────
    const quartileSectionNum = fwciYearData.length > 0
      ? (typeCounts ? '5' : '4')
      : (typeCounts ? '4' : '3');
    if (quartileSummaryAllYears && Object.keys(quartileSummaryAllYears).length > 0) {
      sectionHead(`${quartileSectionNum}.  JOURNAL QUARTILE SUMMARY`, C.green);
      const years = Object.keys(quartileSummaryAllYears).sort((a, b) => Number(b) - Number(a));
      needPage(8);
      doc.setFillColor(...C.navy);
      doc.rect(ML, y, cW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      const qCols = [
        { label: 'Year', x: ML + 6 },
        { label: 'Q1', x: ML + 44, align: 'center' as const },
        { label: 'Q2', x: ML + 76, align: 'center' as const },
        { label: 'Q3', x: ML + 108, align: 'center' as const },
        { label: 'Q4', x: ML + 140, align: 'center' as const },
        { label: 'Total', x: ML + cW - 4, align: 'right' as const },
      ];
      qCols.forEach(c => doc.text(c.label, c.x, y + 5, { align: c.align || 'left' }));
      doc.setTextColor(0, 0, 0);
      y += 7;
      years.forEach((yr, ri) => {
        needPage(8);
        const s = quartileSummaryAllYears[yr];
        const tot = s.q1_count + s.q2_count + s.q3_count + s.q4_count;
        const bg: [number,number,number] = ri % 2 === 0 ? C.silver : C.white;
        doc.setFillColor(...bg);
        doc.rect(ML, y, cW, 7.5, 'F');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
        doc.text(yr, ML + 6, y + 5);
        const qData = [
          { v: s.q1_count, c: C.green,  x: ML + 44 },
          { v: s.q2_count, c: C.blue,   x: ML + 76 },
          { v: s.q3_count, c: C.orange, x: ML + 108 },
          { v: s.q4_count, c: C.red,    x: ML + 140 },
        ];
        qData.forEach(q => {
          if (q.v > 0) {
            doc.setFillColor(...q.c);
            doc.roundedRect(q.x - 7, y + 0.8, 14, 6, 2, 2, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
            doc.text(String(q.v), q.x, y + 5, { align: 'center' });
          } else {
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.lgray);
            doc.text('—', q.x, y + 5, { align: 'center' });
          }
        });
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
        doc.text(String(tot), ML + cW - 4, y + 5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 7.5;
      });
      y += 5;
    }

    // ── PUBLICATIONS LIST ──────────────────────────────────────────────────
    const pubSectionNum = String(
      (fwciYearData.length > 0 ? 1 : 0) +
      (typeCounts ? 1 : 0) +
      (quartileSummaryAllYears && Object.keys(quartileSummaryAllYears).length > 0 ? 1 : 0) + 3
    );
    sectionHead(`${pubSectionNum}.  PUBLICATIONS  (${papers.length} records)`, C.navy);

    if (papers.length === 0) {
      needPage(12);
      doc.setFillColor(...C.silver);
      doc.rect(ML, y, cW, 10, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.mid);
      doc.text('No publications found for the current filter criteria.', ML + 5, y + 6.5);
      y += 14; doc.setTextColor(0, 0, 0);
    }

    papers.forEach((paper, idx) => {
      const isJrnl = paper.type?.toLowerCase().includes('journal');
      const hasIF  = isJrnl && (paper.impact_factor_2025 || paper.impact_factor_5year);
      const qtE    = Object.entries(paper.quartiles || {}).filter(([, q]) => q && String(q).trim() !== '-');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      const titleLines: string[] = doc.splitTextToSize(clean(paper.title), cW - 14).slice(0, 3);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
      const pubLines: string[] = doc.splitTextToSize(clean(paper.publication_name), cW - 14).slice(0, 2);
      const rowH = 4 + titleLines.length * 4.8 + 2 + pubLines.length * 4.2 + 5 + (hasIF ? 6 : 0) + (qtE.length > 0 ? 6 : 0) + 4;
      needPage(rowH);
      const rowBg: [number,number,number] = idx % 2 === 0 ? C.white : C.silver;
      doc.setFillColor(...rowBg);
      doc.rect(ML, y, cW, rowH, 'F');
      const accentC: [number,number,number] = isJrnl ? C.blue : paper.type?.toLowerCase().includes('conference') ? C.purple : C.gold;
      doc.setFillColor(...accentC);
      doc.rect(ML, y, 3, rowH, 'F');
      const badgeY = y + 4;
      doc.setFillColor(...C.navy);
      doc.circle(ML + 9, badgeY + 2, 3.5, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(String(idx + 1), ML + 9, badgeY + 3.8, { align: 'center' });
      let ry = y + 4;
      const tx = ML + 16;
      const tw = cW - 18;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
      titleLines.forEach((line: string) => { doc.text(line, tx, ry + 3.5); ry += 4.8; });
      ry += 1;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.teal);
      pubLines.forEach((line: string) => { doc.text(line, tx, ry); ry += 4.2; });
      const dateStr = paper.date ? new Date(paper.date).toLocaleDateString('en-IN') : 'N/A';
      const doiStr  = paper.doi ? truncate(paper.doi, 70) : 'N/A';
      const metaStr = `${truncate(clean(paper.type), 40)}  ·  ${dateStr}  ·  DOI: ${doiStr}`;
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.mid);
      doc.text(truncate(metaStr, tw), tx, ry + 1);
      ry += 5;
      if (hasIF) {
        const ifParts: string[] = [];
        if (paper.impact_factor_2025) ifParts.push(`IF 2025: ${parseFloat(String(paper.impact_factor_2025)).toFixed(3)}`);
        if (paper.impact_factor_5year) ifParts.push(`5-Year IF: ${parseFloat(String(paper.impact_factor_5year)).toFixed(3)}`);
        let qx = tx;
        ifParts.forEach(part => { qx += pill(qx, ry, part, C.green, 50) + 1; });
        ry += 6;
      }
      if (qtE.length > 0) {
        let qx = tx;
        const maxQX = ML + cW - 4;
        qtE.forEach(([yr, q]) => {
          const qs = String(q).trim().toUpperCase();
          const qc = QC[qs] || C.navy;
          const lbl = `${qs} ${yr}`;
          const estW = doc.getTextWidth(lbl) + 9;
          if (qx + estW > maxQX) return;
          qx += pill(qx, ry, lbl, qc, 36) + 1;
        });
        ry += 6;
      }
      doc.setTextColor(0, 0, 0);
      y += rowH;
    });
    y += 4;

    // ── INTERNATIONAL COLLABORATION ────────────────────────────────────────
    const collabSectionNum = String(parseInt(pubSectionNum) + 1);
    sectionHead(`${collabSectionNum}.  INTERNATIONAL COLLABORATION`, C.teal);
    if (countryStats.length === 0) {
      needPage(12);
      doc.setFillColor(...C.silver);
      doc.rect(ML, y, cW, 10, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.mid);
      doc.text('No international collaboration data recorded for this faculty member.', ML + 5, y + 6.5);
      y += 14; doc.setTextColor(0, 0, 0);
    } else {
      const totC = countryStats.reduce((s, c) => s + c.count, 0);
      needPage(30);
      const hw = (cW - 4) / 2;
      metricCard(ML,          y, hw, 22, String(totC),                "Int'l Publications",     C.teal);
      metricCard(ML + hw + 4, y, hw, 22, String(countryStats.length), 'Collaborating Countries', C.navy);
      y += 28;
      needPage(8);
      doc.setFillColor(...C.navy);
      doc.rect(ML, y, cW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text('Rank', ML + 5, y + 5);
      doc.text('Country', ML + 20, y + 5);
      doc.text('Pubs', ML + 120, y + 5, { align: 'right' });
      doc.text('Paper Numbers', ML + 128, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 7;
      countryStats.forEach((stat, i) => {
        const paperNums = (stat.papers || [])
          .map(cp => {
            const idx = papers.findIndex((p: any) => p.doi === cp.doi);
            return idx >= 0 ? `#${idx + 1}` : null;
          })
          .filter(Boolean)
          .join(', ');
        doc.setFontSize(7.5);
        const paperNumLines = paperNums
          ? doc.splitTextToSize(paperNums, cW - 135)
          : [];
        const rowH = Math.max(7.5, 4 + paperNumLines.length * 4.5 + 2);
        needPage(rowH + 2);
        const rowBg: [number,number,number] = i % 2 === 0 ? C.silver : C.white;
        doc.setFillColor(...rowBg);
        doc.rect(ML, y, cW, rowH, 'F');
        const hex = COUNTRY_PALETTE[i % COUNTRY_PALETTE.length];
        const rgb = parseInt(hex.slice(1), 16);
        const dotC: [number,number,number] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
        doc.setFillColor(...dotC);
        doc.circle(ML + 5, y + rowH / 2, 2, 'F');
        const midY = y + rowH / 2 + 1.5;
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.mid);
        doc.text(String(i + 1), ML + 14, midY, { align: 'right' });
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dark);
        doc.text(truncate(String(stat.country), 80), ML + 20, midY);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
        doc.text(String(stat.count), ML + 120, midY, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.teal);
        if (paperNumLines.length > 0) {
          paperNumLines.forEach((line: string, li: number) => {
            doc.text(line, ML + 128, y + 5 + li * 4.5);
          });
        } else {
          doc.setTextColor(...C.lgray);
          doc.text('—', ML + 128, midY);
        }
        doc.setTextColor(0, 0, 0);
        y += rowH;
      });
      y += 5;
    }

    // ── Stamp all footers ─────────────────────────────────────────────────
    drawFooter();
    const totalPgs = (doc.internal as any).getNumberOfPages();
    for (let p = 2; p <= totalPgs; p++) {
      doc.setPage(p);
      drawSubheader();
      doc.setFillColor(...C.navy);
      doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.lgray);
      doc.text('SRM Institute of Science and Technology  —  Faculty Research Report  —  Confidential', ML, pageH - 3.8);
      doc.text(`Page ${p} of ${totalPgs}`, pageW - MR, pageH - 3.8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }
    doc.setPage(1);
    doc.setFillColor(...C.navy);
    doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.lgray);
    doc.text('SRM Institute of Science and Technology  —  Faculty Research Report  —  Confidential', ML, pageH - 3.8);
    doc.text(`Page 1 of ${totalPgs}`, pageW - MR, pageH - 3.8, { align: 'right' });

    doc.save(`${facultyName.replace(/[^a-zA-Z0-9]/g, '_')}_Research_Report.pdf`);
  };

  // ── Guard renders ──────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading faculty details...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!facultyData) return <div className="no-records">No data found for this faculty member.</div>;

  const { faculty, papers: unsortedPapers } = facultyData;
  const allPapers = [...unsortedPapers].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  const filteredPapers = allPapers.filter(p => {
    if (selectedQuartile) { if (!(p.quartiles?.[quartileYear] && p.quartiles[quartileYear].toUpperCase() === selectedQuartile)) return false; }
    if (selectedType) return p.type === selectedType;
    return true;
  });
  const isCriteriaFilterActive = !!(criteriaStartFilter && criteriaEndFilter);
  const hasFwciData = chartData.some(r => r.fwci !== null && r.fwci !== undefined);

  return (
    <div className="faculty-detail-page-wrapper">
      <div className="shared-navbar">
        <a className="shared-logo"><img src={srmLogo} alt="SRM Logo" className="shared-nav-logo" /><span>SRM SP</span></a>
        <UserMenu />
      </div>

      <div className="faculty-detail-container">
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
          <button onClick={handleBack} className="shared-back-button">&laquo; Back</button>
        </div>

        <div className="faculty-card">
          <div className="faculty-card-layout">
            <div className="faculty-info">
              {(selectedQuartile || selectedType) && (
                <div className="filter-badges"><strong>Active Filters: </strong>
                  {selectedQuartile && <span className="filter-chip">Quartile: {selectedQuartile} <button onClick={() => setSelectedQuartile(null)}>❌</button></span>}
                  {selectedType && <span className="filter-chip">Type: {selectedType === 'Conference Proceeding' ? 'Conference' : selectedType} <button onClick={() => setSelectedType(null)}>❌</button></span>}
                </div>
              )}
              <h2 className="faculty-name">{facultyData.faculty.name}</h2>
              <p><strong>Scopus ID(s):</strong> {facultyData.faculty.scopus_ids?.length ? facultyData.faculty.scopus_ids.join(', ') : facultyData.faculty.scopus_id || 'N/A'}</p>
              {facultyData.faculty.faculty_id && <p><strong>Faculty ID:</strong> {facultyData.faculty.faculty_id}</p>}
              {facultyData.faculty.department && <p><strong>Department:</strong> {facultyData.faculty.department}</p>}
              {facultyData.faculty.department === 'C.Tech' && facultyData.faculty.domain && <p><strong>Domain:</strong> {facultyData.faculty.domain}</p>}
              <p><strong>Documents Published:</strong> {facultyData.faculty.docs_count}</p>
              <p><strong>Citations:</strong> {facultyData.faculty.citation_count}</p>
              <p><strong>H-Index:</strong> {facultyData.faculty.h_index ?? 'N/A'}</p>
              <p><strong>FWCI:</strong> {facultyData.faculty.fwci !== null && facultyData.faculty.fwci !== undefined ? facultyData.faculty.fwci.toFixed(2) : 'N/A'}</p>

              <div className="filter-badges"><strong>Filters Applied: </strong>
                {sdgFilter === 'none' && domainFilter === 'none' && yearFilter === 'none' && !isCriteriaFilterActive
                  ? <span className="filter-chip">NA</span>
                  : <>
                    {sdgFilter !== 'none' && <span className="filter-chip">SDG: {sdgFilter} <button onClick={() => updateQuery('sdg')}>❌</button></span>}
                    {domainFilter !== 'none' && <span className="filter-chip">Domain: {domainFilter} <button onClick={() => updateQuery('domain')}>❌</button></span>}
                    {yearFilter !== 'none' && <span className="filter-chip">Year: {yearFilter} <button onClick={() => updateQuery('year')}>❌</button></span>}
                    {isCriteriaFilterActive && <span className="filter-chip">Date Range: {criteriaStartFilter} to {criteriaEndFilter} <button onClick={() => updateQuery('start')}>❌</button></span>}
                  </>
                }
              </div>
              <div className="faculty-bottom">
                <a href={`https://www.scopus.com/authid/detail.uri?authorId=${facultyData.faculty.scopus_ids?.[0] || facultyData.faculty.scopus_id}`} target="_blank" rel="noopener noreferrer" className="scopus-link-button">View on Scopus</a>
              </div>
              <div className="faculty-actions">
                <button onClick={generatePDF} className="generate-pdf-button">📄 Generate Report</button>
              </div>
            </div>

            <div className="quartile-summary-section">
              {quartileSummaryAllYears && quartileSummaryAllYears[quartileYear] && !isCriteriaFilterActive && sdgFilter === 'none' && domainFilter === 'none' && yearFilter === 'none' && (
                <div className="quartile-summary-table">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h4>Quartile Summary for {quartileYear}</h4>
                    <select value={quartileYear} onChange={e => setQuartileYear(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                      {Object.keys(quartileSummaryAllYears).sort((a, b) => Number(b) - Number(a)).map(yr => <option key={yr} value={yr}>{yr}</option>)}
                    </select>
                  </div>
                  <table><tbody>
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                      <tr key={q} className={`${q.toLowerCase()} ${selectedQuartile === q ? 'selected' : ''}`} onClick={() => setSelectedQuartile(selectedQuartile === q ? null : q)}>
                        <td>{q}</td><td>{yearSummary[`${q.toLowerCase()}_count` as keyof typeof yearSummary]}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
              {typeCounts && !isCriteriaFilterActive && sdgFilter === 'none' && domainFilter === 'none' && yearFilter === 'none' && (
                <div className="type-summary-table">
                  <h4>Publication Types</h4>
                  <table><tbody>
                    <tr className={`type-row journal ${selectedType === 'Journal' ? 'selected' : ''}`} onClick={() => setSelectedType(selectedType === 'Journal' ? null : 'Journal')}>
                      <td><span className="type-icon">📄</span>Journal</td><td>{typeCounts.Journal}</td>
                    </tr>
                    <tr className={`type-row conference ${selectedType === 'Conference Proceeding' ? 'selected' : ''}`} onClick={() => setSelectedType(selectedType === 'Conference Proceeding' ? null : 'Conference Proceeding')}>
                      <td><span className="type-icon">📋</span>Conference</td><td>{typeCounts['Conference Proceeding']}</td>
                    </tr>
                    <tr className={`type-row book ${selectedType === 'Book' ? 'selected' : ''}`} onClick={() => setSelectedType(selectedType === 'Book' ? null : 'Book')}>
                      <td><span className="type-icon">📚</span>Book</td><td>{typeCounts.Book}</td>
                    </tr>
                  </tbody></table>
                </div>
              )}
            </div>
          </div>
        </div>

        <h3 className="publications-title">Publications</h3>
        {filteredPapers.length > 0 ? (
          filteredPapers.map((paper, index) => (
            <Link to={`/paper/${encodeURIComponent(paper.doi)}`} key={paper.doi || `paper-${index}`} className="publication-card-link">
              <div className="publication-card">
                <div className="publication-left">
                  <h4>{paper.title}</h4>
                  <p><strong>DOI:</strong> {paper.doi || 'N/A'}</p>
                  <p><strong>Type:</strong> {paper.type || 'N/A'}</p>
                  <p><strong>Publication:</strong> {paper.publication_name || 'N/A'}</p>
                  <p><strong>Date:</strong> {paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A'}</p>
                  {paper.domain && <p><strong>Domain:</strong> {paper.domain}</p>}
                </div>
                {paper.quartiles && paper.type?.toLowerCase().includes("journal") && !isCriteriaFilterActive && (
                  <div className="quartile-badge-container">
                    {selectedQuartile
                      ? (() => { const q = paper.quartiles?.[quartileYear]; return q && q.trim() !== "-" && q.toUpperCase() === selectedQuartile ? <div className={`quartile-badge ${q.toLowerCase()}`}><span className="quartile-text">{q.toUpperCase()} {quartileYear}</span><i className="badge-icon">★</i></div> : null; })()
                      : Object.entries(paper.quartiles).map(([yr, quartile]) => quartile && quartile.trim() !== "-" ? <div key={`${paper.doi}-${yr}`} className={`quartile-badge ${quartile.toLowerCase()}`}><span className="quartile-text">{quartile.toUpperCase()} {yr}</span><i className="badge-icon">★</i></div> : null)
                    }
                  </div>
                )}
                {paper.type?.toLowerCase().includes("journal") && (paper.impact_factor_2025 || paper.impact_factor_5year) && (
                  <div className="impact-factor-container">
                    {paper.impact_factor_2025 && <div className="impact-factor-badge"><span className="impact-factor-label">IF 2025:</span><span className="impact-factor-value">{(parseFloat(paper.impact_factor_2025 as any) || 0).toFixed(1)}</span></div>}
                    {paper.impact_factor_5year && <div className="impact-factor-badge"><span className="impact-factor-label">5-Yr IF:</span><span className="impact-factor-value">{(parseFloat(paper.impact_factor_5year as any) || 0).toFixed(1)}</span></div>}
                  </div>
                )}
              </div>
            </Link>
          ))
        ) : <div className="no-records">No publications found for this faculty member.</div>}

        {!isCriteriaFilterActive && sdgFilter === 'none' && domainFilter === 'none' && yearFilter === 'none' && !selectedQuartile && !selectedType && (
          <>
            <h3 className="publications-title">Interactive Scopus Dashboard</h3>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '12px', marginBottom: '10px',
            }}>
              <label className="full-history-toggle" role="switch" aria-checked={fullHistory}>
                <div className="switch">
                  <input className="switch-input" type="checkbox" checked={fullHistory} onChange={e => setFullHistory(e.target.checked)} />
                  <span className="slider" aria-hidden="true"></span>
                </div>
                <span className="switch-label">Show full history</span>
              </label>

              <button
                onClick={() => setShowFwciChart(prev => !prev)}
                disabled={!hasFwciData}
                title={!hasFwciData ? 'No FWCI data available for this faculty' : (showFwciChart ? 'Hide FWCI trend' : 'Show FWCI trend on chart')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '8px',
                  border: `2px solid ${showFwciChart ? '#e05c36' : '#ccc'}`,
                  background: showFwciChart ? '#fff3ef' : '#f8f8f8',
                  color: showFwciChart ? '#e05c36' : (hasFwciData ? '#555' : '#bbb'),
                  fontWeight: 600, fontSize: '13px',
                  cursor: hasFwciData ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: showFwciChart ? '0 2px 8px rgba(224,92,54,0.2)' : 'none',
                }}
              >
                <span style={{ fontSize: '16px' }}>📈</span>
                {showFwciChart ? 'Hide FWCI' : 'Show FWCI'}
                {!hasFwciData && <span style={{ fontSize: '11px', fontWeight: 400 }}>(not available)</span>}
              </button>

              {fullHistory && <small style={{ color: '#666' }}>Displaying full data range</small>}
            </div>

            <div className="highcharts-frame-container">
              <div id="faculty-highcharts-container" ref={chartRef} style={{ width: '100%', height: '420px', minHeight: '420px' }} />
              {chartLoading && <div style={{ marginTop: 8, color: '#666' }}>Loading chart...</div>}
              {chartError && <div style={{ marginTop: 8, color: 'red' }}>⚠️ {chartError}</div>}
            </div>
          </>
        )}

        {sdgFilter === 'none' && domainFilter === 'none' && yearFilter === 'none' && !selectedQuartile && !selectedType && !criteriaStartFilter && !criteriaEndFilter && (
          <div style={{ marginTop: '40px' }}>
            <h3 className="publications-title">Foreign Collaboration</h3>
          {countryStats.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌐</div>
              <h4 style={{ color: '#333', fontWeight: 600, marginBottom: '8px', fontSize: '16px' }}>No Foreign Collaboration Found</h4>
              <p style={{ color: '#777', fontSize: '14px', maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
                This faculty member has no publications recorded with foreign (international) co-authors.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '16px', marginBottom: '16px' }}>
                <div ref={countryChartRef} style={{ width: '100%', height: '420px', minHeight: '420px' }} />
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f0f4ff', borderBottom: '2px solid #e0e8ff' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: '#000347', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: '#000347', fontWeight: 600 }}>Country</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', color: '#000347', fontWeight: 600 }}>Publications</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#000347', fontWeight: 600 }}>Papers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryStats.map((stat, i) => (
                      <tr key={stat.country} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                        <td style={{ padding: '9px 16px', color: '#999', width: '40px' }}>{i + 1}</td>
                        <td style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: COUNTRY_PALETTE[i % COUNTRY_PALETTE.length] }} />
                          {stat.country}
                        </td>
                        <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600 }}>{stat.count}</td>
                        <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {stat.papers && stat.papers.length > 0 ? (
                            <button
                              onClick={() => openCountryModal(stat)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 10px', borderRadius: '6px', border: '1px solid #c7d4f0',
                                background: '#f0f4ff', color: '#000347',
                                fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                              }}
                            >
                              📄 View Papers
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════
          Foreign Collaboration Papers Modal
      ════════════════════════════════════════════════════════════════ */}
      {countryModal.open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeCountryModal(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '780px',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,51,0.18)', overflow: 'hidden',
          }}>

            {/* ── Modal Header ── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '20px 24px 16px', borderBottom: '1px solid #e8eeff',
              background: 'linear-gradient(135deg, #000347 0%, #1a3a8f 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🌐</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>
                    Papers with {countryModal.country}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a0b4e0' }}>
                    {countryModal.papers.length} collaborative publication{countryModal.papers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCountryModal}
                aria-label="Close"
                style={{
                  background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '8px',
                  color: '#fff', fontSize: '18px', width: '34px', height: '34px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >✕</button>
            </div>

            {/* ── Modal Body ── */}
            <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#555' }}>
                Showing <strong>{countryModal.papers.length}</strong> paper{countryModal.papers.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {countryModal.papers.map((paper, pi) => {
                  const globalIdx = allPapers.findIndex(p => p.doi === paper.doi);
                  const paperNum = globalIdx >= 0 ? globalIdx + 1 : pi + 1;
                  return (
                    <div key={paper.doi || pi} style={{
                      display: 'flex', gap: '14px', padding: '14px 16px',
                      borderRadius: '10px', border: '1px solid #e8eeff',
                      background: pi % 2 === 0 ? '#fff' : '#f8f9ff',
                      boxShadow: '0 1px 4px rgba(0,0,51,0.05)',
                    }}>
                      {/* Index badge */}
                      <div style={{
                        flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
                        background: '#000347', color: '#fff', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700,
                      }}>
                        {paperNum}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title */}
                        <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: '#1a237e', lineHeight: 1.45 }}>
                          {paper.doi ? (
                            <a
                              href={`/paper/${encodeURIComponent(paper.doi)}`}
                              style={{ color: '#1a237e', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {paper.title || 'N/A'}
                            </a>
                          ) : (paper.title || 'N/A')}
                        </h3>

                        {/* Meta row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                          <span style={{ color: '#666' }}>
                            📅 {paper.date ? new Date(paper.date).toLocaleDateString('en-IN') : 'N/A'}
                          </span>
                          {paper.doi && (
                            <a
                              href={`https://doi.org/${paper.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '2px 8px', borderRadius: '4px',
                                background: '#e8f0fe', color: '#1a3a8f',
                                fontWeight: 600, textDecoration: 'none', fontSize: '11px',
                              }}
                            >
                              DOI ↗
                            </a>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Modal Footer ── */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e8eeff', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeCountryModal}
                style={{
                  padding: '8px 24px', borderRadius: '8px', border: 'none',
                  background: '#000347', color: '#fff', fontWeight: 600,
                  fontSize: '14px', cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyDetailPage;