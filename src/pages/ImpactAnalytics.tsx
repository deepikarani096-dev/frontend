import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import style from '../components/ResearchDashboard.module.css';
import css from './ImpactAnalytics.module.css';
import '../components/SharedPageStyles.css';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface DeptRow {
  department: string;
  journal_count: number;
  avg_if_2025: number | null;
  avg_if_5year: number | null;
  max_if_2025: number | null;
}

const ImpactAnalytics: React.FC = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const [data, setData] = useState<{ departments: DeptRow[]; overall: any } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dept, setDept] = useState<string>('all');
  const [deptList, setDeptList] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState<any | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      let url = `https://srm-sp-production.up.railway.app/api/impact-analytics`;
      if (isAdmin && isAdmin() && dept !== 'all') url += `?department=${encodeURIComponent(dept)}`;
      const res = await axios.get(url, { headers });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch impact analytics', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get('https://srm-sp-production.up.railway.app/api/impact-analytics/departments', { headers });
      setDeptList(res.data.departments || []);
    } catch (err) {
      console.error('Failed to fetch departments', err);
      setDeptList([]);
    }
  };

  const fetchAdvanced = async () => {
    try {
      const headers = getAuthHeaders();
      let url = `https://srm-sp-production.up.railway.app/api/impact-analytics/advanced`;
      if (isAdmin && isAdmin() && dept !== 'all') url += `?department=${encodeURIComponent(dept)}`;
      const res = await axios.get(url, { headers });
      setAdvanced(res.data);
    } catch (err) {
      console.error('Failed to fetch advanced analytics', err);
      setAdvanced(null);
    }
  };

  const exportCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  };

  const exportPDF = (title: string, tableHeaders: string[], tableData: any[][], filename: string) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.text(title, 40, 40);
    autoTable(doc, { 
      head: [tableHeaders], 
      body: tableData, 
      startY: 60 
    });
    doc.save(filename);
  };

  const limitLastNYears = (ts: any[], n = 6) => {
    if (!ts || !ts.length) return [];
    const sorted = [...ts].sort((a, b) => Number(a.year) - Number(b.year));
    return sorted.slice(Math.max(0, sorted.length - n));
  };

  // Prepare top journals and faculties chart data (top 10)
  const topJournalsData = (advanced?.topJournals || []).slice(0, 10);
  const topFacultiesData = (advanced?.topFaculties || []).slice(0, 10);

  const topJournalsChart = {
    labels: topJournalsData.map((j: any) => j.publication_name),
    datasets: [{
      label: 'Avg IF 2025',
      data: topJournalsData.map((j: any) => Number(j.avg_if_2025)),
      backgroundColor: 'rgba(102, 126, 234, 0.8)',
      borderColor: '#667eea',
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  const topFacultiesChart = {
    labels: topFacultiesData.map((f: any) => f.faculty_name),
    datasets: [{
      label: 'Avg IF 2025',
      data: topFacultiesData.map((f: any) => Number(f.avg_if_2025)),
      backgroundColor: 'rgba(240, 147, 251, 0.8)',
      borderColor: '#f093fb',
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  useEffect(() => {
    fetchData();
    fetchDepartments();
    fetchAdvanced();
  }, [dept]);

  return (
    <div className={style.pageWrapper}>
      <div className="shared-navbar">
        <a className="shared-logo" onClick={() => navigate('/dashboard')}>Impact Analytics</a>
      </div>
      <div className={style.container} style={{ paddingTop: '4rem' }}>
        <button className="shared-back-button" onClick={() => navigate('/dashboard')}> Back</button>
        <h2 style={{ marginTop: 8 }}>Impact Factor Analytics</h2>

        {/* Department Filter */}
        <div className={css.controls}>
          {isAdmin && isAdmin() && (
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">All Departments</option>
              {deptList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className={css.loading}>Loading analytics...</div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className={css.summaryRow}>
              <div className={css.summaryCard}>
                <div className={css.summaryLabel}>Average IF 2025</div>
                <div className={css.summaryValue}>{data.overall?.avg_if_2025 ?? '—'}</div>
              </div>
              <div className={css.summaryCard}>
                <div className={css.summaryLabel}>Average 5-Yr IF</div>
                <div className={css.summaryValue}>{data.overall?.avg_if_5year ?? '—'}</div>
              </div>
              <div className={css.summaryCard}>
                <div className={css.summaryLabel}>Total Journals</div>
                <div className={css.summaryValue}>{data.overall?.total_journals ?? 0}</div>
              </div>
            </div>

            {/* Department-wise Summary Table */}
            <div className={css.tableCard}>
              <h3>Department-wise Summary</h3>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Department</th>
                    <th style={{ textAlign: 'right' }}>Journals</th>
                    <th style={{ textAlign: 'right' }}>Avg IF 2025</th>
                    <th style={{ textAlign: 'right' }}>Avg 5-Yr IF</th>
                    <th style={{ textAlign: 'right' }}>Max IF 2025</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments && data.departments.length ? data.departments
                    .filter((d) => d.department.toLowerCase() !== 'unknown')
                    .map((d) => (
                    <tr key={d.department}>
                      <td>{d.department}</td>
                      <td style={{ textAlign: 'right' }}>{d.journal_count}</td>
                      <td style={{ textAlign: 'right' }}>{d.avg_if_2025 ? Number(d.avg_if_2025).toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{d.avg_if_5year ? Number(d.avg_if_5year).toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{d.max_if_2025 ? Number(d.max_if_2025).toFixed(1) : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Advanced Analytics Section */}
            {advanced && (
              <>
                {/* Summary Statistics */}
                <div className={css.tableCard}>
                  <h3>Summary Statistics</h3>
                  <div className={css.cardGrid}>
                    <div className={css.kpi}>
                      <div className={css.label}>Avg IF 2025</div>
                      <div className={css.value}>
                        {advanced.summary?.avg_if_2025 ? Number(advanced.summary.avg_if_2025).toFixed(2) : '—'}
                      </div>
                    </div>
                    <div className={css.kpi}>
                      <div className={css.label}>Std Dev</div>
                      <div className={css.value}>
                        {advanced.summary?.stddev_if_2025 ? Number(advanced.summary.stddev_if_2025).toFixed(2) : '—'}
                      </div>
                    </div>
                    <div className={css.kpi}>
                      <div className={css.label}>Min IF</div>
                      <div className={css.value}>{advanced.summary?.min_if_2025 ?? '—'}</div>
                    </div>
                    <div className={css.kpi}>
                      <div className={css.label}>Max IF</div>
                      <div className={css.value}>{advanced.summary?.max_if_2025 ?? '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Distribution Table */}
                <div className={css.tableCard}>
                  <h3>Impact Factor Distribution (2025)</h3>
                  <table className={css.table}>
                    <thead>
                      <tr>
                        <th>Bucket</th>
                        <th style={{ textAlign: 'right' }}>Journals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanced.distribution && advanced.distribution.length ? advanced.distribution.map((b: any) => (
                        <tr key={b.bucket}>
                          <td>{b.bucket}</td>
                          <td style={{ textAlign: 'right' }}>{b.count}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2} style={{ textAlign: 'center' }}>No distribution data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Top Journals and Faculties Charts */}
                <div style={{ marginTop: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                  <div className={css.tableCard} style={{ flex: 1, minWidth: 500 }}>
                    <h3>Top Journals by Avg IF (Top 10)</h3>
                    <div className={css.hbarBox}>
                      {topJournalsData.length ? (
                        <Bar
                          data={topJournalsChart}
                          options={{
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => `Avg IF: ${Number(ctx.parsed.x).toFixed(2)}`
                                }
                              }
                            },
                            scales: {
                              x: {
                                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                                ticks: { font: { size: 12 } }
                              },
                              y: {
                                grid: { display: false },
                                ticks: { font: { size: 12 } }
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className={css.muted}>No data available</div>
                      )}
                    </div>
                  </div>

                  <div className={css.tableCard} style={{ flex: 1, minWidth: 500 }}>
                    <h3>Top Faculties by Avg IF (Top 10)</h3>
                    <div className={css.hbarBox}>
                      {topFacultiesData.length ? (
                        <Bar
                          data={topFacultiesChart}
                          options={{
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (ctx) => `Avg IF: ${Number(ctx.parsed.x).toFixed(2)}`
                                }
                              }
                            },
                            scales: {
                              x: {
                                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                                ticks: { font: { size: 12 } }
                              },
                              y: {
                                grid: { display: false },
                                ticks: { font: { size: 12 } }
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className={css.muted}>No data available</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time Series and Distribution Charts */}
                <div className={css.tableCard}>
                  <h3>Time Series & Distribution Analysis</h3>
                  <div className={css.chartsRow}>
                    <div className={css.chartBox}>
                      <h4 style={{ marginTop: 0, marginBottom: 16, color: '#1e293b', fontSize: 18 }}>
                        Avg IF per Year (Last 6 Years)
                      </h4>
                      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        {advanced.timeSeries && advanced.timeSeries.length ? (
                          <Line
                            data={{
                              labels: limitLastNYears(advanced.timeSeries, 6).map((t: any) => String(t.year)),
                              datasets: [{
                                label: 'Avg IF 2025',
                                data: limitLastNYears(advanced.timeSeries, 6).map((t: any) => Number(t.avg_if_2025)),
                                borderColor: '#667eea',
                                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                borderWidth: 3,
                                tension: 0.4,
                                pointRadius: 6,
                                pointBackgroundColor: '#667eea',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointHoverRadius: 8,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { display: true, position: 'top' },
                                tooltip: {
                                  mode: 'index',
                                  intersect: false,
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: false,
                                  grid: { color: 'rgba(0, 0, 0, 0.05)' },
                                  ticks: { font: { size: 12 } }
                                },
                                x: {
                                  grid: { display: false },
                                  ticks: { font: { size: 12 } }
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className={css.muted}>No time series data available</div>
                        )}
                      </div>
                    </div>

                    <div className={css.chartBox}>
                      <h4 style={{ marginTop: 0, marginBottom: 16, color: '#1e293b', fontSize: 18 }}>
                        Distribution by IF Range
                      </h4>
                      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        {advanced.distribution && advanced.distribution.length ? (
                          <Bar
                            data={{
                              labels: advanced.distribution.map((d: any) => d.bucket),
                              datasets: [{
                                label: 'Journals',
                                data: advanced.distribution.map((d: any) => Number(d.count)),
                                backgroundColor: 'rgba(124, 58, 237, 0.8)',
                                borderColor: '#7c3aed',
                                borderWidth: 2,
                                borderRadius: 8,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { display: true, position: 'top' },
                                tooltip: {
                                  callbacks: {
                                    label: (ctx) => `Journals: ${ctx.parsed.y}`
                                  }
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: { color: 'rgba(0, 0, 0, 0.05)' },
                                  ticks: { font: { size: 12 } }
                                },
                                x: {
                                  grid: { display: false },
                                  ticks: { font: { size: 11 } }
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className={css.muted}>No distribution data available</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Export Buttons */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                    <button className={css.exportBtn} onClick={() => {
                      const rows = [
                        ['Year', 'Avg IF 2025', 'Journals'],
                        ...limitLastNYears(advanced.timeSeries || [], 6).map((t: any) => [
                          t.year,
                          Number(t.avg_if_2025).toFixed(2),
                          t.journals_count
                        ])
                      ];
                      exportCSV('time_series.csv', rows);
                    }}>
                      Export Time Series CSV
                    </button>

                    <button className={css.exportBtn} onClick={() => {
                      const rows = [
                        ['Bucket', 'Journals'],
                        ...(advanced.distribution || []).map((b: any) => [b.bucket, b.count])
                      ];
                      exportCSV('distribution.csv', rows);
                    }}>
                      Export Distribution CSV
                    </button>

                    <button className={css.exportBtn} onClick={() => {
                      const headers = ['Metric', 'Value'];
                      const dataRows = [
                        ['Avg IF 2025', advanced.summary?.avg_if_2025 ? Number(advanced.summary.avg_if_2025).toFixed(2) : '—'],
                        ['StdDev IF', advanced.summary?.stddev_if_2025 ? Number(advanced.summary.stddev_if_2025).toFixed(2) : '—'],
                        ['Min IF', advanced.summary?.min_if_2025 ?? '—'],
                        ['Max IF', advanced.summary?.max_if_2025 ?? '—'],
                        ['Total Journals', advanced.summary?.total_journals ?? 0]
                      ];
                      exportPDF('Impact Analytics Summary', headers, dataRows, 'impact_summary.pdf');
                    }}>
                      Export Summary PDF
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className={css.muted} style={{ marginTop: 40 }}>No data available</div>
        )}
      </div>
    </div>
  );
};

export default ImpactAnalytics;