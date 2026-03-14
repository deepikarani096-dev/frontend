import axios from "axios";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useParams, Link } from "react-router-dom";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import "../components/SharedPageStyles.css";
import style from "../components/AuthorPerformanceDetails.module.css";

// Types and Interfaces
interface ChartRow {
    year: number;
    documents: number;
    citations: number;
}

interface AcademicYearRow {
    academic_year: string;
    document_count: number;
}

interface PerformanceData {
    name: string;
    scopus_id: string;
    h_index?: number;
    chart_data: ChartRow[];
    academic_year_data: AcademicYearRow[];
    consistency_status: 'green' | 'orange' | 'red';
}

// Helper Functions
const getAcademicYearDisplay = (academicYear: string): string => {
    // Parse academic year format like "2022-23" to "July 2022 - June 2023"
    const parts = academicYear.split('-');
    if (parts.length === 2) {
        const startYear = parts[0];
        const endYear = parseInt(startYear) + 1;
        return `July ${startYear} - June ${endYear}`;
    }
    return academicYear;
};

const getConsistencyMessage = (status: string): string => {
    const messages: Record<string, string> = {
        green: 'Faculty has been consistent for all 3 academic years (2+ papers each year)',
        orange: 'Faculty has been inconsistent for 1 academic year (less than 2 papers)',
        red: 'Faculty has been inconsistent for more than 1 academic year (less than 2 papers)'
    };
    return messages[status] || '';
};

const getEligibilityStatus = (status: string): string => status === 'green' ? 'Yes' : 'No';

const getEligibilityClass = (status: string): string => 
    status === 'green' ? style.statusEligible : style.statusNotEligible;

// Sub-components
const NavigationBar = () => (
    <div className="shared-navbar">
        <a className="shared-logo">
            <img src={srmLogo} alt="SRM Logo" className={style.navLogo} />
            <span>SRM SP</span>
        </a>
        <UserMenu />
    </div>
);

const PageHeader = () => (
    <div className={style.pageHeader}>
        <div className={style.navigationRow}>
            <Link to="/author-performance" className="shared-back-button">
                ← Back
            </Link>
            <h1 className={style.pageTitle}>Faculty Performance Report</h1>
        </div>
    </div>
);

const AuthorInfoCard = ({ performanceData }: { performanceData: PerformanceData }) => (
    <div className={style.authorInfoBox}>
        <div className={style.authorInfoGrid}>
            <div className={style.authorDetails}>
                <h3>{performanceData.name}</h3>
                <div className={style.authorMeta}>
                    <p><span className={style.metaLabel}>Scopus ID:</span> {performanceData.scopus_id}</p>
                    <p><span className={style.metaLabel}>H-Index:</span> <strong>{performanceData.h_index || 'N/A'}</strong></p>
                </div>
            </div>
            <div className={style.statusInfo}>
                <div className={style.statusLabel}>Eligibility Status</div>
            </div>
            <div className={`${style.statusBadge} ${getEligibilityClass(performanceData.consistency_status)}`}>
                {getEligibilityStatus(performanceData.consistency_status)}
            </div>
        </div>
    </div>
);

const YearwisePublicationsTable = ({ chartData }: { chartData: ChartRow[] }) => (
    <div className={style.tableSection}>
        <h4>
            <div className={style.tableIcon}>📊</div>
            Year-wise Publications and Citations
        </h4>
        <div className={style.tableContainer}>
            <table className={style.table}>
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Documents</th>
                        <th>Citations</th>
                    </tr>
                </thead>
                <tbody>
                    {chartData && chartData.length > 0 ? (
                        chartData.map((row) => (
                            <tr key={row.year}>
                                <td><strong>{row.year}</strong></td>
                                <td><span className={style.dataValue}>{row.documents}</span></td>
                                <td><span className={style.dataValue}>{row.citations}</span></td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className={style.noDataCell}>No chart data available</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const AcademicYearTable = ({ academicYearData }: { academicYearData: AcademicYearRow[] }) => (
    <div className={style.tableSection}>
        <h4>
            <div className={style.tableIcon}>📅</div>
            Academic Year-wise Document Count
        </h4>
        <div className={style.tableContainer}>
            <table className={style.table}>
                <thead>
                    <tr>
                        <th>Academic Year</th>
                        <th>Documents Published</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {academicYearData && academicYearData.length > 0 ? (
                        academicYearData.map((row) => (
                            <tr key={row.academic_year}>
                                <td>
                                    <div className={style.academicYearCell}>
                                        <strong>{getAcademicYearDisplay(row.academic_year)}</strong>
                                    </div>
                                </td>
                                <td>
                                    <span className={style.dataValue}>{row.document_count}</span>
                                </td>
                                <td>
                                    <span className={row.document_count >= 2 ? style.yes : style.no}>
                                        {row.document_count >= 2 ? 'Consistent' : 'Inconsistent'}
                                    </span>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className={style.noDataCell}>No academic year data available</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const ConsistencyIndicator = ({ consistencyStatus }: { consistencyStatus: string }) => (
    <div className={`${style.consistencyBar} ${style[consistencyStatus]}`}>
        <div className={style.consistencyContent}>
            <div className={style.consistencyIcon}>
                {consistencyStatus === 'green' ? '✅' : consistencyStatus === 'orange' ? '⚠️' : '❌'}
            </div>
            <div className={style.consistencyMessage}>
                {getConsistencyMessage(consistencyStatus)}
            </div>
        </div>
    </div>
);

const ErrorState = ({ error }: { error: string }) => (
    <>
        <NavigationBar />
        <div className={style.pageWrapper}>
            <PageHeader />
            <div className={style.contentArea}>
                <div className={style.errorContainer}>
                    <div className={style.errorIcon}>⚠️</div>
                    <h3 className={style.errorTitle}>Error Loading Data</h3>
                    <p className={style.errorMessage}>{error}</p>
                    <Link to="/author-performance" className={style.retryButton}>
                        ← Back to Author List
                    </Link>
                </div>
            </div>
        </div>
    </>
);

const LoadingState = () => (
    <>
        <NavigationBar />
        <div className={style.pageWrapper}>
            <PageHeader />
            <div className={style.contentArea}>
                <div className={style.loadingContainer}>
                    <div className={style.loadingSpinner}></div>
                    <p className={style.loadingText}>Loading performance data...</p>
                </div>
            </div>
        </div>
    </>
);

const NoDataState = () => (
    <>
        <NavigationBar />
        <div className={style.pageWrapper}>
            <PageHeader />
            <div className={style.contentArea}>
                <div className={style.noDataContainer}>
                    <div className={style.noDataIcon}>📊</div>
                    <h3 className={style.noDataTitle}>No Data Available</h3>
                    <p className={style.noDataMessage}>No performance data found for this author.</p>
                    <Link to="/author-performance" className={style.retryButton}>
                        ← Back to Author List
                    </Link>
                </div>
            </div>
        </div>
    </>
);

// Main Component
export default function AuthorPerformanceDetail() {
    const { scopus_id } = useParams<{ scopus_id: string }>();
    const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        const fetchPerformance = async () => {
            if (!scopus_id) {
                setError("No Scopus ID provided");
                setLoading(false);
                return;
            }

            try {
                console.log("Fetching data for scopus_id:", scopus_id);
                const headers = getAuthHeaders();
                const res = await axios.get(
                    `https://srm-sp-production.up.railway.app/api/faculty/author-performance/${scopus_id}`,
                    { headers }
                );
                console.log("Response data:", res.data);
                setPerformanceData(res.data);
                setError(null);
            } catch (error: any) {
                console.error("Error fetching performance:", error);
                
                let errorMessage = "An unexpected error occurred";
                
                if (error.response) {
                    console.error("Response data:", error.response.data);
                    console.error("Response status:", error.response.status);
                    errorMessage = `Server error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`;
                } else if (error.request) {
                    console.error("No response received:", error.request);
                    errorMessage = "No response from server. Check if backend is running on port 5001.";
                } else {
                    console.error("Request setup error:", error.message);
                    errorMessage = `Request error: ${error.message}`;
                }
                
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchPerformance();
    }, [scopus_id]);

    // Render different states
    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} />;
    if (!performanceData) return <NoDataState />;

    // Main render
    return (
        <>
            <NavigationBar />
            <div className={style.pageWrapper}>
                <PageHeader />
                <div className={style.contentArea}>
                    <AuthorInfoCard performanceData={performanceData} />
                    
                    <div className={style.tablesContainer}>
                        <YearwisePublicationsTable chartData={performanceData.chart_data} />
                        <AcademicYearTable academicYearData={performanceData.academic_year_data} />
                    </div>

                    {performanceData.consistency_status && (
                        <ConsistencyIndicator consistencyStatus={performanceData.consistency_status} />
                    )}
                </div>
            </div>
        </>
    );
}