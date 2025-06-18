import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import BenchmarkResults from './components/BenchmarkResults';

function DetailPage() {
    const { fileName } = useParams();
    const [resultData, setResultData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/results/parsed/${fileName}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setResultData(data);
            } catch (e) {
                setError(e.message);
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [fileName]);

    return (
        <div className="detail-page">
            <Link to="/" className="back-link">
                &larr; Back to Dashboard
            </Link>
            {loading && <p>Loading details...</p>}
            {error && <p className="error-message">Error: {error}</p>}
            {resultData && <BenchmarkResults data={resultData} />}
        </div>
    );
}

export default DetailPage; 