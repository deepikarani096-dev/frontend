import React, { useEffect, useRef, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// Import SDG images
import sdg1 from '../assets/sdg1.png'; import sdg2 from '../assets/sdg2.png'; import sdg3 from '../assets/sdg3.png';
import sdg4 from '../assets/sdg4.png'; import sdg5 from '../assets/sdg5.png'; import sdg6 from '../assets/sdg6.png';
import sdg7 from '../assets/sdg7.png'; import sdg8 from '../assets/sdg8.png'; import sdg9 from '../assets/sdg9.png';
import sdg10 from '../assets/sdg10.png'; import sdg11 from '../assets/sdg11.png'; import sdg12 from '../assets/sdg12.png';
import sdg13 from '../assets/sdg13.png'; import sdg14 from '../assets/sdg14.png'; import sdg15 from '../assets/sdg15.png';
import sdg16 from '../assets/sdg16.png'; import sdg17 from '../assets/sdg17.png';

ChartJS.register(ArcElement, Tooltip, Legend);

const sdgInfo: { [key: string]: { color: string; title: string; description: string; number: string; image: string } } = {
    'SDG 1': { color: '#E5243B', title: 'No Poverty', description: 'End poverty in all its forms everywhere', number: '1', image: sdg1 },
    'SDG 2': { color: '#DDA63A', title: 'Zero Hunger', description: 'End hunger, achieve food security and improved nutrition', number: '2', image: sdg2 },
    'SDG 3': { color: '#4C9F38', title: 'Good Health and Well-being', description: 'Ensure healthy lives and promote well-being for all', number: '3', image: sdg3 },
    'SDG 4': { color: '#C5192D', title: 'Quality Education', description: 'Ensure inclusive and equitable quality education', number: '4', image: sdg4 },
    'SDG 5': { color: '#FF3A21', title: 'Gender Equality', description: 'Achieve gender equality and empower all women and girls', number: '5', image: sdg5 },
    'SDG 6': { color: '#26BDE2', title: 'Clean Water and Sanitation', description: 'Ensure availability and sustainable management of water', number: '6', image: sdg6 },
    'SDG 7': { color: '#FCC30B', title: 'Affordable and Clean Energy', description: 'Ensure access to affordable, reliable, sustainable energy', number: '7', image: sdg7 },
    'SDG 8': { color: '#A21942', title: 'Decent Work and Economic Growth', description: 'Promote sustained, inclusive economic growth', number: '8', image: sdg8 },
    'SDG 9': { color: '#FD6925', title: 'Industry, Innovation and Infrastructure', description: 'Build resilient infrastructure, promote innovation', number: '9', image: sdg9 },
    'SDG 10': { color: '#DD1367', title: 'Reduced Inequalities', description: 'Reduce inequality within and among countries', number: '10', image: sdg10 },
    'SDG 11': { color: '#FD9D24', title: 'Sustainable Cities and Communities', description: 'Make cities and human settlements inclusive', number: '11', image: sdg11 },
    'SDG 12': { color: '#BF8B2E', title: 'Responsible Consumption and Production', description: 'Ensure sustainable consumption and production patterns', number: '12', image: sdg12 },
    'SDG 13': { color: '#3F7E44', title: 'Climate Action', description: 'Take urgent action to combat climate change', number: '13', image: sdg13 },
    'SDG 14': { color: '#0A97D9', title: 'Life Below Water', description: 'Conserve and sustainably use oceans and marine resources', number: '14', image: sdg14 },
    'SDG 15': { color: '#56C02B', title: 'Life on Land', description: 'Protect, restore and promote sustainable use of ecosystems', number: '15', image: sdg15 },
    'SDG 16': { color: '#00689D', title: 'Peace, Justice and Strong Institutions', description: 'Promote peaceful and inclusive societies', number: '16', image: sdg16 },
    'SDG 17': { color: '#19486A', title: 'Partnerships for the Goals', description: 'Strengthen means of implementation and global partnerships', number: '17', image: sdg17 },
    '-': { color: '#64748B', title: 'Unspecified', description: 'Unspecified SDG alignment', number: '?', image: '' },
};

const CombinedSDGDashboard: React.FC<{ department?: string; year?: string }> = ({ department, year }) => {
    const [data, setData] = useState<{ [key: string]: number }>({});
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const chartRef = useRef<any>(null);
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        const headers = getAuthHeaders();
        const params = new URLSearchParams();
        if (department && department !== 'all') params.set('department', department);
        if (year && year !== 'all') params.set('year', year);

        const query = params.toString();
        // ✅ Correct endpoint: /api/insights/sdg-counts
        const url = `https://srm-sp-production.up.railway.app/api/insights/sdg-counts${query ? `?${query}` : ''}`;

        axios.get(url, { headers })
            .then(res => setData(res.data))
            .catch(err => { console.error('Failed to load SDG data:', err); setData({}); });
    }, [getAuthHeaders, department, year]);

    const chartLabels = Object.keys(data);
    const chartValues = Object.values(data);

    const pieData = {
        labels: chartLabels,
        datasets: [{
            data: chartValues,
            backgroundColor: chartLabels.map(label => sdgInfo[label]?.color || '#999'),
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: chartLabels.map((_, i) => (i === hoveredIndex ? 20 : 0)),
        }]
    };

    const highlightSlice = (index: number | null) => {
        setHoveredIndex(index);
        const chart = chartRef.current;
        if (!chart) return;
        chart.setActiveElements(index !== null ? [{ datasetIndex: 0, index }] : []);
        chart.tooltip.setActiveElements(index !== null ? [{ datasetIndex: 0, index }] : [], { x: 0, y: 0 });
        chart.update();
    };

    const total = Object.values(data).reduce((a, b) => a + b, 0);

    return (
        <div style={{ padding: '1rem', width: '100%', maxWidth: '1300px', margin: 'auto' }}>
            <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '2rem', color: '#333' }}>
                SDG Pie Chart with Detailed Breakdown
            </h2>

            {/* Pie Chart */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '3rem',
                padding: '0.5rem',
                overflow: 'visible',
                position: 'relative',
            }}>
                <div style={{
                    width: 400,
                    height: 400,
                    overflow: 'visible',
                    position: 'relative'
                }}>
                    <Pie
                        ref={chartRef}
                        data={pieData}
                        options={{
                            maintainAspectRatio: false,
                            layout: { padding: 20 },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    enabled: false,
                                    external: context => {
                                        let tooltipEl = document.getElementById('chartjs-tooltip');
                                        if (!tooltipEl) {
                                            tooltipEl = document.createElement('div');
                                            tooltipEl.id = 'chartjs-tooltip';
                                            tooltipEl.style.position = 'absolute';
                                            tooltipEl.style.pointerEvents = 'none';
                                            tooltipEl.style.background = 'white';
                                            tooltipEl.style.border = '1px solid #ccc';
                                            tooltipEl.style.padding = '10px';
                                            tooltipEl.style.borderRadius = '10px';
                                            tooltipEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
                                            tooltipEl.style.zIndex = '9999';
                                            document.body.appendChild(tooltipEl);
                                        }

                                        const { chart, tooltip } = context;
                                        if (tooltip.opacity === 0) {
                                            tooltipEl.style.opacity = '0';
                                            return;
                                        }

                                        const index = tooltip.dataPoints?.[0]?.dataIndex;
                                        if (index === undefined) return;

                                        const label = chart.data.labels[index];
                                        const value = chart.data.datasets[0].data[index];
                                        const info = sdgInfo[label as string];

                                        tooltipEl.innerHTML = `<strong>SDG ${info.number}: ${info.title}</strong><br/>Projects: ${value}`;
                                        const canvasRect = chart.canvas.getBoundingClientRect();
                                        tooltipEl.style.left = `${canvasRect.left + window.scrollX + tooltip.caretX}px`;
                                        tooltipEl.style.top = `${canvasRect.top + window.scrollY + tooltip.caretY - 50}px`;
                                        tooltipEl.style.opacity = '1';
                                    }
                                }
                            },
                            onHover: (event, chartElement) => {
                                const index = chartElement[0]?.index ?? null;
                                highlightSlice(index);
                                event.native?.target?.style && (event.native.target.style.cursor = index !== null ? 'pointer' : 'default');
                            }
                        }}
                    />
                </div>
            </div>

            {/* Legend with Hover */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginBottom: '3rem'
            }}>
                {chartLabels.map((label, i) => (
                    <div key={label}>
                        <div
                            onMouseEnter={() => highlightSlice(i)}
                            onMouseLeave={() => highlightSlice(null)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                gap: '0.5rem',
                                padding: '0.25rem',
                                borderRadius: '4px'
                            }}
                        >
                            <div style={{
                                width: '1rem',
                                height: '1rem',
                                backgroundColor: pieData.datasets[0].backgroundColor[i],
                                borderRadius: '2px'
                            }} />
                            <span>{label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* SDG Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-8">
                {Object.entries(data)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sdg, count], i) => {
                        const info = sdgInfo[sdg];
                        const percent = ((count / total) * 100).toFixed(1);
                        return (
                            <div
                                key={sdg}
                                style={{
                                    backgroundColor: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    boxShadow: hoveredIndex === i ? '0 0 10px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                                    position: 'relative',
                                    minHeight: '150px',
                                    margin: '1rem auto',
                                    transition: 'box-shadow 0.3s ease'
                                }}
                                onMouseEnter={() => highlightSlice(i)}
                                onMouseLeave={() => highlightSlice(null)}
                            >
                                <h4 style={{ color: info.color }}>{`SDG ${info.number}: ${info.title}`}</h4>
                                <p style={{ fontSize: '0.9rem', margin: '0.5rem 0', color: '#555', fontWeight: 'bold' }}>{info.description}</p>
                                <p style={{ fontWeight: 600 }}>{count} Projects ({percent}%)</p>
                                {info.image && (
                                    <img
                                        src={info.image}
                                        alt={info.title}
                                        style={{
                                            width: 80,
                                            height: 80,
                                            position: 'absolute',
                                            bottom: 30,
                                            right: 30,
                                            borderRadius: '6px'
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

export default CombinedSDGDashboard;