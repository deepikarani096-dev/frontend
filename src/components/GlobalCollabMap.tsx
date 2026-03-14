import { scaleLinear } from 'd3-scale';
import React, { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import { useAuth } from '../contexts/AuthContext';

interface CountryData {
    country: string;
    count: number;
}

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const manualMapping: Record<string, string> = {
    'russian federation': 'russia',
    'syrian arab republic': 'syria',
    'united states': 'united states of america',
};

const GlobalCollabMap: React.FC<{ department?: string; year?: string }> = ({ department, year }) => {
    const [data, setData] = useState<CountryData[]>([]);
    const [geoNames, setGeoNames] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        const headers = getAuthHeaders();
        const params = new URLSearchParams();
        if (department && department !== 'all') params.set('department', department);
        if (year && year !== 'all') params.set('year', year);

        const query = params.toString();
        const url = `https://srm-sp-production.up.railway.app/api/insights/countries${query ? `?${query}` : ''}`;

        fetch(url, { headers })
            .then(res => {
                if (!res.ok) throw new Error(`Network response not ok: ${res.status}`);
                return res.json();
            })
            .then(apiData => setData(apiData))
            .catch(err => {
                console.error('Failed to load API data:', err);
                setData([]);
            });
    }, [getAuthHeaders, department, year]);

    useEffect(() => {
        fetch(geoUrl)
            .then(res => res.json())
            .then(worldData => {
                const names = worldData.objects?.countries?.geometries
                    ?.map((geo: any) => geo.properties.name)
                    ?.filter((name: any) => !!name)
                    .map((name: string) => name.toLowerCase()) || [];
                setGeoNames(names);
            })
            .catch(err => console.error('Failed to load GeoJSON:', err));
    }, []);

    function simpleSimilarity(a: string, b: string): number {
        a = a.toLowerCase();
        b = b.toLowerCase();
        if (a === b) return 0;
        if (a.includes(b) || b.includes(a)) return 1;
        return Math.abs(a.length - b.length) + 1;
    }

    useEffect(() => {
        if (!geoNames.length || !data.length) return;
        const map: Record<string, string> = {};
        data.forEach(({ country }) => {
            const cLower = country.toLowerCase();
            if (manualMapping[cLower]) {
                map[cLower] = manualMapping[cLower];
                return;
            }
            let bestMatch = '';
            let bestScore = Number.MAX_SAFE_INTEGER;
            for (const geoName of geoNames) {
                const score = simpleSimilarity(cLower, geoName);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = geoName;
                }
            }
            map[cLower] = bestMatch;
        });
        setMapping(map);
    }, [geoNames, data]);

    const dataMap = new Map<string, number>();
    data.forEach(({ country, count }) => {
        const geoName = mapping[country.toLowerCase()] || country.toLowerCase();
        dataMap.set(geoName, count);
    });

    const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count)) : 0;
    const colorScale = scaleLinear<string>()
        .domain([0, maxCount])
        .range(['#d1ecf1', '#004085']);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '1300px',
                margin: '1rem auto',
                padding: '2rem',
                borderRadius: '1.25rem',
                backgroundColor: '#ffffff',
                boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.08)',
                boxSizing: 'border-box'
            }}
        >
            <h2 style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#333',
            }}>
                GLOBAL RESEARCH COLLABORATIONS
            </h2>

            <div style={{
                width: '100%',
                minHeight: '30vh',
                backgroundColor: '#ffffff',
                border: '0.125rem solid #dbeafe',
                borderRadius: '0.75rem',
                overflow: 'hidden',
            }}>
                <ComposableMap
                    projectionConfig={{ scale: 180, center: [15, 0] }}
                    style={{
                        width: '100%',
                        height: '50%',
                    }}
                >
                    <Geographies geography={geoUrl}>
                        {({ geographies, loading, error }) => {
                            if (loading) return <text x={400} y={350}>Loading map data...</text>;
                            if (error) return <text x={400} y={350}>Failed to load map data</text>;

                            return geographies.map(geo => {
                                const countryName = geo.properties.name || '';
                                const count = dataMap.get(countryName.toLowerCase()) || 0;
                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={count ? colorScale(count) : '#f8f9fa'}
                                        stroke="#ddd"
                                        strokeWidth={0.5}
                                        data-tooltip-id="map-tooltip"
                                        data-tooltip-content={`${countryName} — Collaborations: ${count}`}
                                        style={{
                                            default: { outline: 'none', transition: 'fill 0.2s ease-in-out' },
                                            hover: {
                                                fill: '#ffcc00',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                strokeWidth: 1,
                                                stroke: '#444',
                                            },
                                            pressed: { outline: 'none' },
                                        }}
                                    />
                                );
                            });
                        }}
                    </Geographies>
                </ComposableMap>
            </div>

            <Tooltip
                id="map-tooltip"
                place="top"
                style={{
                    backgroundColor: "#e0e7ff",
                    color: "#1A4D6C",
                    borderRadius: '0.25rem',
                    borderColor: "#e0e7ff",
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    zIndex: 1000,
                }}
            />
        </div>
    );
};

export default GlobalCollabMap;