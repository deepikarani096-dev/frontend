import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import GlobalCollabMap from '../components/GlobalCollabMap';
import CombinedSDGDashboard from '../components/CombinedSDGDashboard';
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from '../components/UserMenu';
import '../components/SharedPageStyles.css';
import '../components/AnalyticsPage.css';
import { useAuth } from '../contexts/AuthContext';

interface FacultyBasic {
    faculty_id: string;
    scopus_id?: string;
    scopus_ids?: string[];
    name: string;
    department?: string;
}

interface PaperDetail {
    title: string;
    date: string;
    doi: string;
    subjects: string;
    type?: string;
    publication_name?: string;
}

interface CountryStat {
    country: string;
    count: number;
    papers?: PaperDetail[];
}

interface FacultyCountryData extends FacultyBasic {
    countryStats: CountryStat[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
    { label: String(CURRENT_YEAR),     value: String(CURRENT_YEAR) },
    { label: String(CURRENT_YEAR - 1), value: String(CURRENT_YEAR - 1) },
    { label: String(CURRENT_YEAR - 2), value: String(CURRENT_YEAR - 2) },
    { label: 'All Years',              value: 'all' },
];

const AnalyticsPage: React.FC = () => {
    const { getAuthHeaders, isAdmin } = useAuth();

    const [departments, setDepartments]           = useState<string[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [yearFilter, setYearFilter]             = useState<string>('all');
    const [reportLoading, setReportLoading]       = useState<boolean>(false);
    const [reportError, setReportError]           = useState<string | null>(null);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const headers = getAuthHeaders();
            const res  = await fetch('https://srm-sp-production.up.railway.app/api/faculty', { headers });
            const data = await res.json();
            const unique = Array.from(new Set(
                (Array.isArray(data) ? data : []).map((f: any) => f.department).filter(Boolean)
            )) as string[];
            setDepartments(unique);
        } catch { setDepartments([]); }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (isAdmin && isAdmin()) fetchDepartments();
    }, [isAdmin, fetchDepartments]);

    const generateReport = async () => {
        setReportLoading(true);
        setReportError(null);

        try {
            const headers = getAuthHeaders();

            // 1. Fetch faculty list
            const params = new URLSearchParams();
            if (departmentFilter !== 'all') params.set('department', departmentFilter);
            const facultyRes  = await fetch(`https://srm-sp-production.up.railway.app/api/faculty?${params}`, { headers });
            const facultyList: FacultyBasic[] = await facultyRes.json();

            if (!Array.isArray(facultyList) || facultyList.length === 0) {
                setReportError('No faculty data found for the selected filters.');
                setReportLoading(false);
                return;
            }

            // 2. For each faculty fetch country-stats
            const facultyCountryData: FacultyCountryData[] = await Promise.all(
                facultyList.map(async (f) => {
                    const fid = f.faculty_id || (f.scopus_ids?.[0]) || f.scopus_id || '';
                    if (!fid) return { ...f, countryStats: [] };
                    try {
                        const csParams = new URLSearchParams();
                        if (yearFilter !== 'all') csParams.set('year', yearFilter);
                        const cRes = await fetch(
                            `https://srm-sp-production.up.railway.app/api/faculty/${fid}/country-stats?${csParams}`,
                            { headers }
                        );
                        if (!cRes.ok) return { ...f, countryStats: [] };
                        const cData: CountryStat[] = await cRes.json();
                        return { ...f, countryStats: Array.isArray(cData) ? cData : [] };
                    } catch {
                        return { ...f, countryStats: [] };
                    }
                })
            );

            // 3. Build PDF
            const doc   = new jsPDF('portrait', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const margin    = 16;
            const contentW  = pageW - margin * 2;
            let yPos = margin;

            const addPageIfNeeded = (needed = 10) => {
                if (yPos + needed > pageH - 16) { doc.addPage(); yPos = margin + 4; }
            };

            // ── HEADER ──────────────────────────────────────────────────────────
            doc.setFillColor(0, 3, 71);
            doc.rect(0, 0, pageW, 28, 'F');

            doc.setFillColor(54, 121, 224);
            doc.rect(0, 28, pageW, 2, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text('SRM SP — International Collaboration Report', pageW / 2, 12, { align: 'center' });

            doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageW / 2, 21, { align: 'center' });

            yPos = 36;
            doc.setTextColor(0, 0, 0);

            // ── FILTERS PILL ────────────────────────────────────────────────────
            doc.setFillColor(240, 244, 255);
            doc.roundedRect(margin, yPos, contentW, 12, 3, 3, 'F');
            doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 3, 71);
            doc.text('Filters:', margin + 4, yPos + 7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 40, 40);
            doc.text(
                `Department: ${departmentFilter === 'all' ? 'All Departments' : departmentFilter}     |     Year: ${yearFilter === 'all' ? 'All Years' : yearFilter}`,
                margin + 22, yPos + 7.5
            );
            yPos += 18;

            // ── SUMMARY CARD ────────────────────────────────────────────────────
            const totalFaculty  = facultyCountryData.length;
            const withCollab    = facultyCountryData.filter(f => f.countryStats.length > 0).length;
            const withoutCollab = totalFaculty - withCollab;
            const globalCountMap: Record<string, number> = {};
            facultyCountryData.forEach(f =>
                f.countryStats.forEach(cs => {
                    globalCountMap[cs.country] = (globalCountMap[cs.country] || 0) + cs.count;
                })
            );
            const topCountries = Object.entries(globalCountMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

            const summaryH =
                8 +
                2 +
                9 +
                2 +
                (topCountries.length > 0 ? 5 + topCountries.length * 5.5 : 0) +
                6;

            doc.setFillColor(250, 251, 255);
            doc.setDrawColor(200, 215, 255);
            doc.setLineWidth(0.4);
            doc.roundedRect(margin, yPos, contentW, summaryH, 3, 3, 'FD');

            doc.setFillColor(0, 3, 71);
            doc.roundedRect(margin, yPos, contentW, 8, 3, 3, 'F');
            doc.rect(margin, yPos + 4, contentW, 4, 'F');
            doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Summary', margin + 4, yPos + 5.5);
            doc.setTextColor(0, 0, 0);
            yPos += 10;

            const boxW = (contentW - 8) / 3;
            const statLabels = ['Total Faculty', "With Int'l Collab", 'Without Collab'];
            const statValues = [String(totalFaculty), String(withCollab), String(withoutCollab)];
            const statColors: [number, number, number][] = [
                [54, 121, 224],
                [39, 174, 96],
                [192, 57, 43],
            ];
            statLabels.forEach((lbl, i) => {
                const bx = margin + 2 + i * (boxW + 2);
                doc.setFillColor(...statColors[i]);
                doc.roundedRect(bx, yPos, boxW, 11, 2, 2, 'F');
                doc.setFontSize(12); doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(statValues[i], bx + boxW / 2, yPos + 6, { align: 'center' });
                doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
                doc.text(lbl, bx + boxW / 2, yPos + 10, { align: 'center' });
            });
            doc.setTextColor(0, 0, 0);
            yPos += 15;

            if (topCountries.length > 0) {
                doc.setFontSize(8); doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 3, 71);
                doc.text('Top Collaborating Countries:', margin + 4, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 5.5;
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                topCountries.forEach(([country, count], i) => {
                    const barMaxW = 60;
                    const maxCount = topCountries[0][1];
                    const barW = (count / maxCount) * barMaxW;
                    doc.setFillColor(54, 121, 224);
                    doc.rect(margin + 60, yPos - 3, barW, 3.5, 'F');
                    doc.setTextColor(40, 40, 40);
                    doc.text(`${i + 1}. ${country}`, margin + 4, yPos);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${count}`, margin + 125, yPos);
                    doc.setFont('helvetica', 'normal');
                    yPos += 5.5;
                });
            }
            yPos += 8;

            // ── SECTION DIVIDER ─────────────────────────────────────────────────
            doc.setFillColor(0, 3, 71);
            doc.rect(margin, yPos, contentW, 9, 'F');
            doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Faculty-wise International Collaboration Detail', pageW / 2, yPos + 6, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            yPos += 14;

            // ── TABLE COLUMN CONFIG ──────────────────────────────────────────────
            // Columns: # | Country | Publications  (Share removed)
            const col = {
                num: { x: margin + 2,         w: 8  },
                ctr: { x: margin + 12,         w: 110 },
                pub: { x: margin + 12 + 112,   w: 34 },
            };

            // ── PER-FACULTY DETAIL ───────────────────────────────────────────────
            facultyCountryData.forEach((f, idx) => {
                addPageIfNeeded(28);

                doc.setFillColor(0, 3, 71);
                doc.rect(margin, yPos, contentW, 8, 'F');
                doc.setFillColor(54, 121, 224);
                doc.rect(margin, yPos, 3, 8, 'F');

                doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                const nameText = `${idx + 1}. ${f.name || 'N/A'}`;
                const nameLines = doc.splitTextToSize(nameText, contentW - 10);
                doc.text(nameLines[0], margin + 6, yPos + 5.5);
                doc.setTextColor(0, 0, 0);
                yPos += 10;

                const metaFields: [string, string][] = [
                    ['Faculty ID',   f.faculty_id || 'N/A'],
                    ['Scopus ID(s)', f.scopus_ids?.length ? f.scopus_ids.join(', ') : (f.scopus_id || 'N/A')],
                    ['Department',   f.department || 'N/A'],
                ];

                metaFields.forEach(([label, value]) => {
                    addPageIfNeeded(5);
                    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
                    doc.setTextColor(80, 80, 120);
                    doc.text(`${label}:`, margin + 4, yPos);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(20, 20, 20);
                    const valLines = doc.splitTextToSize(value, contentW - 44);
                    doc.text(valLines, margin + 40, yPos);
                    yPos += Math.max(valLines.length * 4.2, 4.5);
                });
                yPos += 3;

                if (f.countryStats.length === 0) {
                    addPageIfNeeded(8);
                    doc.setFillColor(253, 246, 246);
                    doc.setDrawColor(220, 180, 180);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(margin + 2, yPos, contentW - 4, 7, 2, 2, 'FD');
                    doc.setFontSize(8); doc.setFont('helvetica', 'italic');
                    doc.setTextColor(160, 80, 80);
                    doc.text('No international collaboration recorded for this faculty member.', margin + 5, yPos + 4.5);
                    doc.setTextColor(0, 0, 0);
                    doc.setDrawColor(0, 0, 0);
                    yPos += 10;
                } else {
                    addPageIfNeeded(14);
                    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 3, 71);
                    doc.text('International Collaboration by Country:', margin + 2, yPos);
                    doc.setTextColor(0, 0, 0);
                    yPos += 5;

                    // Table header — # | Country | Publications
                    const tableRowH = 6.5;
                    doc.setFillColor(30, 60, 160);
                    doc.rect(margin + 2, yPos, contentW - 4, tableRowH, 'F');
                    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text('#',            col.num.x, yPos + 4.5);
                    doc.text('Country',      col.ctr.x, yPos + 4.5);
                    doc.text('Publications', col.pub.x, yPos + 4.5);
                    doc.setTextColor(0, 0, 0);
                    yPos += tableRowH;

                    f.countryStats.forEach((cs, ci) => {
                        addPageIfNeeded(6);

                        doc.setFillColor(ci % 2 === 0 ? 246 : 255, ci % 2 === 0 ? 249 : 255, 255);
                        doc.rect(margin + 2, yPos, contentW - 4, tableRowH, 'F');

                        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                        doc.setTextColor(40, 40, 40);
                        doc.text(String(ci + 1),   col.num.x, yPos + 4.5);
                        doc.text(cs.country,        col.ctr.x, yPos + 4.5);
                        doc.text(String(cs.count),  col.pub.x, yPos + 4.5);
                        yPos += tableRowH;

                        // Papers for this country
                        const papers = cs.papers || [];
                        if (papers.length > 0) {
                            yPos += 2;

                            papers.slice(0, 10).forEach((paper, pi) => {
                                const titleText = `${pi + 1}. ${paper.title || 'Untitled'}`;
                                const titleLines2 = doc.splitTextToSize(titleText, contentW - 14);
                                addPageIfNeeded(titleLines2.length * 4.2 + 16);

                                doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
                                doc.setTextColor(15, 20, 80);
                                doc.text(titleLines2, margin + 6, yPos);
                                yPos += titleLines2.length * 4.2;
                                doc.setTextColor(0, 0, 0);

                                if (paper.type) {
                                    const typeLabel = paper.type.trim();
                                    const isConference = /conference/i.test(typeLabel);
                                    const badgeColor: [number, number, number] = isConference
                                        ? [180, 70, 20]
                                        : [30, 110, 60];
                                    const badgeBg: [number, number, number] = isConference
                                        ? [255, 237, 225]
                                        : [220, 245, 230];
                                    const badgeText = isConference ? 'Conference Paper' : 'Journal Paper';
                                    const badgeW = isConference ? 28 : 22;
                                    doc.setFillColor(...badgeBg);
                                    doc.roundedRect(margin + 8, yPos - 0.5, badgeW, 4, 1, 1, 'F');
                                    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
                                    doc.setTextColor(...badgeColor);
                                    doc.text(badgeText, margin + 8 + badgeW / 2, yPos + 2.8, { align: 'center' });
                                    doc.setTextColor(0, 0, 0);
                                    yPos += 5.5;
                                }

                                if (paper.subjects || paper.publication_name) {
                                    const venue = paper.publication_name || paper.subjects || '';
                                    const isConference = /conference/i.test(paper.type || '');
                                    const venuePrefix = isConference ? 'Conference: ' : 'Journal: ';
                                    const venueLines = doc.splitTextToSize(`${venuePrefix}${venue}`, contentW - 18);
                                    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
                                    doc.setTextColor(50, 80, 150);
                                    doc.text(venueLines, margin + 8, yPos);
                                    yPos += venueLines.length * 3.6;
                                }

                                if (paper.date) {
                                    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
                                    doc.setTextColor(100, 100, 100);
                                    doc.text(`Date: ${String(paper.date).slice(0, 10)}`, margin + 8, yPos);
                                    yPos += 3.8;
                                }

                                doc.setTextColor(0, 0, 0);

                                if (pi < Math.min(papers.length, 10) - 1) {
                                    yPos += 1;
                                    doc.setDrawColor(210, 220, 245);
                                    doc.setLineWidth(0.2);
                                    doc.line(margin + 8, yPos, pageW - margin - 8, yPos);
                                    doc.setLineWidth(0.5);
                                    yPos += 2.5;
                                }
                            });

                            if (papers.length > 10) {
                                addPageIfNeeded(5);
                                doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
                                doc.setTextColor(130, 130, 130);
                                doc.text(`  … and ${papers.length - 10} more paper(s) not shown`, margin + 8, yPos);
                                doc.setTextColor(0, 0, 0);
                                yPos += 4.5;
                            }

                            yPos += 3;
                        }
                    });
                }

                yPos += 6;
                if (idx < facultyCountryData.length - 1) {
                    addPageIfNeeded(4);
                    doc.setDrawColor(180, 200, 240);
                    doc.setLineWidth(0.4);
                    doc.line(margin, yPos, pageW - margin, yPos);
                    doc.setLineWidth(0.5);
                    yPos += 7;
                }
            });

            // ── FOOTER ──────────────────────────────────────────────────────────
            const totalPages = (doc.internal as any).getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setFillColor(245, 247, 255);
                doc.rect(0, pageH - 8, pageW, 8, 'F');
                doc.setDrawColor(200, 215, 255);
                doc.setLineWidth(0.3);
                doc.line(0, pageH - 8, pageW, pageH - 8);
                doc.setFontSize(7); doc.setFont('helvetica', 'normal');
                doc.setTextColor(120, 120, 160);
                doc.text(`Page ${p} of ${totalPages}`, margin, pageH - 2.5);
                doc.text('SRM SP Analytics — Confidential', pageW / 2, pageH - 2.5, { align: 'center' });
                doc.text(new Date().toLocaleDateString(), pageW - margin, pageH - 2.5, { align: 'right' });
                doc.setTextColor(0, 0, 0);
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.5);
            }

            const deptLabel = departmentFilter === 'all' ? 'All' : departmentFilter.replace(/\s+/g, '_');
            const yearLabel = yearFilter === 'all' ? 'AllYears' : yearFilter;
            doc.save(`SRM_Collab_Report_${deptLabel}_${yearLabel}.pdf`);

        } catch (err: any) {
            console.error('Report generation failed:', err);
            setReportError(`Failed to generate report: ${err.message || 'Unknown error'}`);
        } finally {
            setReportLoading(false);
        }
    };

    return (
        <div>
            <div className="shared-navbar">
                <a className="shared-logo">
                    <img src={srmLogo} alt="SRM Logo" className="analytics-navLogo" />
                    <span>SRM SP</span>
                </a>
                <UserMenu />
            </div>

            <div className="analytics-container">
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
                    <Link to="/dashboard" className="shared-back-button">&laquo; Back to Dashboard</Link>
                </div>

                <h1 style={{ textAlign: 'center', fontSize: 50, color: '#2980b9' }}>ANALYTICS DASHBOARD</h1>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                    {isAdmin && isAdmin() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>Department:</label>
                            <select
                                value={departmentFilter}
                                onChange={e => setDepartmentFilter(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: '14px', minWidth: '180px' }}
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>Year:</label>
                        <select
                            value={yearFilter}
                            onChange={e => setYearFilter(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: '14px', minWidth: '130px' }}
                        >
                            {YEAR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={generateReport}
                        disabled={reportLoading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '9px 20px',
                            background: reportLoading ? '#888' : '#000347',
                            color: '#fff', border: 'none', borderRadius: 6,
                            fontSize: '14px', fontWeight: 600,
                            cursor: reportLoading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.18)', transition: 'background 0.2s',
                        }}
                    >
                        {reportLoading ? (
                            <>
                                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                Generating…
                            </>
                        ) : <>📄 Generate Report</>}
                    </button>
                </div>

                {reportError && (
                    <div style={{ background: '#fff0f0', border: '1px solid #ffb3b3', borderRadius: 8, padding: '10px 16px', color: '#c0392b', textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
                        {reportError}
                    </div>
                )}

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                <section style={{ marginBottom: 40 }}>
                    <GlobalCollabMap department={departmentFilter} year={yearFilter} />
                </section>
                <section style={{ marginBottom: 40 }}>
                    <CombinedSDGDashboard department={departmentFilter} year={yearFilter} />
                </section>
            </div>
        </div>
    );
};

export default AnalyticsPage;