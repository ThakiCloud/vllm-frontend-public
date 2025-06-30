import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Computer as ComputerIcon,
  Schedule as ScheduleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { benchmarkResultsApi } from './utils/api';

const getSummary = (data, fileName) => {
    const { meta } = data;

    // Extract the fields to match the API response structure
    const pk = meta.pk;
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
    const [benchmarkList, setBenchmarkList] = useState([]);
    const [selectedBenchmark, setSelectedBenchmark] = useState(null);
    const [benchmarkResults, setBenchmarkResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                const response = await benchmarkResultsApi.list();
                const results = response.data;
                
                // Check if results is an array
                if (!Array.isArray(results)) {
                    setAllSummaries([]);
                } else {
                    // Process each result item directly (no file fetching needed)
                    const processedResults = results.map(result => {
                        // Create a mock data structure that getSummary expects
                        const mockData = {
                            meta: {
                                pk: result.pk,
                                timestamp: result.timestamp,
                                benchmark_name: result.benchmark_name,
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
                    
                    // Create benchmark list with counts
                    const benchmarkCounts = {};
                    validData.forEach(item => {
                        const benchmark = item.benchmark_name;
                        if (!benchmarkCounts[benchmark]) {
                            benchmarkCounts[benchmark] = {
                                name: benchmark,
                                count: 0,
                                latestTimestamp: item.rawTimestamp
                            };
                        }
                        benchmarkCounts[benchmark].count++;
                        if (new Date(item.rawTimestamp) > new Date(benchmarkCounts[benchmark].latestTimestamp)) {
                            benchmarkCounts[benchmark].latestTimestamp = item.rawTimestamp;
                        }
                    });
                    
                    const benchmarks = Object.values(benchmarkCounts)
                        .sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));
                    setBenchmarkList(benchmarks);
                }
            } catch (e) {
                if (e.response?.status === 404) {
                    setAllSummaries([]);
                } else if (e instanceof SyntaxError) {
                    setAllSummaries([]);
                } else {
                    setError(`Failed to load benchmark results. Error: ${e.message}`);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, []);

    const handleBenchmarkClick = (benchmarkName) => {
        const results = allSummaries.filter(item => item.benchmark_name === benchmarkName);
        setBenchmarkResults(results);
        setSelectedBenchmark(benchmarkName);
    };

    const handleBackToBenchmarks = () => {
        setSelectedBenchmark(null);
        setBenchmarkResults([]);
    };

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        return {
            total: allSummaries.length,
            benchmarks: new Set(allSummaries.map(s => s.benchmark_name)).size,
            models: new Set(allSummaries.map(s => s.model_id)).size,
            sources: new Set(allSummaries.map(s => s.source)).size,
        };
    }, [allSummaries]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    // Render benchmark list view
    if (!selectedBenchmark) {
        return (
            <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                    Benchmark Dashboard
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* Summary Stats */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <AssessmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Results
                                        </Typography>
                                        <Typography variant="h4">
                                            {summaryStats.total}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <TimelineIcon color="secondary" sx={{ mr: 2, fontSize: 40 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Benchmarks
                                        </Typography>
                                        <Typography variant="h4">
                                            {benchmarkList.length}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <ComputerIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Models
                                        </Typography>
                                        <Typography variant="h4">
                                            {summaryStats.models}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <ScheduleIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Sources
                                        </Typography>
                                        <Typography variant="h4">
                                            {summaryStats.sources}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Benchmark List */}
                {benchmarkList.length === 0 ? (
                    <Card>
                        <CardContent>
                            <Box textAlign="center" py={4}>
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No benchmarks found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    No benchmark results are available at this time.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Available Benchmarks
                            </Typography>
                            <Grid container spacing={2}>
                                {benchmarkList.map((benchmark) => (
                                    <Grid item xs={12} sm={6} md={4} key={benchmark.name}>
                                        <Card 
                                            sx={{ 
                                                cursor: 'pointer', 
                                                '&:hover': { 
                                                    boxShadow: 4,
                                                    transform: 'translateY(-2px)',
                                                    transition: 'all 0.2s'
                                                } 
                                            }}
                                            onClick={() => handleBenchmarkClick(benchmark.name)}
                                        >
                                            <CardContent>
                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Box>
                                                        <Typography variant="h6" gutterBottom>
                                                            {benchmark.name}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {benchmark.count} result{benchmark.count !== 1 ? 's' : ''}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Latest: {new Date(benchmark.latestTimestamp).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                    <Chip 
                                                        label={benchmark.count} 
                                                        color="primary" 
                                                        size="small"
                                                    />
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                )}
            </Box>
        );
    }

    // Render benchmark results view
    return (
        <Box>
            <Box display="flex" alignItems="center" mb={3}>
                <Button
                    onClick={handleBackToBenchmarks}
                    startIcon={<ArrowBackIcon />}
                    sx={{ mr: 2 }}
                >
                    Back to Benchmarks
                </Button>
                <Typography variant="h4" component="h1">
                    {selectedBenchmark} Results
                </Typography>
            </Box>

            {benchmarkResults.length === 0 ? (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No results found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                No results found for this benchmark.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6">
                                Results ({benchmarkResults.length})
                            </Typography>
                            <Chip 
                                label={`${benchmarkResults.length} result${benchmarkResults.length !== 1 ? 's' : ''}`}
                                color="primary"
                                variant="outlined"
                            />
                        </Box>
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Model ID</strong></TableCell>
                                        <TableCell><strong>Source</strong></TableCell>
                                        <TableCell><strong>Tokenizer</strong></TableCell>
                                        <TableCell><strong>Timestamp</strong></TableCell>
                                        <TableCell align="center"><strong>Actions</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {benchmarkResults.map((result) => (
                                        <TableRow key={result.id} hover>
                                            <TableCell>{result.model_id}</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={result.source} 
                                                    size="small" 
                                                    color="secondary" 
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{result.tokenizer_id}</TableCell>
                                            <TableCell>{result.formattedTimestamp}</TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    component={Link}
                                                    to={`/results/${result.id}`}
                                                    variant="contained"
                                                    size="small"
                                                >
                                                    View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default DashboardPage; 