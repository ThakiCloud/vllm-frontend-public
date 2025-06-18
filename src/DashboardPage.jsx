import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const getSummary = (data, fileName) => {
    const { meta, results, performance } = data;
    const keyResult = Object.keys(results)[0]
        ? `${Object.keys(results)[0]}: ${Object.values(results)[0].toFixed(4)}`
        : `RPS: ${performance.throughput?.requests_per_second?.toFixed(2) || 'N/A'}`;

    return {
        id: meta.run_id,
        fileName: fileName,
        benchmark: meta.benchmark_name,
        model: meta.model,
        timestamp: new Date(meta.timestamp).toLocaleString(),
        keyResult: keyResult,
    };
};

function DashboardPage() {
    const [allSummaries, setAllSummaries] = useState([]);
    const [filteredSummaries, setFilteredSummaries] = useState([]);
    const [filters, setFilters] = useState({ source: 'all', tokenizer: 'all', modelId: 'all' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                let filesData = [];

                if (import.meta.env.DEV) {
                    // --- DEVELOPMENT MODE ---
                    // Use Vite's glob import for local development.
                    // NOTE: This requires sample files to be present in /public/results/parsed/
                    console.log("Running in DEV mode. Using import.meta.glob.");
                    const resultModules = import.meta.glob('/public/results/parsed/*.json');
                    const filePaths = Object.keys(resultModules);

                    if (filePaths.length === 0) {
                        setAllSummaries([]);
                    } else {
                        filesData = await Promise.all(
                            filePaths.map(async (path) => {
                                const module = await resultModules[path]();
                                const fileName = path.split('/').pop();
                                return getSummary(module.default, fileName);
                            })
                        );
                    }
                } else {
                    // --- PRODUCTION MODE ---
                    // Fetch file list from Nginx autoindex in production.
                    console.log("Running in PROD mode. Fetching from /results/parsed/");
                    const response = await fetch('/results/parsed/');
                    
                    if (response.status === 404) {
                        setAllSummaries([]);
                    } else if (!response.ok) {
                        throw new Error(`Failed to fetch file list: ${response.status} ${response.statusText}`);
                    } else {
                        const fileList = await response.json();
                        const jsonFiles = fileList.filter(file => file.name.endsWith('.json'));

                        if (jsonFiles.length === 0) {
                            setAllSummaries([]);
                        } else {
                            filesData = await Promise.all(
                                jsonFiles.map(async (file) => {
                                    try {
                                        const fileResponse = await fetch(`/results/parsed/${file.name}`);
                                        if (!fileResponse.ok) throw new Error(`Failed to fetch ${file.name}`);
                                        const data = await fileResponse.json();
                                        return getSummary(data, file.name);
                                    } catch (e) {
                                        console.error(`Error processing file ${file.name}:`, e);
                                        return null;
                                    }
                                })
                            );
                        }
                    }
                }

                const validData = filesData.filter(d => d !== null);
                setAllSummaries(validData);

            } catch (e) {
                 if (e instanceof SyntaxError) {
                    console.warn("Could not parse file list. Assuming directory is empty or server misconfiguration.", e);
                    setAllSummaries([]);
                } else {
                    setError(`Failed to load benchmark results. Error: ${e.message}`);
                    console.error(e);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, []);

    const filterOptions = useMemo(() => {
        const sources = new Set();
        const tokenizers = new Set();
        const modelIds = new Set();
        allSummaries.forEach(s => {
            if(s.model) {
                sources.add(s.model.source);
                tokenizers.add(s.model.tokenizer_id);
                modelIds.add(s.model.id);
            }
        });
        return {
            sources: ['all', ...Array.from(sources)],
            tokenizers: ['all', ...Array.from(tokenizers)],
            modelIds: ['all', ...Array.from(modelIds)],
        };
    }, [allSummaries]);
    
    useEffect(() => {
        let summaries = [...allSummaries];

        if (filters.source !== 'all') {
            summaries = summaries.filter(s => s.model?.source === filters.source);
        }
        if (filters.tokenizer !== 'all') {
            summaries = summaries.filter(s => s.model?.tokenizer_id === filters.tokenizer);
        }
        if (filters.modelId !== 'all') {
            summaries = summaries.filter(s => s.model?.id === filters.modelId);
        }

        setFilteredSummaries(summaries);
    }, [filters, allSummaries]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value,
        }));
    };

    if (loading) return <p>Loading dashboard...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="dashboard">
            <h2>Benchmark Summary</h2>

            <div className="filter-container">
                <div className="filter-group">
                    <label htmlFor="source">Source:</label>
                    <select name="source" id="source" value={filters.source} onChange={handleFilterChange} disabled={allSummaries.length === 0}>
                        {filterOptions.sources.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="tokenizer">Tokenizer ID:</label>
                    <select name="tokenizer" id="tokenizer" value={filters.tokenizer} onChange={handleFilterChange} disabled={allSummaries.length === 0}>
                         {filterOptions.tokenizers.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="modelId">Model ID:</label>
                    <select name="modelId" id="modelId" value={filters.modelId} onChange={handleFilterChange} disabled={allSummaries.length === 0}>
                         {filterOptions.modelIds.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>

            {allSummaries.length === 0 ? (
                <p className="no-results-message">No benchmark results found.</p>
            ) : filteredSummaries.length === 0 ? (
                <p className="no-results-message">No results match the current filters.</p>
            ) : (
                <table className="summary-table">
                    <thead>
                        <tr>
                            <th>Benchmark</th>
                            <th>Model</th>
                            <th>Key Result</th>
                            <th>Timestamp</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSummaries.map((summary) => (
                            <tr key={summary.id}>
                                <td>{summary.benchmark}</td>
                                <td>{summary.model?.id || 'N/A'}</td>
                                <td>{summary.keyResult}</td>
                                <td>{summary.timestamp}</td>
                                <td>
                                    <Link to={`/results/${summary.fileName}`}>
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default DashboardPage; 