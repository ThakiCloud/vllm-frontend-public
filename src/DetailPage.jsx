import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import BenchmarkResults from './components/BenchmarkResults';

function DetailPage() {
    const { pk } = useParams();
    const [resultData, setResultData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/standardized_output/${pk}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const { data } = await response.json();
                setResultData(data);
            } catch (e) {
                setError(e.message);
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [pk]);

    return (
        <div className="detail-page">
            <div className="detail-page-nav">
                <Link to="/" className="back-link">
                    &larr; Back to Dashboard
                </Link>
                <a href={`/raw_input/${pk}`} target="_blank" rel="noopener noreferrer" className="raw-link-button">
                    View RAW JSON
                </a>
            </div>
            {loading && <p>Loading details...</p>}
            {error && <p className="error-message">Error: {error}</p>}
            {resultData && <BenchmarkResults data={resultData} />}
        </div>
    );
}

export default DetailPage; 