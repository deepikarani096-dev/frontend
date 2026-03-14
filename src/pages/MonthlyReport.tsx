import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import style from "../components/MonthlyReport.module.css";
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
    paper_scopus_id: string;
    paper_year: number;
    paper_month: number;
    author1?: string;
    author2?: string;
    author3?: string;
    author4?: string;
    author5?: string;
    author6?: string;
}

interface MonthlyReportData {
    faculty_id: string | null;
    faculty_name: string;
    scopus_id: string;
    department?: string;
    docs_added: number;
    citations_added: number;
    total_docs: number;
    total_citations: number;
    report_year?: number;
    report_month?: number;
    created_at?: string;
    papers?: Paper[];
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyReport() {
    const [reportData, setReportData] = useState<MonthlyReportData[]>([]);
    const [filteredData, setFilteredData] = useState<MonthlyReportData[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
    const { getAuthHeaders, isAdmin, isRestrictedFaculty } = useAuth();
    const [departments, setDepartments] = useState<string[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    // Sorting state for Faculty ID
    const [sortField, setSortField] = useState<"faculty_id" | "name">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Papers modal state ───────────────────────────────────────────────────
    const [papersModal, setPapersModal] = useState<{
        open: boolean;
        facultyName: string;
        period: string;
        papers: Paper[];
    }>({ open: false, facultyName: "", period: "", papers: [] });
    const modalRef = useRef<HTMLDivElement>(null);

    // Close modal on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeModal();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    // Lock body scroll when modal open
    useEffect(() => {
        document.body.style.overflow = papersModal.open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [papersModal.open]);

    const openModal = (item: MonthlyReportData) => {
        const period = item.report_month && item.report_year
            ? `${monthNames[item.report_month - 1]} ${item.report_year}`
            : "No Report";
        setPapersModal({
            open: true,
            facultyName: item.faculty_name,
            period,
            papers: item.papers || [],
        });
    };

    const closeModal = () => {
        setPapersModal({ open: false, facultyName: "", period: "", papers: [] });
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) closeModal();
    };

    // ── Existing helpers ─────────────────────────────────────────────────────
    const getFilterSummary = () => {
        const filters: string[] = [];
        if (isAdmin && isAdmin()) {
            filters.push(departmentFilter !== "all" ? `Department: ${departmentFilter}` : "Department: All");
        }
        if (searchQuery.trim()) filters.push(`Search: "${searchQuery.trim()}"`);
        return filters.length > 0 ? filters.join(" | ") : "No filters applied";
    };

    // ──────────────────────────────────────────────────────────────────────────
    // SORTING LOGIC
    // ──────────────────────────────────────────────────────────────────────────
    const handleSort = (field: "faculty_id" | "name") => {
        if (sortField === field) {
            setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const SortArrow = ({ field }: { field: "faculty_id" | "name" }) => {
        const active = sortField === field;
        return (
            <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, lineHeight: 1, verticalAlign: "middle" }}>
                <span style={{ fontSize: 9, opacity: active && sortDir === "asc"  ? 1 : 0.3, color: active && sortDir === "asc"  ? "#000347" : "#999" }}>▲</span>
                <span style={{ fontSize: 9, opacity: active && sortDir === "desc" ? 1 : 0.3, color: active && sortDir === "desc" ? "#000347" : "#999" }}>▼</span>
            </span>
        );
    };

    const getSortedData = (list: MonthlyReportData[]) => {
        return [...list].sort((a, b) => {
            let av, bv;
            if (sortField === "faculty_id") {
                av = a.faculty_id || "";
                bv = b.faculty_id || "";
            } else {
                av = a.faculty_name || "";
                bv = b.faculty_name || "";
            }
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    };

    const fetchMonthlyReport = async (dept?: string) => {
        setLoading(true);
        try {
            const headers = getAuthHeaders();
            let url = "https://srm-sp-production.up.railway.app/api/monthly-report-with-papers";
            const effectiveDept = typeof dept !== "undefined" ? dept : departmentFilter;
            if (isAdmin && isAdmin() && effectiveDept && effectiveDept !== "all") {
                url += `?department=${encodeURIComponent(effectiveDept)}`;
            }
            const res = await axios.get(url, { headers });
            setReportData(res.data);
            setFilteredData(res.data);
        } catch (error) {
            console.error("Error fetching monthly report:", error);
            setReportData([]);
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonthlyReport();
        if (isAdmin && isAdmin()) fetchDepartments();
        if (isRestrictedFaculty && isRestrictedFaculty()) window.location.href = "/";
    }, []);

    useEffect(() => {
        if (isAdmin && isAdmin()) fetchMonthlyReport();
    }, [departmentFilter]);

    // Close download menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showDownloadMenu && !target.closest(`.${style.downloadButtonContainer}`)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showDownloadMenu]);

    // Handle search
    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredData(reportData);
        } else {
            const filtered = reportData.filter((item) =>
                (item.faculty_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.faculty_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.scopus_id.toString().includes(searchQuery)
            );
            setFilteredData(filtered);
        }
    }, [searchQuery, reportData]);

    const clearSearch = () => setSearchQuery("");

    const fetchDepartments = async () => {
        try {
            const headers = getAuthHeaders();
            const res = await axios.get("https://srm-sp-production.up.railway.app/api/faculty", { headers });
            const faculties = Array.isArray(res.data) ? res.data : [];
            const unique = Array.from(new Set(faculties.map((f: any) => f.department).filter(Boolean)));
            setDepartments(unique);
        } catch (err) {
            console.error("Failed to fetch departments:", err);
            setDepartments([]);
        }
    };

    const sortByFacultyId = (data: MonthlyReportData[]): MonthlyReportData[] => {
        return [...data].sort((a, b) => (a.faculty_id || "").localeCompare(b.faculty_id || ""));
    };

    const getAllAuthors = (paper: Paper): string[] => {
        return [paper.author1, paper.author2, paper.author3, paper.author4, paper.author5, paper.author6]
            .filter((a): a is string => Boolean(a));
    };

    const formatIEEECitation = (paper: Paper): string => {
        const authors = getAllAuthors(paper);
        let authorsText = "";
        if (authors.length === 0) {
            authorsText = "Unknown Author";
        } else if (authors.length === 1) {
            authorsText = authors[0];
        } else if (authors.length === 2) {
            authorsText = `${authors[0]} and ${authors[1]}`;
        } else {
            const lastAuthor = authors[authors.length - 1];
            authorsText = `${authors.slice(0, -1).join(", ")}, and ${lastAuthor}`;
        }
        const year = new Date(paper.date).getFullYear();
        const type = paper.type.toLowerCase();
        let citation = `${authorsText}, "${paper.title}," `;
        if (type.includes("journal") || type.includes("article")) {
            citation += `${paper.publication_name}, ${year}.`;
        } else if (type.includes("conference") || type.includes("proceeding")) {
            citation += paper.publication_name.toLowerCase().includes("proc")
                ? `in ${paper.publication_name}, ${year}.`
                : `in Proc. ${paper.publication_name}, ${year}.`;
        } else if (type.includes("book") || type.includes("chapter")) {
            citation += `in ${paper.publication_name}, ${year}.`;
        } else {
            citation += `${paper.publication_name}, ${year}.`;
        }
        return citation;
    };

    const getUniquePapers = (data: MonthlyReportData[]): Paper[] => {
        const paperMap = new Map<string, Paper>();
        data.forEach(item => {
            (item.papers || []).forEach(paper => {
                const key = paper.doi || paper.title;
                if (!paperMap.has(key)) paperMap.set(key, paper);
            });
        });
        return Array.from(paperMap.values());
    };

    // ── Download helpers (unchanged) ─────────────────────────────────────────
    const downloadPapersPDF = () => {
        if (filteredData.length === 0) { alert("No data available to download"); return; }
        const filterInfo = getFilterSummary();
        const uniquePapers = getUniquePapers(filteredData);
        let htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>IEEE Style References</title>
<style>
@media print { @page { margin: 1in; } }
body { font-family: 'Times New Roman', Times, serif; line-height: 1.6; margin: 40px; color: #000; max-width: 8.5in; }
h1 { text-align: center; font-size: 24px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 10px; }
.filter-info { text-align: center; font-size: 12px; color: #666; margin-bottom: 30px; font-style: italic; }
.reference { margin-bottom: 15px; text-align: justify; text-indent: -30px; padding-left: 30px; }
.ref-number { font-weight: bold; margin-right: 5px; }
</style></head><body>
<h1>IEEE Style References</h1>
<div class="filter-info">Filters Applied: ${filterInfo}</div>`;
        uniquePapers.forEach((paper, i) => {
            htmlContent += `<div class="reference"><span class="ref-number">[${i + 1}]</span>${formatIEEECitation(paper)}</div>\n`;
        });
        htmlContent += `</body></html>`;
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Monthly_Report_References.html");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowDownloadMenu(false);
    };

    const downloadCountReport = () => {
        if (filteredData.length === 0) { alert("No data available to download"); return; }
        const filterInfo = getFilterSummary();
        const sortedData = sortByFacultyId(filteredData);
        let csvContent = `Monthly Report - Count Summary\nFilters Applied: ${filterInfo}\n\n`;
        csvContent += "Author Name,Faculty ID,Scopus ID,Department,Period,Docs Added,Citations Added\n";
        sortedData.forEach(item => {
            csvContent += [
                `"${item.faculty_name}"`,
                `"${item.faculty_id || "N/A"}"`,
                `"${item.scopus_id}"`,
                `"${item.department || "N/A"}"`,
                `"${item.report_month && item.report_year ? `${monthNames[item.report_month - 1]} ${item.report_year}` : "No Report"}"`,
                item.docs_added,
                item.citations_added,
            ].join(",") + "\n";
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Monthly_Report_Count.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowDownloadMenu(false);
    };

    const downloadCombinedPDF = () => {
        if (filteredData.length === 0) { alert("No data available to download"); return; }
        const filterInfo = getFilterSummary();
        const uniquePapers = getUniquePapers(filteredData);
        const sortedData = sortByFacultyId(filteredData);
        let htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Monthly Report - Complete</title>
<style>
@media print { @page { margin: 0.75in; } body { margin: 0; } }
body { font-family: Arial, sans-serif; line-height: 1.5; margin: 40px; color: #333; max-width: 8.5in; }
h1 { text-align: center; font-size: 24px; margin-bottom: 10px; border-bottom: 3px solid #2c3e50; padding-bottom: 15px; color: #2c3e50; }
.filter-info { text-align: center; font-size: 13px; color: #7f8c8d; margin-bottom: 20px; padding: 10px; background-color: #ecf0f1; border-radius: 5px; font-weight: 500; }
.report-date { text-align: center; color: #95a5a6; font-size: 11px; margin-bottom: 30px; }
h2 { font-size: 16px; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #3498db; padding-left: 10px; color: #2c3e50; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
th { background-color: #34495e; color: white; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #2c3e50; }
td { padding: 8px 10px; border: 1px solid #bdc3c7; }
tr:nth-child(even) { background-color: #ecf0f1; }
.reference { margin-bottom: 12px; text-align: justify; text-indent: -25px; padding-left: 25px; page-break-inside: avoid; line-height: 1.6; }
.ref-number { font-weight: bold; color: #2c3e50; margin-right: 5px; }
</style></head><body>
<h1>Monthly Report - Complete</h1>
<div class="filter-info">📋 Filters Applied: ${filterInfo}</div>
<div class="report-date">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
<h2>📊 Summary Statistics (Sorted by Faculty ID)</h2>
<table><thead><tr><th>Author Name</th><th>Faculty ID</th><th>Scopus ID</th><th>Department</th><th>Period</th><th>Docs Added</th><th>Citations Added</th></tr></thead><tbody>`;
        sortedData.forEach(item => {
            htmlContent += `<tr><td>${item.faculty_name}</td><td>${item.faculty_id || "N/A"}</td><td>${item.scopus_id}</td><td>${item.department || "N/A"}</td><td>${item.report_month && item.report_year ? `${monthNames[item.report_month - 1]} ${item.report_year}` : "No Report"}</td><td>${item.docs_added}</td><td>${item.citations_added}</td></tr>`;
        });
        htmlContent += `</tbody></table><h2>📚 References in IEEE Format</h2>`;
        if (uniquePapers.length > 0) {
            uniquePapers.forEach((paper, i) => {
                htmlContent += `<div class="reference"><span class="ref-number">[${i + 1}]</span>${formatIEEECitation(paper)}</div>\n`;
            });
        } else {
            htmlContent += `<p style="color:#7f8c8d;font-style:italic;">No papers found in the selected data.</p>`;
        }
        htmlContent += `</body></html>`;
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Monthly_Report.html");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowDownloadMenu(false);
    };

    // ── Format date helper ───────────────────────────────────────────────────
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    };

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className={style.pageWrapper}>
            {/* Navbar */}
            <div className="shared-navbar">
                <div className="shared-logo">
                    <img src={srmLogo} alt="SRM Logo" className={style.navLogo} />
                    <span>SRM SP</span>
                </div>
                <UserMenu />
            </div>

            <div className={style.mainContentContainer}>
                <div className={style.container}>
                    <div className={style.contentCard}>
                        {/* Header - Back button and title */}
                        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
                            <Link to="/dashboard" className="shared-back-button">
                                ← Back to Dashboard
                            </Link>
                        </div>
                        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                            <h1 style={{ 
                                fontSize: "2.6rem", 
                                fontWeight: "400", 
                                color: "#0d1f3c",
                                fontFamily: "'DM Serif Display', Georgia, serif",
                                margin: "0 0 0.5rem 0",
                                paddingBottom: "1rem",
                                borderBottom: "2px solid #b8975a",
                                display: "inline-block"
                            }}>Faculty Monthly Report</h1>
                            <p style={{ 
                                fontSize: "1rem", 
                                color: "#4a5568",
                                margin: "0.5rem 0 0 0"
                            }}>
                                View monthly publication and citation data for all faculty members
                            </p>
                        </div>

                        {/* Filters Section */}
                        <div className={style.filtersSection}>
                            <div className={style.filtersHeader}>
                                <h3 className={style.filtersTitle}>Search & Filter</h3>
                                <div className={style.downloadButtonContainer}>
                                    <button
                                        className={style.downloadButton}
                                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                        disabled={filteredData.length === 0}
                                    >
                                        <span className={style.downloadIcon}>📥</span>
                                        Download Report
                                        <span className={style.dropdownArrow}>{showDownloadMenu ? "▲" : "▼"}</span>
                                    </button>
                                    {showDownloadMenu && (
                                        <div className={style.downloadMenu}>
                                            <button className={style.downloadMenuItem} onClick={downloadCombinedPDF}>
                                                <span className={style.menuIcon}>📋</span>
                                                <div className={style.menuItemContent}>
                                                    <span className={style.menuItemTitle}>Complete Report</span>
                                                    <span className={style.menuItemDesc}>Count summary + IEEE citations</span>
                                                </div>
                                            </button>
                                            <button className={style.downloadMenuItem} onClick={downloadPapersPDF}>
                                                <span className={style.menuIcon}>📄</span>
                                                <div className={style.menuItemContent}>
                                                    <span className={style.menuItemTitle}>References</span>
                                                    <span className={style.menuItemDesc}>IEEE citations only</span>
                                                </div>
                                            </button>
                                            <button className={style.downloadMenuItem} onClick={downloadCountReport}>
                                                <span className={style.menuIcon}>📈</span>
                                                <div className={style.menuItemContent}>
                                                    <span className={style.menuItemTitle}>Count Report</span>
                                                    <span className={style.menuItemDesc}>Summary with counts only</span>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={style.filtersContainer}>
                                <div className={style.searchContainer}>
                                    <div className={style.searchBox}>
                                        <div className={style.searchIcon}>🔍</div>
                                        <input
                                            type="text"
                                            placeholder="Search by name, faculty ID, or Scopus ID..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className={style.searchInput}
                                        />
                                        {searchQuery && (
                                            <button className={style.clearButton} onClick={clearSearch} type="button">
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isAdmin && isAdmin() && (
                                    <div style={{ marginLeft: 12 }}>
                                        <label style={{ marginRight: 8 }}>Department:</label>
                                        <select
                                            value={departmentFilter}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setDepartmentFilter(v);
                                                fetchMonthlyReport(v);
                                            }}
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className={style.filterSummaryBar}>
                                <span className={style.filterSummaryLabel}>📋 Active Filters:</span>
                                <span className={style.filterSummaryText}>{getFilterSummary()}</span>
                            </div>

                            <div className={style.resultsSummary}>
                                {!loading && (
                                    <span className={style.resultsCount}>
                                        {filteredData.length} {filteredData.length === 1 ? "record" : "records"} found
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Table Section */}
                        <div className={style.tableSection}>
                            <div className={style.tableContainer}>
                                <table className={style.authorTable}>
                                    <thead>
                                        <tr>
                                            <th className={style.nameColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>👤</span>Author Name
                                                </div>
                                            </th>
                                            <th 
                                                className={style.scopusColumn}
                                                onClick={() => handleSort("faculty_id")}
                                                style={{ cursor: "pointer", userSelect: "none" }}
                                            >
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>🆔</span>Faculty ID
                                                    <SortArrow field="faculty_id" />
                                                </div>
                                            </th>
                                            <th className={style.scopusColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>🔢</span>Scopus ID
                                                </div>
                                            </th>
                                            <th className={style.departmentColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>🏢</span>Department
                                                </div>
                                            </th>
                                            <th className={style.hindexColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>📅</span>Period
                                                </div>
                                            </th>
                                            <th className={style.hindexColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>📄</span>Docs Added
                                                </div>
                                            </th>
                                            <th className={style.hindexColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>📈</span>Citations Added
                                                </div>
                                            </th>
                                            <th className={style.hindexColumn}>
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>📋</span>Papers
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className={style.loadingCell}>
                                                    <div className={style.loadingContent}>
                                                        <div className={style.spinner}></div>
                                                        <span>Loading monthly report...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredData.length > 0 ? (
                                            getSortedData(filteredData).map((item, index) => (
                                                <tr
                                                    key={`${item.scopus_id}-${index}`}
                                                    className={style.authorRow}
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    <td className={style.nameCell}>
                                                        <div className={style.authorInfo}>
                                                            <div className={style.authorAvatar}>
                                                                {item.faculty_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className={style.authorName}>{item.faculty_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className={style.scopusCell}>
                                                        <span className={style.scopusId}>{item.faculty_id || "N/A"}</span>
                                                    </td>
                                                    <td className={style.scopusCell}>
                                                        <span className={style.scopusId}>{item.scopus_id}</span>
                                                    </td>
                                                    <td className={style.departmentCell}>
                                                        <span className={style.departmentBadge}>{item.department || "N/A"}</span>
                                                    </td>
                                                    <td className={style.hindexCell}>
                                                        <div className={style.periodBadge}>
                                                            {item.report_month && item.report_year
                                                                ? `${monthNames[item.report_month - 1]} ${item.report_year}`
                                                                : "No Report"}
                                                        </div>
                                                    </td>
                                                    <td className={style.hindexCell}>
                                                        <div className={style.countBadge}>{item.docs_added}</div>
                                                    </td>
                                                    <td className={style.hindexCell}>
                                                        <div className={style.countBadge}>{item.citations_added}</div>
                                                    </td>

                                                    {/* ── Papers column: clickable button opens modal ── */}
                                                    <td className={style.hindexCell}>
                                                        {item.papers && item.papers.length > 0 ? (
                                                            <button
                                                                className={style.papersModalBtn}
                                                                onClick={() => openModal(item)}
                                                                title={`View ${item.papers.length} paper${item.papers.length !== 1 ? "s" : ""}`}
                                                            >
                                                                {item.papers.length}
                                                                <span className={style.papersModalArrow}>▾</span>
                                                            </button>
                                                        ) : (
                                                            <span className={style.noPapers}>—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className={style.emptyStateCell}>
                                                    <div className={style.emptyStateContent}>
                                                        <div className={style.emptyStateIcon}>📊</div>
                                                        <h3>No records found</h3>
                                                        <p>Try adjusting your search terms or filters</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Papers Modal
            ══════════════════════════════════════════════════════════════ */}
            {papersModal.open && (
                <div className={style.modalBackdrop} onClick={handleBackdropClick}>
                    <div className={style.modal} ref={modalRef}>
                        {/* Header */}
                        <div className={style.modalHeader}>
                            <div className={style.modalHeaderLeft}>
                                <span className={style.modalIcon}>📄</span>
                                <div>
                                    <h2 className={style.modalTitle}>{papersModal.facultyName}</h2>
                                    <p className={style.modalSubtitle}>
                                        {papersModal.period} · {papersModal.papers.length} paper{papersModal.papers.length !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                            <button className={style.modalClose} onClick={closeModal} aria-label="Close">✕</button>
                        </div>

                        {/* Body */}
                        <div className={style.modalBody}>
                            {papersModal.papers.length === 0 ? (
                                <div className={style.modalEmpty}>
                                    <span>🔍</span>
                                    <p>No papers found for this period.</p>
                                </div>
                            ) : (
                                <>
                                    <p className={style.modalCount}>
                                        Showing <strong>{papersModal.papers.length}</strong> paper{papersModal.papers.length !== 1 ? "s" : ""}
                                    </p>
                                    <div className={style.papersList}>
                                        {papersModal.papers.map((paper, idx) => {
                                            const authors = getAllAuthors(paper);
                                            return (
                                                <div key={idx} className={style.paperCard}>
                                                    <div className={style.paperIndex}>{idx + 1}</div>
                                                    <div className={style.paperContent}>
                                                        {/* Title */}
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
                                                        {/* Meta */}
                                                        <div className={style.paperMeta}>
                                                            <span className={style.paperTypeBadge}>{paper.type}</span>
                                                            <span className={style.paperDate}>📅 {formatDate(paper.date)}</span>
                                                            <span className={style.paperPub}>📖 {paper.publication_name}</span>
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
                                                        {/* Authors */}
                                                        {authors.length > 0 && (
                                                            <div className={style.paperAuthors}>
                                                                <span className={style.paperAuthorsLabel}>Authors: </span>
                                                                <span className={style.paperAuthorsText}>{authors.join(", ")}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={style.modalFooter}>
                            <button className={style.modalCloseBtn} onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}