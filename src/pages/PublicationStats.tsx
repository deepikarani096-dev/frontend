import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import "../components/SharedPageStyles.css";
import styles from "../components/PublicationStats.module.css";
import { useAuth } from "../contexts/AuthContext";

interface PublicationStat {
    publication_name: string;
    type: string;
    count: number;
    impact_factor_2025?: number | null;
    impact_factor_5year?: number | null;
}

interface Paper {
    id: number;
    doi: string | null;
    title: string;
    type: string;
    publication_name: string;
    date: string;
    quartile: string | null;
    author1: string | null;
    author2: string | null;
    author3: string | null;
    author4: string | null;
    author5: string | null;
    author6: string | null;
    affiliation1: string | null;
    affiliation2: string | null;
    affiliation3: string | null;
}

export default function PublicationStats() {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();
    const { getAuthHeaders, isAdmin, isRestrictedFaculty } = useAuth();
    const [publicationType, setPublicationType] = useState<string>("all");
    const [departments, setDepartments] = useState<string[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [publications, setPublications] = useState<PublicationStat[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // ── Papers drill-down state ──────────────────────────────────────────────
    const [papersModal, setPapersModal] = useState<{
        open: boolean;
        publicationName: string;
        papers: Paper[];
        loading: boolean;
        error: string | null;
    }>({
        open: false,
        publicationName: "",
        papers: [],
        loading: false,
        error: null,
    });
    const modalRef = useRef<HTMLDivElement>(null);

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // Close modal on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeModal();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    // Prevent body scroll when modal open
    useEffect(() => {
        if (papersModal.open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [papersModal.open]);

    // ── Fetch publication statistics ─────────────────────────────────────────
    const fetchPublicationStats = async (type: string, year: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (type !== "all") params.append("type", type);
            if (year !== "all") params.append("year", year);
            if (isAdmin && isAdmin() && departmentFilter && departmentFilter !== "all") {
                params.append("department", departmentFilter);
            }
            const headers = getAuthHeaders();
            const res = await axios.get(
                `https://srm-sp-production.up.railway.app/api/publication-stats?${params.toString()}`,
                { headers }
            );
            setPublications(res.data);
        } catch (error) {
            console.error("Error fetching publication statistics:", error);
            setPublications([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const headers = getAuthHeaders();
            const res = await axios.get("https://srm-sp-production.up.railway.app/api/faculty", { headers });
            const faculties = Array.isArray(res.data) ? res.data : [];
            const unique = Array.from(
                new Set(faculties.map((f: any) => f.department).filter(Boolean))
            );
            setDepartments(unique);
        } catch (err) {
            console.error("Failed to fetch departments:", err);
            setDepartments([]);
        }
    };

    // ── Fetch papers for a specific publication ──────────────────────────────
    const fetchPapersForPublication = async (publicationName: string) => {
        setPapersModal({
            open: true,
            publicationName,
            papers: [],
            loading: true,
            error: null,
        });

        try {
            const params = new URLSearchParams();
            params.append("publication_name", publicationName);
            if (publicationType !== "all") params.append("type", publicationType);
            if (selectedYear !== "all") params.append("year", selectedYear);
            if (isAdmin && isAdmin() && departmentFilter !== "all") {
                params.append("department", departmentFilter);
            }

            const headers = getAuthHeaders();
            const res = await axios.get(
                `https://srm-sp-production.up.railway.app/api/publication-papers?${params.toString()}`,
                { headers }
            );
            setPapersModal((prev) => ({
                ...prev,
                papers: res.data,
                loading: false,
            }));
        } catch (error) {
            console.error("Error fetching papers:", error);
            setPapersModal((prev) => ({
                ...prev,
                loading: false,
                error: "Failed to load papers. Please try again.",
            }));
        }
    };

    const closeModal = () => {
        setPapersModal({
            open: false,
            publicationName: "",
            papers: [],
            loading: false,
            error: null,
        });
    };

    // Close modal when clicking backdrop
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) closeModal();
    };

    useEffect(() => {
        fetchPublicationStats(publicationType, selectedYear);
    }, [publicationType, selectedYear, departmentFilter]);

    useEffect(() => {
        if (isAdmin && isAdmin()) fetchDepartments();
        if (isRestrictedFaculty && isRestrictedFaculty()) {
            navigate("/");
        }
    }, [isAdmin, isRestrictedFaculty]);

    // ── Filter & sort ────────────────────────────────────────────────────────
    const filteredPublications = publications
        .filter((pub) =>
            pub.publication_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (a.type === "Journal" && b.type === "Journal") {
                const aIF = parseFloat(a.impact_factor_2025 as any) || 0;
                const bIF = parseFloat(b.impact_factor_2025 as any) || 0;
                return bIF - aIF;
            }
            if (a.type === "Journal" && b.type !== "Journal") return -1;
            if (a.type !== "Journal" && b.type === "Journal") return 1;
            return 0;
        });

    const totalCount = filteredPublications.reduce((sum, pub) => sum + pub.count, 0);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getTypeDisplayName = () => {
        if (publicationType === "all") return "All Types";
        if (publicationType === "Journal") return "Journals";
        if (publicationType === "Conference Proceeding") return "Conferences";
        if (publicationType === "Book") return "Books";
        return "Publications";
    };

    const formatImpactFactor = (value: any) => {
        if (value === null || value === undefined) return "";
        const num = parseFloat(value);
        if (isNaN(num)) return "";
        return num.toFixed(1);
    };

    const formatType = (type: string) => {
        if (type === "Conference Proceeding") return "Conference";
        return type;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    // Collect non-null authors from a paper
    const getAuthors = (paper: Paper): string[] => {
        return [
            paper.author1,
            paper.author2,
            paper.author3,
            paper.author4,
            paper.author5,
            paper.author6,
        ].filter((a): a is string => Boolean(a));
    };

    const getFilterSummary = () => {
        const filters: string[] = [];
        if (publicationType !== "all") {
            if (publicationType === "Journal") filters.push("Type: Journals");
            else if (publicationType === "Conference Proceeding") filters.push("Type: Conferences");
            else if (publicationType === "Book") filters.push("Type: Books");
            else filters.push(`Type: ${publicationType}`);
        } else {
            filters.push("Type: All");
        }
        if (selectedYear !== "all") filters.push(`Year: ${selectedYear}`);
        else filters.push("Year: All");
        if (isAdmin && isAdmin() && departmentFilter !== "all") {
            filters.push(`Department: ${departmentFilter}`);
        } else if (isAdmin && isAdmin()) {
            filters.push("Department: All");
        }
        if (searchTerm.trim()) filters.push(`Search: "${searchTerm.trim()}"`);
        return filters.join(" | ");
    };

    // ── CSV report ───────────────────────────────────────────────────────────
    const generateReport = () => {
        if (filteredPublications.length === 0) {
            alert("No data available to generate report");
            return;
        }
        const filterInfo = getFilterSummary();
        const summaryInfo = [
            `Total ${getTypeDisplayName()}: ${filteredPublications.length}`,
            `Total Publications: ${totalCount}`,
            `Filters Applied: ${filterInfo}`,
        ];
        const headers = ["S.No", "Publication Name", "Type", "Number of Publications"];
        if (publicationType === "all" || publicationType === "Journal") {
            headers.push("Impact Factor 2025");
            headers.push("5-Year Impact Factor");
        }
        const csvRows = filteredPublications.map((pub, index) => {
            const baseData = `${index + 1},"${pub.publication_name.replace(/"/g, '""')}","${pub.type}",${pub.count}`;
            if (publicationType === "all" || publicationType === "Journal") {
                const if2025 = pub.type === "Journal" ? formatImpactFactor(pub.impact_factor_2025) : "";
                const if5year = pub.type === "Journal" ? formatImpactFactor(pub.impact_factor_5year) : "";
                return `${baseData},"${if2025}","${if5year}"`;
            }
            return baseData;
        });
        const csvContent = [
            "Publication Statistics Report",
            "",
            ...summaryInfo,
            "",
            headers.join(","),
            ...csvRows,
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "Publication_Statistics.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className={styles.pageWrapper}>
            {/* Navbar */}
            <div className="shared-navbar">
                <div className="shared-logo" onClick={() => navigate("/")}>
                    <img src={srmLogo} alt="SRM Logo" className={styles.navLogo} />
                    <span>SPM SP</span>
                </div>
                <UserMenu />
            </div>

            <div className={styles.container}>
                <button className="shared-back-button" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                </button>

                <div className={styles.header}>
                    <h1 className={styles.title}>Publication Statistics</h1>
                    <p className={styles.subtitle}>
                        Analyze and explore publication data by journals, conferences, and books
                    </p>
                </div>

                {/* Controls */}
                <div className={styles.controlsContainer}>
                    <div className={styles.controlGroup}>
                        <label className={styles.label}>Publication Type</label>
                        <select
                            className={styles.select}
                            value={publicationType}
                            onChange={(e) => {
                                setPublicationType(e.target.value);
                                setSearchTerm("");
                            }}
                        >
                            <option value="all">All Types</option>
                            <option value="Journal">Journal</option>
                            <option value="Conference Proceeding">Conference</option>
                            <option value="Book">Book</option>
                        </select>
                    </div>

                    <div className={styles.controlGroup}>
                        <label className={styles.label}>Year</label>
                        <select
                            className={styles.select}
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            <option value="all">All Years</option>
                            <option value={currentYear.toString()}>{currentYear}</option>
                            <option value={(currentYear - 1).toString()}>{currentYear - 1}</option>
                            <option value={(currentYear - 2).toString()}>{currentYear - 2}</option>
                        </select>
                    </div>

                    {isAdmin && isAdmin() && (
                        <div className={styles.controlGroup}>
                            <label className={styles.label}>Department</label>
                            <select
                                className={styles.select}
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                            >
                                <option value="all">All Departments</option>
                                {departments.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={styles.controlGroup}>
                        <label className={styles.label}>Search</label>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search publications..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Stats Summary */}
                <div className={styles.summaryContainer}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryIcon}>📚</div>
                        <div className={styles.summaryContent}>
                            <span className={styles.summaryLabel}>Total {getTypeDisplayName()}</span>
                            <span className={styles.summaryValue}>{filteredPublications.length}</span>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryIcon}>📄</div>
                        <div className={styles.summaryContent}>
                            <span className={styles.summaryLabel}>Total Publications</span>
                            <span className={styles.summaryValue}>{totalCount}</span>
                        </div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryIcon}>📅</div>
                        <div className={styles.summaryContent}>
                            <span className={styles.summaryLabel}>Year Filter</span>
                            <span className={styles.summaryValue}>
                                {selectedYear === "all" ? "All" : selectedYear}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Filter summary bar */}
                <div className={styles.filterSummaryBar}>
                    <span className={styles.filterSummaryLabel}>📋 Active Filters:</span>
                    <span className={styles.filterSummaryText}>{getFilterSummary()}</span>
                </div>

                {/* Action buttons */}
                <div className={styles.actionButtons}>
                    <button
                        className={styles.generateButton}
                        onClick={generateReport}
                        disabled={filteredPublications.length === 0}
                    >
                        <span>📊</span>
                        Generate Report (CSV)
                    </button>
                </div>

                {/* ── Publications Table ──────────────────────────────────────── */}
                <div className={styles.tableWrapper}>
                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.spinner}></div>
                            <p>Loading publications...</p>
                        </div>
                    ) : filteredPublications.length > 0 ? (
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th className={styles.tableHeaderNumber}>S.No</th>
                                        <th className={styles.tableHeaderName}>Publication Name</th>
                                        <th className={styles.tableHeaderType}>Type</th>
                                        <th className={styles.tableHeaderCount}>Publications</th>
                                        {(publicationType === "all" || publicationType === "Journal") && (
                                            <>
                                                <th className={styles.tableHeaderImpact}>Impact Factor 2025</th>
                                                <th className={styles.tableHeaderImpact}>5-Year Impact Factor</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPublications.map((pub, index) => (
                                        <tr key={index} className={styles.tableRow}>
                                            <td className={styles.tableCellNumber}>{index + 1}</td>
                                            <td className={styles.tableCellName}>{pub.publication_name}</td>
                                            <td className={styles.tableCellType}>
                                                <span className={styles.typeBadge}>
                                                    {formatType(pub.type)}
                                                </span>
                                            </td>

                                            {/* ── Clickable count badge ── */}
                                            <td className={styles.tableCellCount}>
                                                <button
                                                    className={styles.countBadgeButton}
                                                    title={`View ${pub.count} paper${pub.count !== 1 ? "s" : ""} in "${pub.publication_name}"`}
                                                    onClick={() => fetchPapersForPublication(pub.publication_name)}
                                                >
                                                    {pub.count}
                                                    <span className={styles.countBadgeArrow}>▾</span>
                                                </button>
                                            </td>

                                            {(publicationType === "all" || publicationType === "Journal") && (
                                                <>
                                                    <td className={styles.tableCellImpact}>
                                                        {pub.type === "Journal"
                                                            ? formatImpactFactor(pub.impact_factor_2025)
                                                            : ""}
                                                    </td>
                                                    <td className={styles.tableCellImpact}>
                                                        {pub.type === "Journal"
                                                            ? formatImpactFactor(pub.impact_factor_5year)
                                                            : ""}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🔍</div>
                            <h3>No Publications Found</h3>
                            <p>
                                {searchTerm
                                    ? `No publications matching "${searchTerm}"`
                                    : `No publications available for ${
                                          publicationType === "all" ? "all types" : publicationType
                                      } in ${selectedYear === "all" ? "all years" : selectedYear}`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                Papers Drill-Down Modal
            ════════════════════════════════════════════════════════════════ */}
            {papersModal.open && (
                <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
                    <div className={styles.modal} ref={modalRef}>
                        {/* Modal header */}
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <span className={styles.modalIcon}>📄</span>
                                <div>
                                    <h2 className={styles.modalTitle}>Papers in this Publication</h2>
                                    <p className={styles.modalSubtitle} title={papersModal.publicationName}>
                                        {papersModal.publicationName}
                                    </p>
                                </div>
                            </div>
                            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">
                                ✕
                            </button>
                        </div>

                        {/* Active filter chips */}
                        <div className={styles.modalFilterChips}>
                            {publicationType !== "all" && (
                                <span className={styles.filterChip}>
                                    Type: {formatType(publicationType)}
                                </span>
                            )}
                            {selectedYear !== "all" && (
                                <span className={styles.filterChip}>Year: {selectedYear}</span>
                            )}
                            {isAdmin && isAdmin() && departmentFilter !== "all" && (
                                <span className={styles.filterChip}>Dept: {departmentFilter}</span>
                            )}
                        </div>

                        {/* Modal body */}
                        <div className={styles.modalBody}>
                            {papersModal.loading ? (
                                <div className={styles.modalLoading}>
                                    <div className={styles.spinner}></div>
                                    <p>Loading papers…</p>
                                </div>
                            ) : papersModal.error ? (
                                <div className={styles.modalError}>
                                    <span>⚠️</span>
                                    <p>{papersModal.error}</p>
                                    <button
                                        className={styles.retryButton}
                                        onClick={() => fetchPapersForPublication(papersModal.publicationName)}
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : papersModal.papers.length === 0 ? (
                                <div className={styles.modalEmpty}>
                                    <span>🔍</span>
                                    <p>No papers found for the current filters.</p>
                                </div>
                            ) : (
                                <>
                                    <p className={styles.modalCount}>
                                        Showing <strong>{papersModal.papers.length}</strong> paper
                                        {papersModal.papers.length !== 1 ? "s" : ""}
                                    </p>

                                    <div className={styles.papersList}>
                                        {papersModal.papers.map((paper, idx) => {
                                            const authors = getAuthors(paper);
                                            return (
                                                <div key={paper.id} className={styles.paperCard}>
                                                    {/* Index badge */}
                                                    <div className={styles.paperIndex}>{idx + 1}</div>

                                                    <div className={styles.paperContent}>
                                                        {/* Title + DOI link */}
                                                        <div className={styles.paperTitleRow}>
                                                            <h3 className={styles.paperTitle}>
                                                                {paper.doi ? (
                                                                    <a
                                                                        href={`https://doi.org/${paper.doi}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={styles.paperTitleLink}
                                                                    >
                                                                        {paper.title}
                                                                    </a>
                                                                ) : (
                                                                    paper.title
                                                                )}
                                                            </h3>
                                                        </div>

                                                        {/* Meta row: type · date · quartile */}
                                                        <div className={styles.paperMeta}>
                                                            <span className={styles.paperTypeBadge}>
                                                                {formatType(paper.type)}
                                                            </span>
                                                            <span className={styles.paperDate}>
                                                                📅 {formatDate(paper.date)}
                                                            </span>
                                                            {/* {paper.quartile && (
                                                                <span
                                                                    className={`${styles.paperQuartile} ${
                                                                        styles[`quartile${paper.quartile}`] ?? ""
                                                                    }`}
                                                                >
                                                                    {paper.quartile}
                                                                </span>
                                                            )} */}
                                                            {paper.doi && (
                                                                <a
                                                                    href={`https://doi.org/${paper.doi}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={styles.paperDoiLink}
                                                                >
                                                                    DOI ↗
                                                                </a>
                                                            )}
                                                        </div>

                                                        {/* Authors */}
                                                        {authors.length > 0 && (
                                                            <div className={styles.paperAuthors}>
                                                                <span className={styles.paperAuthorsLabel}>
                                                                    Authors:
                                                                </span>
                                                                <span className={styles.paperAuthorsText}>
                                                                    {authors.join(", ")}
                                                                </span>
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

                        {/* Modal footer */}
                        <div className={styles.modalFooter}>
                            <button className={styles.modalCloseBtn} onClick={closeModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}