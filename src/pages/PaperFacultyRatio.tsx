import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import style from "../components/PaperFacultyRatio.module.css";
import "../components/SharedPageStyles.css";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Paper {
    id: number;
    scopus_id: number | string;
    doi: string | null;
    title: string;
    type: "Journal" | "Conference Proceeding" | "Book";
    publication_name: string;
    date: string;
    author1: string | null;
    author2: string | null;
    author3: string | null;
    author4: string | null;
    author5: string | null;
    author6: string | null;
    affiliation1: string | null;
    affiliation2: string | null;
    affiliation3: string | null;
    quartile: string | null;
}

interface FacultyEntry {
    faculty_id: string | null;
    faculty_name: string;
    scopus_id: number | string;
    department: string;
    paper_count: number;
    papers: Paper[];
}

interface RatioResponse {
    year: number;
    startDate: string;
    endDate: string;
    totalFaculty: number;
    totalPapers: number;
    ratio: number;
    faculty: FacultyEntry[];
}

interface DeptStat {
    department: string;
    faculty: number;
    papers: number;
    ratio: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getCurrentYear = () => new Date().getFullYear();
const getYearOptions = () => {
    const current = getCurrentYear();
    return [current, current - 1, current - 2];
};
const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const getAuthors = (paper: Paper): string[] =>
    [paper.author1, paper.author2, paper.author3,
     paper.author4, paper.author5, paper.author6]
    .filter((a): a is string => Boolean(a));

const formatType = (type: string) => {
    if (type === "Conference Proceeding") return "Conference";
    return type;
};

// ─── Sub-component: Faculty Row ───────────────────────────────────────────────

interface FacultyRowProps {
    entry: FacultyEntry;
    rank: number;
    onViewPapers: (entry: FacultyEntry) => void;
}

const FacultyRow: React.FC<FacultyRowProps> = ({ entry, rank, onViewPapers }) => {
    return (
        <tr>
            <td><span className={style.rankBadge}>{rank}</span></td>
            <td>
                <div className={style.facultyName}>{entry.faculty_name}</div>
                <div className={style.facultyId}>{entry.faculty_id || "—"}</div>
            </td>
            <td><span className={style.scopusId}>{entry.scopus_id}</span></td>
            <td>{entry.department || "—"}</td>
            <td className={style.paperCountCell}>
                <button
                    className={`${style.paperCountBtn} ${entry.paper_count === 0 ? style.zeroPapers : ""}`}
                    onClick={() => { if (entry.paper_count > 0) onViewPapers(entry); }}
                    disabled={entry.paper_count === 0}
                    title={entry.paper_count > 0 ? `View ${entry.paper_count} papers` : "No papers"}
                >
                    <span>{entry.paper_count} paper{entry.paper_count !== 1 ? "s" : ""}</span>
                    {entry.paper_count > 0 && (
                        <span className={style.countBadgeArrow}>▾</span>
                    )}
                </button>
            </td>
        </tr>
    );
};

// ─── Sub-component: Dept Stats Table (Admin only) ─────────────────────────────

const DeptStatsTable: React.FC<{
    deptStats: DeptStat[];
    onSelectDept: (dept: string) => void;
    selectedDept: string;
    loadingDepts: boolean;
}> = ({ deptStats, onSelectDept, selectedDept, loadingDepts }) => (
    <div className={style.tableSection} style={{ marginBottom: 28 }}>
        <div className={style.tableHeader}>
            <span className={style.tableTitle}>📊 Department-wise Ratio Summary</span>
            <span className={style.tableCount}>
                {loadingDepts ? "Loading…" : `${deptStats.length} departments`}
            </span>
        </div>
        <div className={style.tableWrapper}>
            {loadingDepts ? (
                <div className={style.loadingWrapper}>
                    <div className={style.spinner} />Loading department stats…
                </div>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 48 }}>#</th>
                            <th>Department</th>
                            <th style={{ textAlign: "center" }}>Faculty</th>
                            <th style={{ textAlign: "center" }}>Papers</th>
                            <th style={{ textAlign: "center" }}>Ratio</th>
                            <th style={{ textAlign: "center" }}>Filter</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deptStats.map((d, idx) => (
                            <tr key={d.department} style={{ background: selectedDept === d.department ? "#e8f4fd" : undefined }}>
                                <td><span className={style.rankBadge}>{idx + 1}</span></td>
                                <td><div className={style.facultyName}>{d.department}</div></td>
                                <td style={{ textAlign: "center" }}>{d.faculty}</td>
                                <td style={{ textAlign: "center" }}>{d.papers}</td>
                                <td style={{ textAlign: "center" }}>
                                    <span style={{
                                        display: "inline-block",
                                        padding: "4px 12px",
                                        borderRadius: "12px",
                                        fontWeight: 700,
                                        fontSize: "13px",
                                        background: d.ratio >= 2 ? "#e8f5e9" : d.ratio >= 1 ? "#fff3e0" : "#fce4ec",
                                        color: d.ratio >= 2 ? "#2e7d32" : d.ratio >= 1 ? "#e65100" : "#c62828",
                                    }}>
                                        {d.ratio.toFixed(2)}
                                    </span>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                    <button
                                        onClick={() => onSelectDept(selectedDept === d.department ? "all" : d.department)}
                                        style={{
                                            padding: "5px 14px",
                                            borderRadius: "8px",
                                            border: "1.5px solid #054768",
                                            background: selectedDept === d.department ? "#054768" : "transparent",
                                            color: selectedDept === d.department ? "#fff" : "#054768",
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {selectedDept === d.department ? "✓ Viewing" : "View"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    </div>
);

// ─── Main Page Component ───────────────────────────────────────────────────────

type ViewMode = "above" | "below";

export default function PaperFacultyRatio() {
    const navigate = useNavigate();
    const { getAuthHeaders, user } = useAuth();

    const isAdmin = user?.accessLevel === 1;
    const isHoD = user?.accessLevel === 2;
    // For HoD, department is always locked to their own
    const hodDept = isHoD ? (user?.department || "") : "";

    // ── Generate & download HTML report ──────────────────────────────────────
    const generateReport = (
        allFaculty: FacultyEntry[],
        data: RatioResponse | null,
        selectedYear: number,
        searchQuery: string,
        ratioVal: number,
        displayDeptLabel: string
    ) => {
        const now = new Date();
        const generatedAt = now.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

        // Apply search filter to get the same filtered set as shown on screen
        const searchFiltered = allFaculty.filter((f) => {
            const q = searchQuery.toLowerCase();
            if (!q) return true;
            return (
                f.faculty_name.toLowerCase().includes(q) ||
                String(f.scopus_id).includes(q) ||
                (f.faculty_id?.toLowerCase().includes(q) ?? false) ||
                (f.department?.toLowerCase().includes(q) ?? false)
            );
        });

        // Split into both sections
        const highPerformers = searchFiltered.filter(f => f.paper_count >= ratioVal);
        const belowAverage = searchFiltered.filter(f => f.paper_count < ratioVal);

        // Build filter tags
        const filters: { key: string; val: string }[] = [
            { key: "Year", val: String(selectedYear) },
            { key: "Department", val: displayDeptLabel },
            { key: "Ratio Threshold", val: ratioVal.toFixed(2) },
        ];
        if (searchQuery.trim()) filters.push({ key: "Search", val: `"${searchQuery.trim()}"` });
        filters.push({ key: "Total Faculty", val: String(searchFiltered.length) });

        // Build a faculty table rows — counts only, no paper details
        const buildRows = (list: FacultyEntry[]) => list.map((entry, idx) => `
            <tr class="faculty-row">
                <td class="center">${idx + 1}</td>
                <td>
                    <div class="faculty-name">${entry.faculty_name}</div>
                    <div class="faculty-id">${entry.faculty_id || "—"}</div>
                </td>
                <td><span class="scopus-id">${entry.scopus_id}</span></td>
                <td>${entry.department || "—"}</td>
                <td class="center">
                    <span class="paper-count ${entry.paper_count === 0 ? "zero" : ""}">${entry.paper_count}</span>
                </td>
            </tr>`).join("") || `<tr><td colspan="5" class="empty-row">No faculty in this category</td></tr>`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Paper-Faculty Ratio Report — ${selectedYear}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f0f4f8; color: #1a2533; font-size: 13px; }

    .report-header {
        background: linear-gradient(135deg, #054768 0%, #0a5a8c 100%);
        color: #fff; padding: 32px 48px 28px;
    }
    .report-header h1 { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 4px; }
    .report-header .subtitle { font-size: 13px; opacity: 0.7; }
    .report-meta { display: flex; gap: 32px; flex-wrap: wrap; margin-top: 20px; }
    .meta-item { display: flex; flex-direction: column; gap: 3px; }
    .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.55; }
    .meta-value { font-size: 14px; font-weight: 700; }

    .report-body { padding: 32px 48px; max-width: 1200px; margin: 0 auto; }

    /* KPI row */
    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 28px; }
    .kpi-card {
        background: #fff; border-radius: 10px; padding: 20px 24px;
        border: 1px solid #e0e7ef; box-shadow: 0 2px 6px rgba(5,71,104,0.07);
    }
    .kpi-card.green { border-top: 4px solid #2e7d32; }
    .kpi-card.blue  { border-top: 4px solid #054768; }
    .kpi-card.red   { border-top: 4px solid #c62828; }
    .kpi-label { font-size: 10px; font-weight: 700; color: #7a8fa0; text-transform: uppercase; letter-spacing: 0.8px; }
    .kpi-value { font-size: 36px; font-weight: 900; color: #054768; line-height: 1.1; margin: 6px 0 4px; letter-spacing: -1px; }
    .kpi-card.green .kpi-value { color: #2e7d32; }
    .kpi-card.red   .kpi-value { color: #c62828; }
    .kpi-sub { font-size: 11px; color: #9aabb8; }

    /* Filters box */
    .filters-box {
        background: #fff; border-radius: 10px; padding: 18px 24px;
        border: 1px solid #e0e7ef; margin-bottom: 28px;
        box-shadow: 0 2px 6px rgba(5,71,104,0.07);
    }
    .filters-box h3 {
        font-size: 11px; font-weight: 700; color: #054768;
        margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px;
    }
    .filter-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .filter-tag {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 12px; border-radius: 20px;
        background: #e8f0f7; color: #054768;
        font-size: 12px; font-weight: 600; border: 1px solid #c8d6e5;
    }
    .filter-tag .tag-key { color: #7a8fa0; font-weight: 500; }

    /* Section */
    .section-block { margin-bottom: 36px; }
    .section-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 18px; border-radius: 8px 8px 0 0;
        font-size: 14px; font-weight: 800; color: #fff;
    }
    .section-header.high { background: linear-gradient(135deg, #2e7d32, #43a047); }
    .section-header.low  { background: linear-gradient(135deg, #c62828, #e53935); }
    .section-header .badge {
        font-size: 12px; font-weight: 600; padding: 3px 12px;
        background: rgba(255,255,255,0.2); border-radius: 12px;
    }

    /* Table */
    .main-table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 2px 8px rgba(5,71,104,0.08); border-radius: 0 0 10px 10px; overflow: hidden; }
    .main-table thead th {
        background: #f0f4f8; color: #054768; padding: 11px 14px;
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.6px; text-align: left; border-bottom: 2px solid #e0e7ef;
    }
    .main-table thead th.center { text-align: center; }
    .faculty-row td { padding: 11px 14px; border-bottom: 1px solid #f0f4f8; vertical-align: middle; }
    .faculty-row:last-child td { border-bottom: none; }
    .faculty-row:nth-child(even) td { background: #fafcff; }
    .faculty-name { font-weight: 600; color: #054768; font-size: 13px; }
    .faculty-id { font-size: 11px; color: #8fa3b4; margin-top: 2px; }
    .scopus-id { font-family: 'Courier New', monospace; font-size: 12px; color: #4a5568; background: #f0f4f8; padding: 3px 8px; border-radius: 5px; border: 1px solid #dce4eb; }
    .paper-count { display: inline-block; padding: 4px 14px; border-radius: 16px; font-weight: 700; font-size: 13px; background: #e8f4fd; color: #1565c0; border: 1px solid #90caf9; }
    .paper-count.zero { background: #f5f5f5; color: #bdbdbd; border-color: #e0e0e0; }
    .center { text-align: center; }
    .empty-row { text-align: center; padding: 32px; color: #9aabb8; font-style: italic; }

    /* Footer */
    .report-footer {
        margin-top: 40px; padding: 18px 48px;
        background: #054768; color: rgba(255,255,255,0.55);
        font-size: 11px; display: flex; justify-content: space-between;
    }

    @media print {
        body { background: #fff; }
        .report-body { padding: 20px; }
        .section-block { page-break-inside: avoid; }
        @page { margin: 0.5in; }
    }
</style>
</head>
<body>

<div class="report-header">
    <h1>📄 Paper-to-Faculty Ratio Report</h1>
    <div class="subtitle">Research output analysis per faculty member</div>
    <div class="report-meta">
        <div class="meta-item"><span class="meta-label">Year</span><span class="meta-value">${selectedYear}</span></div>
        <div class="meta-item"><span class="meta-label">Department</span><span class="meta-value">${displayDeptLabel}</span></div>
        <div class="meta-item"><span class="meta-label">Ratio Threshold</span><span class="meta-value">${ratioVal.toFixed(2)}</span></div>
        <div class="meta-item"><span class="meta-label">Generated</span><span class="meta-value">${generatedAt}</span></div>
        <div class="meta-item"><span class="meta-label">Generated By</span><span class="meta-value">${user?.username || "—"}</span></div>
    </div>
</div>

<div class="report-body">

    <!-- KPI Cards -->
    <div class="kpi-row" style="margin-top:28px;">
        <div class="kpi-card blue">
            <div class="kpi-label">Total Faculty</div>
            <div class="kpi-value">${data?.totalFaculty ?? 0}</div>
            <div class="kpi-sub">${displayDeptLabel}</div>
        </div>
        <div class="kpi-card blue">
            <div class="kpi-label">Total Papers</div>
            <div class="kpi-value">${data?.totalPapers ?? 0}</div>
            <div class="kpi-sub">Publications in ${selectedYear}</div>
        </div>
        <div class="kpi-card blue">
            <div class="kpi-label">Papers / Faculty Ratio</div>
            <div class="kpi-value">${ratioVal.toFixed(2)}</div>
            <div class="kpi-sub">Average papers per faculty</div>
        </div>
        <div class="kpi-card green">
            <div class="kpi-label">High Performers</div>
            <div class="kpi-value">${highPerformers.length}</div>
            <div class="kpi-sub">Papers ≥ ${ratioVal.toFixed(2)}</div>
        </div>
        <div class="kpi-card red">
            <div class="kpi-label">Below Average</div>
            <div class="kpi-value">${belowAverage.length}</div>
            <div class="kpi-sub">Papers &lt; ${ratioVal.toFixed(2)}</div>
        </div>
    </div>

    <!-- Filters Applied -->
    <div class="filters-box">
        <h3>🔍 Filters Applied</h3>
        <div class="filter-tags">
            ${filters.map(f => `<span class="filter-tag"><span class="tag-key">${f.key}:</span> ${f.val}</span>`).join("")}
        </div>
    </div>

    <!-- Section 1: High Performers -->
    <div class="section-block">
        <div class="section-header high">
            🏆 High Performers — Papers ≥ ${ratioVal.toFixed(2)}
            <span class="badge">${highPerformers.length} faculty</span>
        </div>
        <table class="main-table">
            <thead>
                <tr>
                    <th class="center" style="width:48px">#</th>
                    <th>Faculty Name</th>
                    <th>Scopus ID</th>
                    <th>Department</th>
                    <th class="center">Paper Count</th>
                </tr>
            </thead>
            <tbody>${buildRows(highPerformers)}</tbody>
        </table>
    </div>

    <!-- Section 2: Below Average -->
    <div class="section-block">
        <div class="section-header low">
            📉 Below Average — Papers &lt; ${ratioVal.toFixed(2)}
            <span class="badge">${belowAverage.length} faculty</span>
        </div>
        <table class="main-table">
            <thead>
                <tr>
                    <th class="center" style="width:48px">#</th>
                    <th>Faculty Name</th>
                    <th>Scopus ID</th>
                    <th>Department</th>
                    <th class="center">Paper Count</th>
                </tr>
            </thead>
            <tbody>${buildRows(belowAverage)}</tbody>
        </table>
    </div>

</div>

<div class="report-footer">
    <span>Paper-Faculty Ratio Report · ${selectedYear} · ${displayDeptLabel}</span>
    <span>Generated on ${generatedAt}</span>
</div>

</body>
</html>`;

        const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Paper_Faculty_Ratio_${selectedYear}_${displayDeptLabel.replace(/\s+/g, "_")}.html`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const yearOptions = getYearOptions();
    const [selectedYear, setSelectedYear] = useState<number>(yearOptions[1]); // default: previous year
    const [departments, setDepartments] = useState<string[]>([]);
    // Admin starts on "all"; HoD is always locked to hodDept (never changes)
    const [selectedDept, setSelectedDept] = useState<string>("all");
    const [deptStats, setDeptStats] = useState<DeptStat[]>([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [viewMode, setViewMode] = useState<ViewMode>("above");
    const [data, setData] = useState<RatioResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const [animatedRatio, setAnimatedRatio] = useState(0);
    const [animatedFaculty, setAnimatedFaculty] = useState(0);
    const [animatedPapers, setAnimatedPapers] = useState(0);

    // ── Papers modal state (same as PublicationStats) ─────────────────────────
    const [papersModal, setPapersModal] = useState<{
        open: boolean;
        faculty: FacultyEntry | null;
    }>({ open: false, faculty: null });
    const modalRef = useRef<HTMLDivElement>(null);

    const openPapersModal = (entry: FacultyEntry) => {
        setPapersModal({ open: true, faculty: entry });
        document.body.style.overflow = "hidden";
    };
    const closePapersModal = () => {
        setPapersModal({ open: false, faculty: null });
        document.body.style.overflow = "";
    };

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePapersModal(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    // ── Build API URL — HoD always uses their dept regardless of selectedDept ─
    const buildUrl = (year: number, dept: string) => {
        // HoD: always force their department
        const effectiveDept = isHoD ? hodDept : dept;
        let url = `https://srm-sp-production.up.railway.app/api/paper-faculty-ratio?year=${year}`;
        if (effectiveDept && effectiveDept !== "all") {
            url += `&department=${encodeURIComponent(effectiveDept)}`;
        }
        return url;
    };

    // ── Fetch departments list ────────────────────────────────────────────────
    const fetchDepartments = async () => {
        try {
            const headers = getAuthHeaders();
            const res = await axios.get("https://srm-sp-production.up.railway.app/api/paper-faculty-ratio/departments", { headers });
            return Array.isArray(res.data) ? res.data as string[] : [];
        } catch { return []; }
    };

    // ── Fetch ratio data ──────────────────────────────────────────────────────
    const fetchData = async (year: number, dept: string) => {
        setLoading(true);
        setError(null);
        try {
            const headers = getAuthHeaders();
            const res = await axios.get<RatioResponse>(buildUrl(year, dept), { headers });
            setData(res.data);
        } catch {
            setError("Failed to load data. Please try again.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    // ── Fetch per-dept stats for admin summary ────────────────────────────────
    const fetchDeptStats = async (deptList: string[], year: number) => {
        setLoadingDepts(true);
        const headers = getAuthHeaders();
        const stats: DeptStat[] = [];
        for (const dept of deptList) {
            try {
                const url = `https://srm-sp-production.up.railway.app/api/paper-faculty-ratio?year=${year}&department=${encodeURIComponent(dept)}`;
                const res = await axios.get<RatioResponse>(url, { headers });
                stats.push({ department: dept, faculty: res.data.totalFaculty, papers: res.data.totalPapers, ratio: res.data.ratio });
            } catch { /* skip failed dept */ }
        }
        setDeptStats(stats);
        setLoadingDepts(false);
    };

    const animateCounter = (target: number, setter: (v: number) => void, decimals = 0, duration = 900) => {
        let start = 0;
        const increment = target / (duration / 16);
        const step = () => {
            start += increment;
            if (start < target) { setter(parseFloat(start.toFixed(decimals))); requestAnimationFrame(step); }
            else setter(target);
        };
        requestAnimationFrame(step);
    };

    // ── Initialize on user load ───────────────────────────────────────────────
    useEffect(() => {
        if (!user || ready) return;
        if (isAdmin) {
            setSelectedDept("all");
            fetchDepartments().then(depts => {
                setDepartments(depts);
                fetchDeptStats(depts, selectedYear);
            });
        }
        // HoD: selectedDept stays "all" but buildUrl overrides with hodDept
        setReady(true);
    }, [user]);

    // ── Fetch faculty data when year/dept/ready changes ───────────────────────
    useEffect(() => {
        if (!ready) return;
        fetchData(selectedYear, selectedDept);
    }, [selectedYear, selectedDept, ready]);

    // ── Refresh dept stats when year changes (admin) ──────────────────────────
    useEffect(() => {
        if (!ready || !isAdmin || departments.length === 0) return;
        fetchDeptStats(departments, selectedYear);
    }, [selectedYear]);

    // ── Animate counters ──────────────────────────────────────────────────────
    useEffect(() => {
        if (data) {
            animateCounter(data.totalFaculty, setAnimatedFaculty, 0);
            animateCounter(data.totalPapers, setAnimatedPapers, 0);
            animateCounter(data.ratio, setAnimatedRatio, 2);
        }
    }, [data]);

    // ── Filter + display faculty ──────────────────────────────────────────────
    const filteredFaculty: FacultyEntry[] = (data?.faculty ?? []).filter((f) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
            f.faculty_name.toLowerCase().includes(q) ||
            String(f.scopus_id).includes(q) ||
            (f.faculty_id?.toLowerCase().includes(q) ?? false) ||
            (f.department?.toLowerCase().includes(q) ?? false)
        );
    });

    const ratioVal = data?.ratio ?? 0;
    const displayedFaculty = filteredFaculty.filter((f) =>
        viewMode === "above" ? f.paper_count >= ratioVal : f.paper_count < ratioVal
    );

    const displayDeptLabel = isHoD
        ? hodDept
        : selectedDept !== "all" ? selectedDept : "All Departments";

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Navbar: full width, outside page wrapper ── */}
            <div className="shared-navbar">
                <a className="shared-logo">
                    <img src={srmLogo} alt="SRM Logo" className="shared-nav-logo" />
                    <span>SRM SP</span>
                </a>
                <UserMenu />
            </div>

            <div className={style.pageWrapper}>
                <div className={style.container}>

                    <button className="shared-back-button" onClick={() => navigate("/dashboard")}>
                        ← Back to Dashboard
                    </button>

                    <h2 className={style.pageTitle}>Paper-to-Faculty Ratio</h2>
                    <p className={style.pageSubtitle}>
                        Track research output per faculty member across departments and years.
                    </p>

                    {/* HoD locked-department badge */}
                    {isHoD && hodDept && (
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "8px 16px", marginBottom: "20px",
                            background: "#e3f2fd", border: "1px solid #90caf9",
                            borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#1565c0",
                        }}>
                            🏢 Showing data for your department: <strong>{hodDept}</strong>
                        </div>
                    )}

                    {/* ── Filters ── */}
                    <div className={style.filterBar}>
                        {/* Year */}
                        <div className={style.filterGroup}>
                            <label className={style.filterLabel}>Year</label>
                            <select className={style.select} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}{y === yearOptions[0] ? " (Current)" : ""}</option>
                                ))}
                            </select>
                        </div>

                        {/* Admin: full department dropdown */}
                        {isAdmin && (
                            <div className={style.filterGroup}>
                                <label className={style.filterLabel}>Department</label>
                                <select className={style.select} value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                                    <option value="all">All Departments</option>
                                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        )}

                        {/* HoD: locked read-only department field */}
                        {isHoD && (
                            <div className={style.filterGroup}>
                                <label className={style.filterLabel}>Department</label>
                                <div style={{
                                    padding: "10px 14px", border: "1.5px solid #90caf9",
                                    borderRadius: "8px", fontSize: "14px", color: "#1565c0",
                                    background: "#e3f2fd", minWidth: "160px",
                                    fontWeight: 700, cursor: "not-allowed",
                                }}>
                                    🔒 {hodDept || "—"}
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className={style.filterGroup} style={{ flex: 1 }}>
                            <label className={style.filterLabel}>Search</label>
                            <div className={style.searchWrapper}>
                                <svg className={style.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <circle cx="6.5" cy="6.5" r="5" stroke="#8fa3b4" strokeWidth="1.6" />
                                    <path d="M10.5 10.5l3.5 3.5" stroke="#8fa3b4" strokeWidth="1.6" strokeLinecap="round" />
                                </svg>
                                <input
                                    type="text"
                                    className={style.searchInput}
                                    placeholder="Search by name, faculty ID, Scopus ID or department…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── KPI Cards ── */}
                    <div className={style.kpiRow}>
                        <div className={style.kpiCard}>
                            <span className={style.kpiLabel}>Total Faculty</span>
                            <span className={style.kpiValue}>{animatedFaculty}</span>
                            <span className={style.kpiSub}>{displayDeptLabel}</span>
                        </div>
                        <div className={style.kpiCard}>
                            <span className={style.kpiLabel}>Total Papers</span>
                            <span className={style.kpiValue}>{animatedPapers}</span>
                            <span className={style.kpiSub}>Publications in {selectedYear}</span>
                        </div>
                        <div className={style.kpiCard}>
                            <span className={style.kpiLabel}>Papers / Faculty Ratio</span>
                            <span className={style.kpiValue}>{animatedRatio.toFixed(2)}</span>
                            <span className={style.kpiSub}>Average papers per faculty member</span>
                        </div>
                    </div>

                    {/* ── Admin: Dept-wise summary table ── */}
                    {isAdmin && (
                        <DeptStatsTable
                            deptStats={deptStats}
                            onSelectDept={(dept) => setSelectedDept(dept)}
                            selectedDept={selectedDept}
                            loadingDepts={loadingDepts}
                        />
                    )}

                    {/* ── View Mode Toggle + Report Button ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                        <div className={style.toggleBar} style={{ marginBottom: 0 }}>
                            <button
                                className={`${style.toggleBtn} ${viewMode === "above" ? style.active : ""}`}
                                onClick={() => setViewMode("above")}
                            >
                                Above Ratio ≥ {ratioVal.toFixed(2)}
                            </button>
                            <button
                                className={`${style.toggleBtn} ${viewMode === "below" ? style.active : ""}`}
                                onClick={() => setViewMode("below")}
                            >
                                Below Ratio &lt; {ratioVal.toFixed(2)}
                            </button>
                        </div>

                        {/* Download Report Button */}
                        <button
                            onClick={() => generateReport(
                                filteredFaculty, data,
                                selectedYear, searchQuery,
                                ratioVal, displayDeptLabel
                            )}
                            disabled={loading || filteredFaculty.length === 0}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 20px",
                                background: loading || filteredFaculty.length === 0
                                    ? "#e0e7ef"
                                    : "linear-gradient(135deg, #054768 0%, #0a5a8c 100%)",
                                color: loading || filteredFaculty.length === 0 ? "#9aabb8" : "#fff",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "13px",
                                fontWeight: 700,
                                cursor: loading || filteredFaculty.length === 0 ? "not-allowed" : "pointer",
                                boxShadow: loading || filteredFaculty.length === 0
                                    ? "none"
                                    : "0 4px 12px rgba(5,71,104,0.25)",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.3px",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M7.5 1v9M4 7l3.5 3.5L11 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M1 11v2a1 1 0 001 1h11a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                            Download Report
                        </button>
                    </div>

                    {/* ── Faculty Table ── */}
                    <div className={style.tableSection}>
                        <div className={style.tableHeader}>
                            <span className={style.tableTitle}>
                                {viewMode === "above" ? "High Performers" : "Below Average"} — {selectedYear} · {displayDeptLabel}
                            </span>
                            <span className={style.tableCount}>
                                {loading ? "Loading…" : `${displayedFaculty.length} of ${filteredFaculty.length} faculty`}
                            </span>
                        </div>
                        <div className={style.tableWrapper}>
                            {loading ? (
                                <div className={style.loadingWrapper}><div className={style.spinner} />Loading data…</div>
                            ) : error ? (
                                <div className={style.emptyState}>
                                    <span className={style.emptyIcon}>⚠️</span>
                                    <div className={style.emptyText}>{error}</div>
                                </div>
                            ) : displayedFaculty.length === 0 ? (
                                <div className={style.emptyState}>
                                    <span className={style.emptyIcon}>📭</span>
                                    <div className={style.emptyText}>No faculty found matching the current filters.</div>
                                </div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 48 }}>#</th>
                                            <th>Faculty Name</th>
                                            <th>Scopus ID</th>
                                            <th>Department</th>
                                            <th style={{ textAlign: "center" }}>Papers</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedFaculty.map((entry, idx) => (
                                            <FacultyRow
                                                key={`${entry.scopus_id}-${idx}`}
                                                entry={entry}
                                                rank={idx + 1}
                                                onViewPapers={openPapersModal}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Papers Modal (identical structure to PublicationStats) ── */}
            {papersModal.open && papersModal.faculty && (
                <div className={style.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) closePapersModal(); }}>
                    <div className={style.modal} ref={modalRef}>

                        {/* Modal header */}
                        <div className={style.modalHeader}>
                            <div className={style.modalHeaderLeft}>
                                <span className={style.modalIcon}>📄</span>
                                <div>
                                    <h2 className={style.modalTitle}>Papers by this Faculty</h2>
                                    <p className={style.modalSubtitle} title={papersModal.faculty.faculty_name}>
                                        {papersModal.faculty.faculty_name}
                                        {papersModal.faculty.faculty_id ? ` · ${papersModal.faculty.faculty_id}` : ""}
                                    </p>
                                </div>
                            </div>
                            <button className={style.modalClose} onClick={closePapersModal} aria-label="Close">✕</button>
                        </div>

                        {/* Filter chips */}
                        <div className={style.modalFilterChips}>
                            <span className={style.filterChip}>Year: {selectedYear}</span>
                            <span className={style.filterChip}>Dept: {papersModal.faculty.department || "—"}</span>
                            <span className={style.filterChip}>Scopus ID: {papersModal.faculty.scopus_id}</span>
                        </div>

                        {/* Modal body */}
                        <div className={style.modalBody}>
                            <p className={style.modalCount}>
                                Showing <strong>{papersModal.faculty.papers.length}</strong> paper{papersModal.faculty.papers.length !== 1 ? "s" : ""}
                            </p>
                            <div className={style.papersList}>
                                {papersModal.faculty.papers.map((paper, idx) => {
                                    const authors = getAuthors(paper);
                                    return (
                                        <div key={paper.id} className={style.paperCard}>
                                            <div className={style.paperIndex}>{idx + 1}</div>
                                            <div className={style.paperContent}>
                                                <div className={style.paperTitleRow}>
                                                    <h3 className={style.paperTitle}>
                                                        {paper.doi ? (
                                                            <a
                                                                href={`https://doi.org/${paper.doi}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={style.paperTitleLink}
                                                            >
                                                                {paper.title}
                                                            </a>
                                                        ) : paper.title}
                                                    </h3>
                                                </div>
                                                <div className={style.paperMeta}>
                                                    <span className={style.paperTypeBadge}>{formatType(paper.type)}</span>
                                                    <span className={style.paperDate}>📅 {formatDate(paper.date)}</span>
                                                    {paper.doi && (
                                                        <a
                                                            href={`https://doi.org/${paper.doi}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={style.paperDoiLink}
                                                        >
                                                            DOI ↗
                                                        </a>
                                                    )}
                                                </div>
                                                {authors.length > 0 && (
                                                    <div className={style.paperAuthors}>
                                                        <span className={style.paperAuthorsLabel}>Authors:</span>
                                                        <span className={style.paperAuthorsText}>{authors.join(", ")}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className={style.modalFooter}>
                            <button className={style.modalCloseBtn} onClick={closePapersModal}>Close</button>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}