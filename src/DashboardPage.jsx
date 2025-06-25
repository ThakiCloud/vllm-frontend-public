import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const getSummary = (data, fileName) => {
    const { meta, results, performance } = data;

    // Extract the fields to match the API response structure
    const pk = `${meta.timestamp}-${meta.benchmark_name}-${meta.run_id || 'None'}`;
    const benchmark_name = meta.benchmark_name;
    const model_id = meta.model?.id || 'N/A';
    const source = meta.model?.source || 'N/A';
    const timestamp = meta.timestamp;
    const tokenizer_id = meta.model?.tokenizer_id || 'N/A';

    return {
        id: pk,
        fileName: fileName,
        benchmark_name: benchmark_name,
        model_id: model_id,
        source: source,
        timestamp: timestamp,
        tokenizer_id: tokenizer_id,
        formattedTimestamp: new Date(timestamp).toLocaleString(),
        rawTimestamp: timestamp,
        // Keep original data structure for backward compatibility
        benchmark: benchmark_name,
        model: meta.model,
    };
};

function DashboardPage() {
    const [allSummaries, setAllSummaries] = useState([]);
    const [filteredSummaries, setFilteredSummaries] = useState([]);
    const [filters, setFilters] = useState({ benchmark: 'all', source: 'all', tokenizer: 'all', modelId: 'all' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                console.log("Fetching results from backend /standardized_output endpoint");

                const response = await fetch('/standardized_output');

                if (response.status === 404) {
                    setAllSummaries([]);
                } else if (!response.ok) {
                    throw new Error(`Failed to fetch results: ${response.status} ${response.statusText}`);
                } else {
                    const results = await response.json();
                    console.log("Received results:", results);
                    
                    // Check if results is an array
                    if (!Array.isArray(results)) {
                        console.warn("Results is not an array:", results);
                        setAllSummaries([]);
                    } else {
                        // Process each result item directly (no file fetching needed)
                        const processedResults = results.map(result => {
                            // Create a mock data structure that getSummary expects
                            const mockData = {
                                meta: {
                                    timestamp: result.timestamp,
                                    benchmark_name: result.benchmark_name,
                                    run_id: result.pk.split('-').pop(), // Extract run_id from pk
                                    model: {
                                        id: result.model_id,
                                        source: result.source,
                                        tokenizer_id: result.tokenizer_id
                                    }
                                }
                            };
                            // Use the file_name if available, otherwise use pk as filename
                            const fileName = result.file_name || `${result.benchmark_name}-${result.model_id}.json`;
                            return getSummary(mockData, fileName);
                        });

                        const validData = processedResults.filter(d => d !== null);
                        validData.sort((a, b) => new Date(b.rawTimestamp) - new Date(a.rawTimestamp));
                        setAllSummaries(validData);
                    }
                }

            } catch (e) {
                if (e instanceof SyntaxError) {
                    console.warn("Could not parse results. Assuming server misconfiguration.", e);
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
        const benchmarks = new Set();
        const sources = new Set();
        const tokenizers = new Set();
        const modelIds = new Set();
        allSummaries.forEach(s => {
            benchmarks.add(s.benchmark_name);
            sources.add(s.source);
            tokenizers.add(s.tokenizer_id);
            modelIds.add(s.model_id);
        });
        return {
            benchmarks: ['all', ...Array.from(benchmarks)],
            sources: ['all', ...Array.from(sources)],
            tokenizers: ['all', ...Array.from(tokenizers)],
            modelIds: ['all', ...Array.from(modelIds)],
        };
    }, [allSummaries]);
    
    useEffect(() => {
        let summaries = [...allSummaries];
        
        if (filters.benchmark !== 'all') {
            summaries = summaries.filter(s => s.benchmark_name === filters.benchmark);
        }
        if (filters.source !== 'all') {
            summaries = summaries.filter(s => s.source === filters.source);
        }
        if (filters.tokenizer !== 'all') {
            summaries = summaries.filter(s => s.tokenizer_id === filters.tokenizer);
        }
        if (filters.modelId !== 'all') {
            summaries = summaries.filter(s => s.model_id === filters.modelId);
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
                    <label htmlFor="benchmark">Benchmark:</label>
                    <select name="benchmark" id="benchmark" value={filters.benchmark} onChange={handleFilterChange} disabled={allSummaries.length === 0}>
                        {filterOptions.benchmarks.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
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
                            <th>Benchmark Name</th>
                            <th>Model ID</th>
                            <th>Source</th>
                            <th>Tokenizer ID</th>
                            <th>Timestamp</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSummaries.map((summary) => (
                            <tr key={summary.id}>
                                <td>{summary.benchmark_name}</td>
                                <td>{summary.model_id}</td>
                                <td>{summary.source}</td>
                                <td>{summary.tokenizer_id}</td>
                                <td>{summary.formattedTimestamp}</td>
                                <td>
                                    <Link to={`/results/${summary.id}`}>
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