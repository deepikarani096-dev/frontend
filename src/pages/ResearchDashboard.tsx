import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import style from "../components/ResearchDashboard.module.css";
import "../components/SharedPageStyles.css";
import srmLogo from "../assets/srmist-logo.png";
import UserMenu from "../components/UserMenu";
import { useAuth } from "../contexts/AuthContext";

interface PublicationData {
  month: string;
  count: number;
}

interface TopAuthor {
  faculty_id?: string;
  scopus_id?: string;
  name: string;
  total_docs?: number;
  timeframe_docs: number;

  journal_count?: number;
  conference_count?: number;
  book_count?: number;

  q1_count?: number;
  q2_count?: number;
  q3_count?: number;
  q4_count?: number;

  high_if_count?: number;
  mid_if_count?: number;
}

interface QuartileData {
  Q1: number;
  Q2: number;
  Q3: number;
  Q4: number;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ResearchDashboard() {
  const [timeframe, setTimeframe] = useState<string>("1y");
  const [year, setYear] = useState<string>("all");
  const [publicationData, setPublicationData] = useState<PublicationData[]>([]);
  const [topAuthors, setTopAuthors] = useState<TopAuthor[]>([]);
  const [quartiles, setQuartiles] = useState<QuartileData>({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animatedPublications, setAnimatedPublications] = useState(0);
  const [animatedAuthors, setAnimatedAuthors] = useState(0);
  const [animatedQuartiles, setAnimatedQuartiles] = useState<QuartileData>({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 });
  const navigate = useNavigate();
  const { getAuthHeaders, user, isAdmin, isHoD, loading } = useAuth();
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [hoveredQuartile, setHoveredQuartile] = useState<string | null>(null);
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);

  // Fetch Top Authors
  const fetchTopAuthors = async (selectedTimeframe: string) => {
    try {
      const headers = getAuthHeaders();
      let url = `https://srm-sp-production.up.railway.app/api/top-author?timeframe=${selectedTimeframe}`;

      if (isAdmin() && departmentFilter && departmentFilter !== 'all') {
        url += `&department=${encodeURIComponent(departmentFilter)}`;
      }

      const res = await axios.get(url, { headers });
      const data = res.data;

      let authors: TopAuthor[] = [];

      if (!data) {
        authors = [];
      } else if (Array.isArray(data)) {
        authors = data.map((a: any) => ({
          faculty_id: a.faculty_id,
          scopus_id: a.scopus_id,
          name: a.faculty_name || 'Unknown',
          timeframe_docs: a.total_score || 0,
          journal_count: a.journal_count || 0,
          conference_count: a.conference_count || 0,
          book_count: a.book_count || 0,
          q1_count: a.q1_count || 0,
          q2_count: a.q2_count || 0,
          q3_count: a.q3_count || 0,
          q4_count: a.q4_count || 0,
          high_if_count: a.high_if_count || 0,
          mid_if_count: a.mid_if_count || 0,
        }));
      } else if (typeof data === 'object') {
        authors = [{
          faculty_id: data.faculty_id,
          scopus_id: data.scopus_id,
          name: data.faculty_name || 'Unknown',
          timeframe_docs: data.total_score || 0,
          journal_count: data.journal_count || 0,
          conference_count: data.conference_count || 0,
          book_count: data.book_count || 0,
          q1_count: data.q1_count || 0,
          q2_count: data.q2_count || 0,
          q3_count: data.q3_count || 0,
          q4_count: data.q4_count || 0,
          high_if_count: data.high_if_count || 0,
          mid_if_count: data.mid_if_count || 0,
        }];
      }

      setTopAuthors(authors);
    } catch (error) {
      console.error("Error fetching top authors:", error);
      setTopAuthors([]);
    }
  };

  // Fetch Publications
  const fetchData = async (selectedTimeframe: string) => {
    try {
      const headers = getAuthHeaders();
      let url = `https://srm-sp-production.up.railway.app/api/publications?timeframe=${selectedTimeframe}`;
      if (isAdmin() && departmentFilter && departmentFilter !== 'all') {
        url += `&department=${encodeURIComponent(departmentFilter)}`;
      }
      const res = await axios.get(url, { headers });
      let sortedData = res.data.sort((a: PublicationData, b: PublicationData) => a.month.localeCompare(b.month));
      if (selectedTimeframe === "2y") sortedData = aggregateDataByYear(sortedData);
      setPublicationData(sortedData);
    } catch (error) {
      console.error("Error fetching publication data:", error);
    }
  };

  // Fetch Quartiles
  const fetchQuartiles = async (selectedYear: string) => {
    try {
      const headers = getAuthHeaders();
      const url =
        selectedYear === "all"
          ? `https://srm-sp-production.up.railway.app/api/quartile-stats${isAdmin() && departmentFilter && departmentFilter !== 'all' ? `?department=${encodeURIComponent(departmentFilter)}` : ''}`
          : `https://srm-sp-production.up.railway.app/api/quartile-stats?year=${selectedYear}${isAdmin() && departmentFilter && departmentFilter !== 'all' ? `&department=${encodeURIComponent(departmentFilter)}` : ''}`;
      const res = await axios.get(url, { headers });
      setQuartiles(res.data);
    } catch (error) {
      console.error("Error fetching quartile data:", error);
    }
  };

  // Fetch list of departments for admin filter
  const fetchDepartments = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get('https://srm-sp-production.up.railway.app/api/faculty', { headers });
      const faculties = Array.isArray(res.data) ? res.data : [];
      const unique = Array.from(new Set(faculties.map((f: any) => f.department).filter(Boolean)));
      setDepartments(unique);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    }
  };

  useEffect(() => {
    fetchTopAuthors(timeframe);
    fetchData(timeframe);
  }, [timeframe]);

  useEffect(() => {
    if (isAdmin()) fetchDepartments();
  }, [isAdmin]);

  useEffect(() => {
    fetchTopAuthors(timeframe);
    fetchData(timeframe);
    if (!isHoD() || (isHoD() && user && user.department)) {
      fetchQuartiles(year);
    }
  }, [departmentFilter, loading]);

  useEffect(() => {
    if (!isHoD() || (isHoD() && user && user.department)) {
      fetchQuartiles(year);
    }
  }, [year, loading]);

  const aggregateDataByYear = (data: PublicationData[]): PublicationData[] => {
    const yearlyData: { [key: string]: number } = {};
    data.forEach(({ month, count }) => {
      const year = month.split("-")[0];
      yearlyData[year] = (yearlyData[year] || 0) + count;
    });
    return Object.entries(yearlyData).map(([year, count]) => ({ month: year, count }));
  };

  const formatLabel = (dateString: string): string => {
    if (!dateString.includes("-")) return dateString;
    const [, month] = dateString.split("-");
    return month ? monthNames[parseInt(month, 10) - 1] : dateString;
  };

  const maxPublications = Math.max(...publicationData.map((d) => d.count), 1);
  const chartHeight = 300;
  const xAxisOffset = 100;
  const yTicks = 5;
  const tickInterval = Math.ceil(maxPublications / yTicks);

  const getBarWidth = () => (timeframe === "6m" ? 96 : timeframe === "2y" ? 180 : 54);
  const getBarSpacing = () => (timeframe === "6m" ? 128 : timeframe === "2y" ? 240 : 72);

  const barWidth = getBarWidth();
  const barSpacing = getBarSpacing();
  const totalPublications = publicationData.reduce((sum, d) => sum + d.count, 0);

  const animateCounter = (target: number, setter: (val: number) => void, duration: number = 800) => {
    let start = 0;
    const increment = target / (duration / 16);
    const step = () => {
      start += increment;
      if (start < target) {
        setter(Math.ceil(start));
        requestAnimationFrame(step);
      } else {
        setter(target);
      }
    };
    requestAnimationFrame(step);
  };

  const animateQuartiles = (target: QuartileData) => {
    Object.keys(target).forEach((key) => {
      animateCounter(target[key as keyof QuartileData], (val) => {
        setAnimatedQuartiles((prev) => ({ ...prev, [key]: val }));
      });
    });
  };

  useEffect(() => {
    animateCounter(totalPublications, setAnimatedPublications);
    animateCounter(topAuthors.length, setAnimatedAuthors);
  }, [totalPublications, topAuthors]);

  useEffect(() => {
    animateQuartiles(quartiles);
  }, [quartiles]);

  // Find the author whose breakdown modal is open
  const modalAuthor = expandedAuthor !== null
    ? topAuthors.find((a, i) => (a.faculty_id || a.scopus_id || i.toString()) === expandedAuthor) ?? null
    : null;

  return (
    <div className={style.pageWrapper}>

      {/* ── SCORE BREAKDOWN MODAL ── */}
      {modalAuthor && (
        <div
          onClick={() => setExpandedAuthor(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn 0.15s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "1.5rem 1.75rem",
              width: "340px",
              maxWidth: "92vw",
              boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
              animation: "slideUp 0.2s ease",
            }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <strong style={{ color: "#1A4D6C", fontSize: "16px" }}>{modalAuthor.name}</strong>
              <button
                onClick={() => setExpandedAuthor(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "#888",
                  lineHeight: 1,
                  padding: "2px 6px",
                  borderRadius: "6px",
                }}
              >
                ✕
              </button>
            </div>

            <strong style={{ color: "#1A4D6C", fontSize: "14px" }}>Score Breakdown</strong>

            {/* Publication Type */}
            <p style={{ margin: "10px 0 4px", fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Publication Type
            </p>
            <div style={rowStyle}>
              <span style={labelStyle}>Journal (×3)</span>
              <span style={valueStyle}>{modalAuthor.journal_count} × 3 = <b>{modalAuthor.journal_count! * 3}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Conference (×1)</span>
              <span style={valueStyle}>{modalAuthor.conference_count} × 1 = <b>{modalAuthor.conference_count! * 1}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Book (×2)</span>
              <span style={valueStyle}>{modalAuthor.book_count} × 2 = <b>{modalAuthor.book_count! * 2}</b></span>
            </div>

            <hr style={dividerStyle} />

            {/* Quartile */}
            <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Quartile
            </p>
            <div style={rowStyle}>
              <span style={labelStyle}>Q1 (×4)</span>
              <span style={valueStyle}>{modalAuthor.q1_count} × 4 = <b>{modalAuthor.q1_count! * 4}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Q2 (×3)</span>
              <span style={valueStyle}>{modalAuthor.q2_count} × 3 = <b>{modalAuthor.q2_count! * 3}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Q3 (×2)</span>
              <span style={valueStyle}>{modalAuthor.q3_count} × 2 = <b>{modalAuthor.q3_count! * 2}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Q4 (×1)</span>
              <span style={valueStyle}>{modalAuthor.q4_count} × 1 = <b>{modalAuthor.q4_count! * 1}</b></span>
            </div>

            <hr style={dividerStyle} />

            {/* Impact Factor */}
            <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Impact Factor
            </p>
            <div style={rowStyle}>
              <span style={labelStyle}>High IF (&gt;7) (×5)</span>
              <span style={valueStyle}>{modalAuthor.high_if_count} × 5 = <b>{modalAuthor.high_if_count! * 5}</b></span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Mid IF (3–7) (×3)</span>
              <span style={valueStyle}>{modalAuthor.mid_if_count} × 3 = <b>{modalAuthor.mid_if_count! * 3}</b></span>
            </div>

            <hr style={dividerStyle} />

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#1A4D6C", fontSize: "15px" }}>Total Score</strong>
              <span style={{
                background: "#1A4D6C",
                color: "#fff",
                padding: "4px 14px",
                borderRadius: "20px",
                fontWeight: 700,
                fontSize: "15px",
              }}>
                {modalAuthor.timeframe_docs}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(18px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div className="shared-navbar">
        <a className="shared-logo">
          <img src={srmLogo} alt="SRM Logo" className={style.navLogo} />
          <span>SPM SP</span>
        </a>
        <UserMenu />
      </div>

      <div className={style.container}>
        <button className="shared-back-button" onClick={() => navigate("/")}>
          Back to Home
        </button>

        <h2 className={style.title}>Turning Research Into Impactful Insights</h2>

        {isHoD() && !isAdmin() && (
          <div style={{ padding: "12px 16px", marginBottom: "16px", backgroundColor: "#e3f2fd", borderRadius: "4px", border: "1px solid #90caf9" }}>
            <span style={{ fontWeight: 600, color: "#1976d2" }}>
              Department: {user?.department || "Loading..."}
            </span>
          </div>
        )}

        <h3 className={style.chartTitle}>Quartile-wise Publications</h3>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <div className={style.dropdown}>
            <select className={style.select} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">All Years</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>
          </div>

          {isAdmin && isAdmin() && (
            <div className={style.dropdown}>
              <select
                className={style.select}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={style.chartContainer}>
          <div className={style.chartBox}>
            <svg width="100%" height="275" viewBox="0 0 400 250">
              <line x1="50" y1="20" x2="50" y2="200" stroke="black" strokeWidth="2" />
              <line x1="50" y1="200" x2="380" y2="200" stroke="black" strokeWidth="2" />
              <text x="215" y="240" fontSize="16" textAnchor="middle" fontWeight="bold">Quartile</text>
              <text x="10" y="110" fontSize="16" textAnchor="middle" transform="rotate(-90, 10, 120)" fontWeight="bold">Count</text>

              {Array.from({ length: 5 }).map((_, i) => {
                const quartileMax = Math.max(...Object.values(animatedQuartiles), 1);
                const yVal = (quartileMax / 4) * i;
                const yPos = 200 - (yVal / quartileMax) * 160;
                return (
                  <g key={i}>
                    <line x1="45" y1={yPos} x2="50" y2={yPos} stroke="black" />
                    <text x="40" y={yPos + 5} fontSize="12" textAnchor="end">{Math.round(yVal)}</text>
                  </g>
                );
              })}

              {["Q1", "Q2", "Q3", "Q4"].map((q, index) => {
                const value = animatedQuartiles[q as keyof QuartileData];
                const maxVal = Math.max(...Object.values(animatedQuartiles), 1);
                const barHeight = (value / maxVal) * 160;
                const barWidth = 40;
                const barX = 70 + index * 80;
                const barY = 200 - barHeight;
                const isHovered = hoveredQuartile === q;

                const tooltipText = `${q} : ${value}`;
                const tooltipPadding = 10;
                const approxCharWidth = 7;
                const tooltipWidth = tooltipText.length * approxCharWidth + tooltipPadding * 2;
                const tooltipHeight = 30;
                const tooltipX = barX + barWidth / 2 - tooltipWidth / 2;
                const tooltipY = barY - tooltipHeight - 8;

                return (
                  <g key={q} onMouseEnter={() => setHoveredQuartile(q)} onMouseLeave={() => setHoveredQuartile(null)}>
                    <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={isHovered ? "#054768" : "url(#quartileGradient)"} style={{ transition: "fill 0.2s" }} />
                    <text x={barX + barWidth / 2} y={220} textAnchor="middle" fontSize="14" fill="#000">{q}</text>
                    <text x={barX + barWidth / 2} y={barY - 10} textAnchor="middle" fontSize="14" fill="#000">{value}</text>
                    {isHovered && (
                      <g>
                        <defs>
                          <filter id="tooltipShadow" x="0" y="0" width="200%" height="200%">
                            <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.2" />
                          </filter>
                        </defs>
                        <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} fill="#fff" rx="6" ry="6" filter="url(#tooltipShadow)" />
                        <text x={barX + barWidth / 2} y={tooltipY + 20} fontSize="12" textAnchor="middle">
                          <tspan fill="#054768" fontWeight="bold" fontSize="14">{q} :</tspan>
                          <tspan fill="#000" fontSize="14"> {value}</tspan>
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              <defs>
                <linearGradient id="quartileGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#42a5f5" />
                  <stop offset="100%" stopColor="#1e88e5" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <h3 className={style.chartTitle}>Timeframe-based Publications</h3>

        <div className={style.dropdown}>
          <select className={style.select} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last 1 Year</option>
            <option value="2y">Last 2 Years</option>
          </select>
        </div>

        <div className={style.kpiContainer}>
          <div className={style.kpiCard}>
            <h3>Total Publications</h3>
            <p className={style.counter}>{animatedPublications}</p>
          </div>
          <div className={style.kpiCard}>
            <h3>Top Authors</h3>
            <p className={style.counter}>{animatedAuthors}</p>
          </div>
        </div>

        <div className={style.topAuthor}>
          <h3>Top Authors</h3>
          <div className={style.authorList}>
            {topAuthors.length > 0 ? (
              topAuthors.map((author, index) => {
                const id = author.faculty_id || author.scopus_id || index.toString();
                return (
                  <div
                    key={id}
                    className={style.authorChip}
                    onClick={() => setExpandedAuthor(expandedAuthor === id ? null : id)}
                    style={{ cursor: "pointer" }}
                  >
                    {author.name}
                    <span className={style.authorBadge}>{author.timeframe_docs}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ color: "#777" }}>No data available</p>
            )}
          </div>
        </div>

        <div className={style.chartContainer}>
          <div className={style.chartBox}>
            {hoveredIndex !== null && (
              <div className={`${style.tooltip} ${style.showTooltip}`}>
                <strong>{formatLabel(publicationData[hoveredIndex].month)}</strong><br />
                {publicationData[hoveredIndex].count} publications
              </div>
            )}

            <svg width="100%" height={chartHeight + 80} viewBox={`0 0 1200 ${chartHeight + 120}`}>
              <line x1="80" y1="20" x2="80" y2={chartHeight} stroke="black" strokeWidth="3" />
              <text x="5" y={chartHeight / 2} transform="rotate(-90, 15, 150)" fontSize="20" textAnchor="middle" fontWeight="bold">No. of Publications</text>
              <line x1="80" y1={chartHeight} x2="1150" y2={chartHeight} stroke="black" strokeWidth="3" />
              <text x="600" y={chartHeight + 60} fontSize="20" textAnchor="middle" fontWeight="bold">Observation Period</text>

              {Array.from({ length: yTicks + 1 }).map((_, i) => {
                const yValue = i * tickInterval;
                const yPosition = chartHeight - (yValue / maxPublications) * (chartHeight - 50);
                return (
                  <g key={i}>
                    <line x1="75" y1={yPosition} x2="80" y2={yPosition} stroke="black" strokeWidth="3" />
                    <text x="60" y={yPosition + 5} fontSize="16" textAnchor="end">{yValue}</text>
                  </g>
                );
              })}

              {publicationData.map((data, index) => {
                const barX = index * barSpacing + xAxisOffset;
                const barHeight = (data.count / maxPublications) * (chartHeight - 50);
                const yPosition = chartHeight - barHeight;
                return (
                  <g key={data.month} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                    <rect className={style.bar} x={barX} y={chartHeight} width={barWidth} height={0} fill="url(#barGradient)">
                      <animate attributeName="y" from={chartHeight} to={yPosition} dur="0.8s" begin={`${index * 0.1}s`} fill="freeze" />
                      <animate attributeName="height" from="0" to={barHeight} dur="0.8s" begin={`${index * 0.1}s`} fill="freeze" />
                    </rect>
                    <text x={barX + barWidth / 2} y={chartHeight + 20} fontSize="16" textAnchor="middle">{formatLabel(data.month)}</text>
                  </g>
                );
              })}

              <path d={publicationData.map((data, index) => {
                const x = index * barSpacing + xAxisOffset + barWidth / 2;
                const y = chartHeight - (data.count / maxPublications) * (chartHeight - 50);
                return `${index === 0 ? "M" : "L"} ${x},${y}`;
              }).join(" ")} stroke="url(#lineGradient)" strokeWidth="4" fill="none" strokeDasharray="1500" strokeDashoffset="1500">
                <animate attributeName="stroke-dashoffset" from="1500" to="0" dur="1.5s" fill="freeze" />
              </path>

              {publicationData.map((data, index) => {
                const x = index * barSpacing + xAxisOffset + barWidth / 2;
                const y = chartHeight - (data.count / maxPublications) * (chartHeight - 50);
                return <circle key={index} cx={x} cy={y} r="5" fill="#ff4a22ff" style={{ cursor: "pointer" }} />;
              })}

              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#42a5f5" />
                  <stop offset="100%" stopColor="#1e88e5" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4caf50" />
                  <stop offset="100%" stopColor="#2e7d32" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className={style.buttonContainer}>
          <button className={style.facultyBtn} onClick={() => navigate("/faculty")}>Faculty List</button>
          <button className={style.analyticsBtn} onClick={() => navigate("/analytics")}>Analytics Dashboard</button>
          <button className={style.performanceBtn} onClick={() => navigate("/author-performance")}>Faculty Yearly Performance</button>
          <button className={style.monthlyReportBtn} onClick={() => navigate("/monthly-report")}>Faculty Monthly Report</button>
          <button className={style.monthlyReportBtn} onClick={() => navigate("/quartile-report")}>Quartile Report</button>
          <button className={style.facultyBtn} onClick={() => navigate("/publication-stats")}>Publication Statistics</button>
          <button className={style.facultyBtn} onClick={() => navigate("/paper-faculty-ratio")}>Paper Faculty Ratio</button>
        </div>
      </div>
    </div>
  );
}

// Shared inline styles for modal rows
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  padding: "3px 0",
  color: "#333",
};

const labelStyle: React.CSSProperties = {
  color: "#666",
};

const valueStyle: React.CSSProperties = {
  color: "#1A4D6C",
};

const dividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #eee",
  margin: "10px 0",
};
