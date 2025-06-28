import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Code as CodeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import BenchmarkResults from './components/BenchmarkResults';
import { benchmarkResultsApi } from './utils/api';

function DetailPage() {
    const { pk } = useParams();
    const [resultData, setResultData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jsonModalOpen, setJsonModalOpen] = useState(false);
    const [rawJsonData, setRawJsonData] = useState(null);
    const [jsonLoading, setJsonLoading] = useState(false);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                setLoading(true);
                const response = await benchmarkResultsApi.get(pk);
                const { data } = response.data;
                setResultData(data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [pk]);

    const handleViewRawJson = async () => {
        try {
            setJsonLoading(true);
            const response = await benchmarkResultsApi.getRawInput(pk);
            setRawJsonData(response.data);
            setJsonModalOpen(true);
        } catch (error) {
            // Fallback to direct URL
            window.open(`/raw_input/${pk}`, '_blank');
        } finally {
            setJsonLoading(false);
        }
    };

    const handleCloseJsonModal = () => {
        setJsonModalOpen(false);
        setRawJsonData(null);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box>
                <Breadcrumbs sx={{ mb: 3 }}>
                    <Button
                        component={Link}
                        to="/"
                        startIcon={<ArrowBackIcon />}
                        size="small"
                    >
                        Dashboard
                    </Button>
                    <Typography color="text.primary">
                        Result Details
                    </Typography>
                </Breadcrumbs>

                <Alert severity="error">
                    Error loading result details: {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header with Navigation */}
            <Box mb={3}>
                <Breadcrumbs sx={{ mb: 2 }}>
                    <Button
                        component={Link}
                        to="/"
                        startIcon={<ArrowBackIcon />}
                        size="small"
                    >
                        Dashboard
                    </Button>
                    <Typography color="text.primary">
                        Result Details
                    </Typography>
                </Breadcrumbs>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h4" component="h1">
                        Benchmark Result Details
                    </Typography>
                    
                    <Box display="flex" gap={1}>
                        <Button
                            onClick={handleViewRawJson}
                            variant="outlined"
                            startIcon={<CodeIcon />}
                            size="medium"
                            disabled={jsonLoading}
                        >
                            {jsonLoading ? 'Loading...' : 'View Raw JSON'}
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Result Content */}
            {resultData ? (
                <BenchmarkResults data={resultData} />
            ) : (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No data found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                The requested benchmark result could not be found.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* JSON Modal */}
            <Dialog
                open={jsonModalOpen}
                onClose={handleCloseJsonModal}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { height: '80vh' }
                }}
            >
                <DialogTitle>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">Raw JSON Data</Typography>
                        <IconButton onClick={handleCloseJsonModal} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    <Box
                        component="pre"
                        sx={{
                            backgroundColor: '#f5f5f5',
                            padding: 2,
                            borderRadius: 1,
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            overflow: 'auto',
                            height: '100%',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {rawJsonData ? JSON.stringify(rawJsonData, null, 2) : 'Loading...'}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}

export default DetailPage; 