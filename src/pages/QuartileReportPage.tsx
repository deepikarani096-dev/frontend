import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import style from "../components/QuartileReport.module.css";
import "../components/SharedPageStyles.css";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";

interface Paper {
    doi: string;
    title: string;
    type: string;
    publication_name: string;
    date: string;
}

interface FacultyData {
    faculty_id: string;
    faculty_name: string;
    scopus_id: string;
    department: string;
    paper_count: number;
    papers: Paper[];
}

interface QuartileSummaryStats {
    [year: string]: { Q1: number; Q2: number; Q3: number; Q4: number; };
}

export default function QuartileReportPage() {
    const [year, setYear]                 = useState<string>("2024");
    const [quartile, setQuartile]         = useState<string>("Q1");
    const [facultyData, setFacultyData]   = useState<FacultyData[]>([]);
    const [summaryStats, setSummaryStats] = useState<QuartileSummaryStats>({});
    const [loading, setLoading]           = useState<boolean>(false);
    const [error, setError]               = useState<string>("");
    const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
    const [searchQuery, setSearchQuery]   = useState<string>("");
    const { getAuthHeaders, user, isAdmin, isHoD } = useAuth();
    const [departments, setDepartments]   = useState<string[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    const [papersModal, setPapersModal] = useState<{
        open: boolean; facultyName: string; papers: Paper[];
    }>({ open: false, facultyName: "", papers: [] });
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    useEffect(() => {
        document.body.style.overflow = papersModal.open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [papersModal.open]);

    const openModal = (faculty: FacultyData) => {
        const sorted = [...(faculty.papers || [])].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setPapersModal({ open: true, facultyName: faculty.faculty_name, papers: sorted });
    };
    const closeModal = () => setPapersModal({ open: false, facultyName: "", papers: [] });
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) closeModal();
    };

    useEffect(() => {
        if (isHoD && isHoD() && user?.department && departmentFilter === "all")
            setDepartmentFilter(user.department);
    }, [user, isHoD]);

    const fetchDepartments = async () => {
        try {
            const res = await axios.get("https://srm-sp-production.up.railway.app/api/faculty", { headers: getAuthHeaders() });
            const faculties = Array.isArray(res.data) ? res.data : [];
            setDepartments(Array.from(new Set(faculties.map((f: any) => f.department).filter(Boolean))));
        } catch (err) { console.error("Failed to fetch departments:", err); }
    };

    const fetchQuartileReport = async () => {
        setLoading(true); setError("");
        try {
            let url = `https://srm-sp-production.up.railway.app/api/faculty/quartile-report/data?year=${year}&quartile=${quartile}`;
            if (isAdmin && isAdmin() && departmentFilter && departmentFilter !== "all")
                url += `&department=${encodeURIComponent(departmentFilter)}`;
            const res = await axios.get(url, { headers: getAuthHeaders() });
            setFacultyData(res.data.success ? res.data.data || [] : []);
        } catch (err) {
            console.error("Error fetching quartile report:", err);
            setError("Failed to load quartile report data");
            setFacultyData([]);
        } finally { setLoading(false); }
    };

    const fetchSummaryStats = async () => {
        try {
            let url = "https://srm-sp-production.up.railway.app/api/faculty/quartile-report/summary-stats";
            if (isAdmin && isAdmin() && departmentFilter && departmentFilter !== "all")
                url += `?department=${encodeURIComponent(departmentFilter)}`;
            const res = await axios.get(url, { headers: getAuthHeaders() });
            if (res.data.success) setSummaryStats(res.data.data || {});
        } catch (err) { console.error("Error fetching summary stats:", err); }
    };

    useEffect(() => { if (isAdmin && isAdmin()) fetchDepartments(); fetchSummaryStats(); }, []);
    useEffect(() => { fetchQuartileReport(); }, [year, quartile, departmentFilter]);
    useEffect(() => { fetchSummaryStats(); }, [departmentFilter]);

    const filteredFacultyData = facultyData.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.faculty_name.toLowerCase().includes(q) || f.faculty_id.toLowerCase().includes(q) ||
            f.scopus_id.toString().toLowerCase().includes(q) || f.department.toLowerCase().includes(q);
    });

    // ─────────────────────────────────────────────────────────────────
    // PDF constants
    // ─────────────────────────────────────────────────────────────────
    const NAVY  = [13,  31,  60]  as [number,number,number];
    const GOLD  = [184, 151, 90]  as [number,number,number];
    const WHITE = [255, 255, 255] as [number,number,number];
    const LIGHT = [245, 247, 250] as [number,number,number];
    const MUTED = [107, 114, 128] as [number,number,number];

    const Q_PDF_COLORS: Record<string,[number,number,number]> = {
        Q1: [79, 70, 229], Q2: [8, 145, 178], Q3: [5, 150, 105], Q4: [217, 119, 6],
    };

    // Build filter description string embedded in every PDF page
    const filterLabel = (): string => {
        const parts = [`Year: ${year}`, `Quartile: ${quartile}`];
        if (isAdmin && isAdmin() && departmentFilter !== "all")
            parts.push(`Department: ${departmentFilter}`);
        return parts.join("   ·   ");
    };

    // ── Cover page ───────────────────────────────────────────────────
    const buildCoverPage = (doc: jsPDF, subtitle: string, dataLength: number, statsSnap: QuartileSummaryStats) => {
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const date = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

        // Background
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
        doc.setFillColor(...GOLD);
        doc.rect(0, 0, W, 5, "F");
        doc.rect(0, H - 5, W, 5, "F");
        doc.rect(0, 5, 4, H - 10, "F");

        // Institution name
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...GOLD);
        doc.text("SRM INSTITUTE OF SCIENCE AND TECHNOLOGY", W / 2, 36, { align: "center" });
        doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(40, 40, W - 40, 40);

        // Title
        doc.setFontSize(24); doc.setTextColor(...WHITE);
        doc.text("QUARTILE REPORT", W / 2, 60, { align: "center" });
        doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(...GOLD);
        doc.text(subtitle, W / 2, 72, { align: "center" });

        // Filter pill
        doc.setFillColor(25, 48, 82);
        doc.roundedRect(24, 80, W - 48, 14, 3, 3, "F");
        doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...GOLD);
        doc.text(filterLabel(), W / 2, 89, { align: "center" });

        // Stat boxes — only show the SELECTED quartile count + faculty count
        const qs = statsSnap[year];
        if (qs) {
            const qCount = qs[quartile as keyof typeof qs];
            const boxes = [
                { label: `${quartile} PAPERS IN ${year}`, value: String(qCount),   color: Q_PDF_COLORS[quartile] },
                { label: "FACULTY LISTED",                value: String(dataLength), color: [30, 55, 95] as [number,number,number] },
            ];
            const boxW = 70; const gap = 12;
            const startX = (W - (boxes.length * boxW + (boxes.length - 1) * gap)) / 2;
            boxes.forEach((b, i) => {
                const bx = startX + i * (boxW + gap);
                doc.setFillColor(...b.color);
                doc.roundedRect(bx, 104, boxW, 28, 4, 4, "F");
                doc.setDrawColor(255,255,255); doc.setLineWidth(0.3);
                doc.roundedRect(bx+1, 105, boxW-2, 26, 3, 3, "S");
                doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...WHITE);
                doc.text(b.value, bx + boxW / 2, 120, { align: "center" });
                doc.setFontSize(6.5); doc.setTextColor(210,215,225);
                doc.text(b.label, bx + boxW / 2, 128, { align: "center" });
            });
        }

        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(160,175,195);
        doc.text(`Report Date: ${date}`, W / 2, 148, { align: "center" });
        doc.setFontSize(7.5); doc.setTextColor(100,115,135);
        doc.text("This report is confidential and intended for internal use only.", W / 2, H - 14, { align: "center" });
        doc.text(`Generated: ${date}`, W / 2, H - 9, { align: "center" });
    };

    // ── Running page header (returns Y to start content) ─────────────
    const pageHeader = (doc: jsPDF): number => {
        const W = doc.internal.pageSize.getWidth();
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 16, "F");
        doc.setFillColor(...GOLD); doc.rect(0, 16, W, 1.2, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...GOLD);
        doc.text("SRM INSTITUTE OF SCIENCE AND TECHNOLOGY", 14, 10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(170,185,205);
        doc.text(filterLabel(), W - 14, 10, { align: "right" });
        return 24;
    };

    // ── Footer ───────────────────────────────────────────────────────
    const pageFooter = (doc: jsPDF, num: number) => {
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        doc.setFillColor(...GOLD); doc.rect(0, H - 9, W, 0.7, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text("SRM Institute of Science and Technology — Quartile Report — Confidential", 14, H - 3.5);
        doc.text(`Page ${num}`, W - 14, H - 3.5, { align: "right" });
    };

    // ── Section heading ──────────────────────────────────────────────
    const sectionHeading = (doc: jsPDF, text: string, y: number): number => {
        const W = doc.internal.pageSize.getWidth();
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
        doc.text(text, 14, y);
        doc.setDrawColor(...GOLD); doc.setLineWidth(0.5);
        doc.line(14, y + 2, W - 14, y + 2);
        return y + 9;
    };

    // ── Common autoTable options ─────────────────────────────────────
    const statsTableBody = (stats: QuartileSummaryStats) =>
        Object.entries(stats).sort().reverse().map(([yr, qs]: any) => [
            yr,
            { content: String(qs.Q1), styles: { textColor: Q_PDF_COLORS.Q1, fontStyle: "bold" as const } },
            { content: String(qs.Q2), styles: { textColor: Q_PDF_COLORS.Q2, fontStyle: "bold" as const } },
            { content: String(qs.Q3), styles: { textColor: Q_PDF_COLORS.Q3, fontStyle: "bold" as const } },
            { content: String(qs.Q4), styles: { textColor: Q_PDF_COLORS.Q4, fontStyle: "bold" as const } },
        ]);

    // ── COUNT-ONLY PDF ───────────────────────────────────────────────
    const downloadCountReport = () => {
        if (!facultyData.length) { alert("No data to download"); return; }

        const snap = { facultyData: [...facultyData], summaryStats: { ...summaryStats } };
        const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Page 1 — Cover
        buildCoverPage(doc, "Faculty Count Summary", snap.facultyData.length, snap.summaryStats);

        // Page 2 onward — faculty list only
        doc.addPage();
        let y = pageHeader(doc);

        y = sectionHeading(doc, `FACULTY WITH ${quartile} PUBLICATIONS  (${year})`, y);
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(`Filter applied: ${filterLabel()}   ·   ${snap.facultyData.length} faculty member(s) found`, 14, y);
        y += 7;

        autoTable(doc, {
            startY: y,
            head: [["#", "Faculty ID", "Name", "Department", "Scopus ID", "Papers"]],
            body: snap.facultyData.map((f, i) => [
                { content: String(i + 1), styles: { halign: "center" as const } },
                f.faculty_id,
                f.faculty_name,
                f.department,
                f.scopus_id,
                { content: String(f.paper_count), styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [29,78,216] as [number,number,number] } },
            ]),
            theme: "grid",
            headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 9, halign: "center" },
            columnStyles: {
                0: { cellWidth: 14, halign: "center", overflow: "hidden", fontSize: 9 },
                1: { cellWidth: 24, overflow: "hidden", fontSize: 9 },
                2: { cellWidth: 56, overflow: "linebreak", fontSize: 9 },
                3: { cellWidth: 32, overflow: "linebreak", fontSize: 9 },
                4: { cellWidth: 30, overflow: "hidden", fontSize: 8 },
                5: { cellWidth: 16, halign: "center", overflow: "hidden", fontSize: 9 },
            },
            alternateRowStyles: { fillColor: LIGHT },
            styles: { cellPadding: 3, minCellHeight: 9 },
            margin: { left: 14, right: 14 },
            didDrawPage: () => { pageHeader(doc); },
        });

        const total = doc.getNumberOfPages();
        for (let i = 2; i <= total; i++) { doc.setPage(i); pageFooter(doc, i); }

        doc.save(`Quartile_Report_${year}_${quartile}_Count.pdf`);
        setShowDownloadMenu(false);
    };

    // ── WITH-PAPERS PDF ──────────────────────────────────────────────
    const downloadWithPapers = () => {
        if (!facultyData.length) { alert("No data to download"); return; }

        const snap = { facultyData: [...facultyData], summaryStats: { ...summaryStats } };
        const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const W    = doc.internal.pageSize.getWidth();
        const H    = doc.internal.pageSize.getHeight();
        // Usable bottom limit (above footer)
        const BOTTOM_MARGIN = H - 16;
        // Height needed for a faculty banner + table header before we decide to break
        const BANNER_H = 22;
        const MIN_SPACE_FOR_NEW_SECTION = BANNER_H + 20;

        // Page 1 — Cover
        buildCoverPage(doc, "Detailed Publication Report", snap.facultyData.length, snap.summaryStats);

        // Page 2 onward — all faculty with papers, flowing continuously
        doc.addPage();
        let y = pageHeader(doc);

        // Section heading + filter note at the top
        y = sectionHeading(doc, `FACULTY PUBLICATIONS  —  ${filterLabel()}`, y);
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(`${snap.facultyData.length} faculty member(s) with ${quartile} publications in ${year}`, 14, y);
        y += 10;

        snap.facultyData.forEach((faculty, fi) => {
            if (!faculty.papers?.length) return;

            // If not enough room for banner + at least a few rows, start a new page
            if (y + MIN_SPACE_FOR_NEW_SECTION > BOTTOM_MARGIN) {
                doc.addPage();
                y = pageHeader(doc);
            } else if (fi > 0) {
                // Add visible gap between faculty sections on the same page
                y += 10;
                // Draw a thin separator line
                doc.setDrawColor(220, 224, 230);
                doc.setLineWidth(0.3);
                doc.line(14, y - 5, W - 14, y - 5);
            }

            // Faculty banner
            doc.setFillColor(...LIGHT); doc.rect(14, y, W - 28, BANNER_H, "F");
            doc.setFillColor(...GOLD);  doc.rect(14, y, 3.5, BANNER_H, "F");
            doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...NAVY);
            doc.text(`${fi + 1}.  ${faculty.faculty_name}`, 22, y + 7);
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
            doc.text(
                `ID: ${faculty.faculty_id}   ·   Dept: ${faculty.department}   ·   Scopus: ${faculty.scopus_id}   ·   ${quartile} Papers: ${faculty.paper_count}`,
                22, y + 15
            );
            y += BANNER_H + 3;

            const sortedPapers = [...faculty.papers].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            autoTable(doc, {
                startY: y,
                head: [["#", "Title", "Journal / Conference", "Type", "Date", "DOI"]],
                body: sortedPapers.map((p, pi) => [
                    { content: String(pi + 1), styles: { halign: "center" as const } },
                    p.title,
                    p.publication_name,
                    { content: p.type,  styles: { halign: "center" as const } },
                    { content: p.date,  styles: { halign: "center" as const } },
                    p.doi,
                ]),
                theme: "grid",
                headStyles: { fillColor: [30, 50, 80] as [number,number,number], textColor: WHITE, fontStyle: "bold", fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 10, halign: "center", overflow: "hidden",    fontSize: 8 },
                    1: { cellWidth: 58, fontSize: 7.5, overflow: "linebreak" },
                    2: { cellWidth: 44, fontSize: 7,   overflow: "linebreak",    fontStyle: "italic" },
                    3: { cellWidth: 20, halign: "center", fontSize: 7.5, overflow: "hidden" },
                    4: { cellWidth: 20, halign: "center", fontSize: 7.5, overflow: "hidden" },
                    5: { cellWidth: 24, fontSize: 6.5, overflow: "linebreak",    textColor: MUTED },
                },
                alternateRowStyles: { fillColor: LIGHT },
                styles: { cellPadding: 3, overflow: "linebreak", minCellHeight: 9 },
                margin: { left: 14, right: 14 },
                // On overflow pages redraw header; also re-draw the faculty banner label in header area
                didDrawPage: (data) => {
                    pageHeader(doc);
                    // On continuation pages, add a small "continued" label so reader knows which faculty
                    if (data.pageNumber > 1) {
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(7.5);
                        doc.setTextColor(...MUTED);
                        doc.text(`↳ ${faculty.faculty_name} (continued)`, 14, 21);
                    }
                },
            });

            // Update y to just after this faculty's table
            y = (doc as any).lastAutoTable.finalY;
        });

        // Stamp correct page numbers on all non-cover pages
        const total = doc.getNumberOfPages();
        for (let i = 2; i <= total; i++) { doc.setPage(i); pageFooter(doc, i); }

        doc.save(`Quartile_Report_${year}_${quartile}_WithPapers.pdf`);
        setShowDownloadMenu(false);
    };

    // ── Excel summary ────────────────────────────────────────────────
    const downloadSummaryAsExcel = () => {
        if (!Object.keys(summaryStats).length) { alert("No data to download"); return; }
        const data: any[] = [["Year", "Q1", "Q2", "Q3", "Q4"]];
        Object.entries(summaryStats).sort().reverse().forEach(([yr, q]: any) => data.push([yr, q.Q1, q.Q2, q.Q3, q.Q4]));
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Summary Stats");
        ws["!cols"] = Array(5).fill({ wch: 12 });
        XLSX.writeFile(wb, `Quartile_Summary_${Date.now()}.xlsx`);
        setShowDownloadMenu(false);
    };

    const Q_COLORS: Record<string, { bg: string }> = {
        Q1: { bg: "#4f46e5" }, Q2: { bg: "#0891b2" }, Q3: { bg: "#059669" }, Q4: { bg: "#d97706" },
    };

    return (
        <div className={style.pageWrapper}>
            <div className="shared-navbar">
                <a className="shared-logo">
                    <img src={srmLogo} alt="SRM Logo" className={style.navLogo} />
                    <span>SPM SP</span>
                </a>
                <UserMenu />
            </div>

            <div className={style.container}>

                {/* Back Button */}
                <div style={{ display: "block" }}>
                    <Link to="/dashboard" className={style.backButton}>
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Page Header */}
                <div className={style.pageHeader}>
                    <div className={style.headerEyebrow}>Research Analytics</div>
                    <h1 className={style.pageTitle}>Quartile Report</h1>
                    <p className={style.pageSubtitle}>Track and analyze faculty publications by quartile ranking across years</p>
                </div>

                {/* Filters Card */}
                <div className={style.card}>
                    <div className={style.cardHeader}>
                        <div className={style.cardHeaderLeft}>
                            <h3 className={style.cardTitle}>Filters</h3>
                        </div>
                        <div className={style.downloadButtonContainer}>
                            <button
                                className={style.downloadButton}
                                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                disabled={facultyData.length === 0}
                            >
                                ↓ Download Report <span className={style.chevron}>{showDownloadMenu ? "▲" : "▼"}</span>
                            </button>
                            {showDownloadMenu && (
                                <div className={style.downloadMenu}>
                                    <button className={style.downloadMenuItem} onClick={downloadCountReport}>
                                        <span className={style.menuEmoji}>📊</span>
                                        <div>
                                            <div className={style.menuTitle}>Count Only — PDF</div>
                                            <div className={style.menuDesc}>Summary table with paper counts</div>
                                        </div>
                                    </button>
                                    <button className={style.downloadMenuItem} onClick={downloadWithPapers}>
                                        <span className={style.menuEmoji}>📄</span>
                                        <div>
                                            <div className={style.menuTitle}>With Papers — PDF</div>
                                            <div className={style.menuDesc}>Full per-faculty publication detail</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={style.filtersRow}>
                        <div className={style.filterGroup}>
                            <label className={style.filterLabel}>Year</label>
                            <select value={year} onChange={(e) => setYear(e.target.value)} className={style.filterSelect}>
                                <option value="2024">2024</option>
                                <option value="2023">2023</option>
                                <option value="2022">2022</option>
                            </select>
                        </div>
                        <div className={style.filterGroup}>
                            <label className={style.filterLabel}>Quartile</label>
                            <select value={quartile} onChange={(e) => setQuartile(e.target.value)} className={style.filterSelect}>
                                <option value="Q1">Q1</option>
                                <option value="Q2">Q2</option>
                                <option value="Q3">Q3</option>
                                <option value="Q4">Q4</option>
                            </select>
                        </div>
                        {isAdmin && isAdmin() && (
                            <div className={style.filterGroup}>
                                <label className={style.filterLabel}>Department</label>
                                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className={style.filterSelect}>
                                    <option value="all">All Departments</option>
                                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        )}
                        <div className={`${style.filterGroup} ${style.searchGroup}`}>
                            <label className={style.filterLabel}>Search</label>
                            <div className={style.searchInputWrapper}>
                                <span className={style.searchIconInner}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Name, ID, Scopus ID, department…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={style.searchInput}
                                />
                                {searchQuery && (
                                    <button className={style.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
                                )}
                            </div>
                        </div>
                    </div>
                    {error && <div className={style.errorBanner}>⚠ {error}</div>}
                </div>

                {/* Summary Stats Card */}
                <div className={style.card}>
                    <div className={style.cardHeader}>
                        <div className={style.cardHeaderLeft}>
                            <h3 className={style.cardTitle}>Unique Papers by Quartile</h3>
                            <p className={style.cardSubtitle}>All years · Distinct publications per quartile band</p>
                        </div>
                        <button className={style.excelButton} onClick={downloadSummaryAsExcel}>
                            📊 Export Excel
                        </button>
                    </div>
                    <div className={style.tableScrollWrapper}>
                        <table className={style.statsTable}>
                            <thead>
                                <tr>
                                    <th className={style.yearHeader}>Year</th>
                                    {(["Q1","Q2","Q3","Q4"] as const).map(q => (
                                        <th key={q} className={style.qHeader}>
                                            <span className={style.qBadge} style={{ background: Q_COLORS[q].bg }}>{q}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(summaryStats).sort().reverse().map(([yr, qs]: any) => (
                                    <tr key={yr} className={style.statsRow}>
                                        <td className={style.yearCell}>{yr}</td>
                                        {(["Q1","Q2","Q3","Q4"] as const).map(q => (
                                            <td key={q} className={style.statCell}>
                                                <span className={style.statValue} style={{ color: Q_COLORS[q].bg }}>
                                                    {qs[q].toLocaleString()}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Faculty Table Card */}
                <div className={style.card}>
                    <div className={style.cardHeader}>
                        <div className={style.cardHeaderLeft}>
                            <h3 className={style.cardTitle}>Faculty Details</h3>
                            <p className={style.cardSubtitle}>
                                {filteredFacultyData.length} result{filteredFacultyData.length !== 1 ? "s" : ""} · {year} · {quartile}
                            </p>
                        </div>
                    </div>
                    <div className={style.tableScrollWrapper}>
                        {loading ? (
                            <div className={style.loadingState}>
                                <div className={style.spinner} />
                                <span>Loading…</span>
                            </div>
                        ) : filteredFacultyData.length > 0 ? (
                            <table className={style.facultyTable}>
                                <thead>
                                    <tr>
                                        <th>Faculty ID</th>
                                        <th>Name</th>
                                        <th>Scopus ID</th>
                                        <th>Department</th>
                                        <th style={{ textAlign: "center" }}>Papers</th>
                                        <th style={{ textAlign: "center" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFacultyData.map((faculty, idx) => (
                                        <tr key={idx} className={style.facultyRow}>
                                            <td className={style.idCell}>{faculty.faculty_id}</td>
                                            <td className={style.nameCell}>{faculty.faculty_name}</td>
                                            <td className={style.monoCell}>{faculty.scopus_id}</td>
                                            <td><span className={style.deptPill}>{faculty.department}</span></td>
                                            <td style={{ textAlign: "center" }}>
                                                <span className={style.countBadge}>{faculty.paper_count}</span>
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <button className={style.viewButton} onClick={() => openModal(faculty)}>
                                                    View Papers
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className={style.emptyState}>
                                <div className={style.emptyIcon}>📭</div>
                                <p>{searchQuery ? "No results match your search" : "No data for the selected filters"}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Papers Modal */}
            {papersModal.open && (
                <div className={style.modalBackdrop} onClick={handleBackdropClick}>
                    <div className={style.modal} ref={modalRef}>
                        <div className={style.modalHeader}>
                            <div>
                                <h2 className={style.modalTitle}>Publications</h2>
                                <p className={style.modalSubtitle}>
                                    {papersModal.facultyName} · {papersModal.papers.length} paper{papersModal.papers.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <button className={style.closeBtn} onClick={closeModal}>✕</button>
                        </div>
                        <div className={style.modalBody}>
                            {papersModal.papers.length > 0 ? papersModal.papers.map((paper, idx) => (
                                <div key={idx} className={style.paperCard}>
                                    <div className={style.paperIdx}>{idx + 1}</div>
                                    <div className={style.paperInfo}>
                                        <h4 className={style.paperTitle}>
                                            <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                                                {paper.title}
                                            </a>
                                        </h4>
                                        <p className={style.paperJournal}>{paper.publication_name}</p>
                                        <div className={style.paperTags}>
                                            <span className={style.typeTag}>{paper.type}</span>
                                            <span className={style.metaTag}>📅 {paper.date}</span>
                                            <span className={style.metaTag}>DOI: {paper.doi}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className={style.noPapers}>No papers found</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}