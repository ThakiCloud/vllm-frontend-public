const renderValue = (value) => {
    if (typeof value === 'object') {
        return <pre>{JSON.stringify(value, null, 2)}</pre>;
    }
    if (typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(4);
    }
    return value.toString();
};

const Card = ({ title, data }) => {
    if (typeof data !== 'object' || data === null) {
        return null;
    }

    const content = Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'object') {
            return <Card key={key} title={key} data={value} />;
        }
        
        return (
            <div className="kv-pair" key={key}>
                <span className="key">{key}</span>
                <span className="value">{renderValue(value)}</span>
            </div>
        );
    }).filter(Boolean);

    if (content.length === 0) {
        return null;
    }

    return (
        <div className="card">
            <h3>{title}</h3>
            {content}
        </div>
    );
};


function BenchmarkResults({ data }) {
    if (!data) return <p>No data to display.</p>;

    const { meta, results, performance } = data;

    return (
        <div className="benchmark-results">
            <h2>{meta?.benchmark_name || 'Benchmark Details'}</h2>
            <div className="results-grid">
                <Card title="Meta Information" data={meta} />
                <Card title="Quality Results" data={results} />
                <Card title="Performance Summary" data={performance?.summary} />
                <Card title="Throughput" data={performance?.throughput} />
                <Card title="Latency" data={performance?.latency} />
            </div>
        </div>
    );
}

export default BenchmarkResults; 