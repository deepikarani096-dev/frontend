import axios from "axios";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import style from "../components/AuthorPerformance.module.css";
import "../components/SharedPageStyles.css";
import srmLogoN from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";

interface Author {
    scopus_id: string;
    faculty_id?: string;
    name: string;
    h_index?: number;
}

type SortField = "name" | "faculty_id" | "scopus_id" | "h_index";
type SortDir   = "asc" | "desc";

export default function AuthorPerformance() {
    const [searchTerm, setSearchTerm]         = useState("");
    const [authors, setAuthors]               = useState<Author[]>([]);
    const [loading, setLoading]               = useState(false);
    const [hIndexFilter, setHIndexFilter]     = useState("none");
    const [sortField, setSortField]           = useState<SortField>("name");
    const [sortDir, setSortDir]               = useState<SortDir>("asc");
    const navigate = useNavigate();
    const { getAuthHeaders, isAdmin, isRestrictedFaculty } = useAuth();
    const [departments, setDepartments]       = useState<string[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    useEffect(() => { window.scrollTo(0, 0); }, []);

    useEffect(() => {
        fetchAuthors("", "none");
        if (isAdmin && isAdmin()) fetchDepartments();
        if (isRestrictedFaculty && isRestrictedFaculty()) navigate("/");
    }, []);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            fetchAuthors(searchTerm.trim(), hIndexFilter);
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [searchTerm, hIndexFilter, departmentFilter]);

    const fetchAuthors = async (term: string, hIndex: string) => {
        try {
            setLoading(true);
            const params: any = { search: term };
            if (hIndex !== "none") params.h_index_filter = hIndex;
            const headers = getAuthHeaders();
            if (isAdmin && isAdmin() && departmentFilter && departmentFilter !== "all") {
                params.department = departmentFilter;
            }
            const res = await axios.get(`https://srm-sp-production.up.railway.app/api/faculty/author-list`, {
                params,
                headers,
            });
            setAuthors(res.data || []);
        } catch (error) {
            console.error("Error fetching authors:", error);
            setAuthors([]);
        } finally {
            setLoading(false);
        }
    };

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

    // ── Sorting ──────────────────────────────────────────────────────────────
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const sortedAuthors = [...authors].sort((a, b) => {
        let av: any;
        let bv: any;
        if (sortField === "h_index") {
            av = a.h_index ?? -1;
            bv = b.h_index ?? -1;
        } else if (sortField === "faculty_id") {
            av = a.faculty_id ?? "";
            bv = b.faculty_id ?? "";
        } else if (sortField === "scopus_id") {
            av = a.scopus_id ?? "";
            bv = b.scopus_id ?? "";
        } else {
            av = a.name?.toLowerCase() ?? "";
            bv = b.name?.toLowerCase() ?? "";
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
    });

    // ── Sort arrows only on faculty_id and h_index ──────────────────────────
    const SORTABLE: SortField[] = ["faculty_id", "h_index"];

    const SortArrow = ({ field }: { field: SortField }) => {
        if (!SORTABLE.includes(field)) return null;
        const active = sortField === field;
        return (
            <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, lineHeight: 1, verticalAlign: "middle" }}>
                <span style={{ fontSize: 9, opacity: active && sortDir === "asc"  ? 1 : 0.3, color: active && sortDir === "asc"  ? "#000347" : "#999" }}>▲</span>
                <span style={{ fontSize: 9, opacity: active && sortDir === "desc" ? 1 : 0.3, color: active && sortDir === "desc" ? "#000347" : "#999" }}>▼</span>
            </span>
        );
    };

    const thStyle = (field: SortField): React.CSSProperties => ({
        cursor: SORTABLE.includes(field) ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        background: SORTABLE.includes(field) && sortField === field ? "#eef2ff" : undefined,
    });

    const clearSearch       = () => setSearchTerm("");
    const clearHIndexFilter = () => setHIndexFilter("none");

    const getFilterDisplayText = (filter: string) => {
        const map: Record<string, string> = {
            "1-3": "H-Index: 1-3", "4-6": "H-Index: 4-6",
            "7-9": "H-Index: 7-9", "10-12": "H-Index: 10-12", "12+": "H-Index: 12+",
        };
        return map[filter] || filter;
    };

    const hasActiveFilters = searchTerm.trim() !== "" || hIndexFilter !== "none";

    return (
        <div className={style.pageWrapper}>
            {/* Navbar */}
            <div className="shared-navbar">
                <div className="shared-logo">
                    <img src={srmLogoN} alt="SRM Logo" className={style.navLogo} />
                    <span>SRM SP</span>
                </div>
                <UserMenu />
            </div>

            <div className={style.mainContentContainer}>
                <div className={style.container}>
                    <div className={style.contentCard}>

                        {/* Back Button */}
                        <div className={style.backButtonContainer}>
                            <Link to="/dashboard" className="shared-back-button">
                                <span className={style.backIcon}>←</span>
                                Back to Dashboard
                            </Link>
                        </div>

                        {/* Title */}
                        <div className={style.titleSection}>
                            <h2 className={style.pageTitle}>Faculty Yearly Performance</h2>
                            <p className={style.pageSubtitle}>
                                Search and filter faculty members by their research performance
                            </p>
                        </div>

                        {/* Filters Section */}
                        <div className={style.filtersSection}>
                            <div className={style.filtersContainer}>
                                {/* Search */}
                                <div className={style.searchContainer}>
                                    <div className={style.searchBox}>
                                        <div className={style.searchIcon}>🔍</div>
                                        <input
                                            type="text"
                                            placeholder="Search by name or Scopus ID..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className={style.searchInput}
                                        />
                                        {searchTerm && (
                                            <button className={style.clearButton} onClick={clearSearch} type="button">✕</button>
                                        )}
                                    </div>
                                </div>

                                {/* H-Index Filter */}
                                <div className={style.filterContainer}>
                                    <div className={style.filterBox}>
                                        <div className={style.filterIcon}>📊</div>
                                        <label htmlFor="hIndexFilter" className={style.filterLabel}>H-Index Range</label>
                                        <select
                                            id="hIndexFilter"
                                            value={hIndexFilter}
                                            onChange={e => setHIndexFilter(e.target.value)}
                                            className={style.filterSelect}
                                        >
                                            <option value="none">All Ranges</option>
                                            <option value="1-3">1 - 3</option>
                                            <option value="4-6">4 - 6</option>
                                            <option value="7-9">7 - 9</option>
                                            <option value="10-12">10 - 12</option>
                                            <option value="12+">12+</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Department filter (Admin only) */}
                                {isAdmin && isAdmin() && (
                                    <div style={{ marginLeft: 12 }}>
                                        <label style={{ marginRight: 8 }}>Department:</label>
                                        <select
                                            value={departmentFilter}
                                            onChange={e => setDepartmentFilter(e.target.value)}
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Active Filters */}
                            {hasActiveFilters && (
                                <div className={style.activeFiltersSection}>
                                    <div className={style.activeFiltersHeader}>
                                        <span className={style.activeFiltersIcon}>🏷️</span>
                                        Active Filters:
                                    </div>
                                    <div className={style.activeFiltersList}>
                                        {searchTerm.trim() && (
                                            <div className={`${style.activeFilterChip} ${style.searchChip}`}>
                                                <span className={style.filterChipIcon}>🔍</span>
                                                <span className={style.filterChipText}>Search: "{searchTerm.trim()}"</span>
                                                <button className={style.filterChipClose} onClick={clearSearch} type="button">✕</button>
                                            </div>
                                        )}
                                        {hIndexFilter !== "none" && (
                                            <div className={`${style.activeFilterChip} ${style.hIndexChip}`}>
                                                <span className={style.filterChipIcon}>📊</span>
                                                <span className={style.filterChipText}>{getFilterDisplayText(hIndexFilter)}</span>
                                                <button className={style.filterChipClose} onClick={clearHIndexFilter} type="button">✕</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Results Summary */}
                            <div className={style.resultsSummary}>
                                {!loading && (
                                    <span className={style.resultsCount}>
                                        {authors.length} {authors.length === 1 ? "author" : "authors"} found
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className={style.tableSection}>
                            <div className={style.tableContainer}>
                                <table className={style.authorTable}>
                                    <thead>
                                        <tr>
                                            {/* Name */}
                                            <th
                                                className={style.nameColumn}
                                                style={thStyle("name")}
                                            >
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>👤</span>
                                                    Name
                                                </div>
                                            </th>

                                            {/* Faculty ID */}
                                            <th
                                                style={{ ...thStyle("faculty_id"), padding: "12px 16px" }}
                                                onClick={() => handleSort("faculty_id")}
                                            >
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>🪪</span>
                                                    Faculty ID
                                                    <SortArrow field="faculty_id" />
                                                </div>
                                            </th>

                                            {/* Scopus ID */}
                                            <th
                                                className={style.scopusColumn}
                                                style={thStyle("scopus_id")}
                                            >
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>🆔</span>
                                                    Scopus ID
                                                </div>
                                            </th>

                                            {/* H-Index */}
                                            <th
                                                className={style.hindexColumn}
                                                style={thStyle("h_index")}
                                                onClick={() => handleSort("h_index")}
                                            >
                                                <div className={style.columnHeader}>
                                                    <span className={style.columnIcon}>📈</span>
                                                    H-Index
                                                    <SortArrow field="h_index" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={4} className={style.loadingCell}>
                                                    <div className={style.loadingContent}>
                                                        <div className={style.spinner}></div>
                                                        <span>Loading authors...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : sortedAuthors.length > 0 ? (
                                            sortedAuthors.map((author, index) => (
                                                <tr
                                                    key={author.scopus_id}
                                                    className={style.authorRow}
                                                    onClick={() => navigate(`/author-performance/${author.scopus_id}`)}
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    {/* Name */}
                                                    <td className={style.nameCell}>
                                                        <div className={style.authorInfo}>
                                                            <div className={style.authorAvatar}>
                                                                {author.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className={style.authorName}>{author.name}</span>
                                                        </div>
                                                    </td>

                                                    {/* Faculty ID */}
                                                    <td style={{ padding: "12px 16px" }}>
                                                        <span style={{
                                                            fontFamily: "monospace",
                                                            fontSize: "13px",
                                                            color: "#374151",
                                                            background: "#f3f4f6",
                                                            padding: "2px 8px",
                                                            borderRadius: "4px",
                                                        }}>
                                                            {author.faculty_id || "—"}
                                                        </span>
                                                    </td>

                                                    {/* Scopus ID */}
                                                    <td className={style.scopusCell}>
                                                        <span className={style.scopusId}>{author.scopus_id}</span>
                                                    </td>

                                                    {/* H-Index */}
                                                    <td className={style.hindexCell}>
                                                        <div className={style.hindexBadge}>
                                                            {author.h_index ?? "N/A"}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className={style.emptyStateCell}>
                                                    <div className={style.emptyStateContent}>
                                                        <div className={style.emptyStateIcon}>🔍</div>
                                                        <h3>No authors found</h3>
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
        </div>
    );
}