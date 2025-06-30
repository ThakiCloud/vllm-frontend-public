import {
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';

const truncate = (str, maxLength) => {
    if (!str || typeof str !== 'string' || str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength) + '...';
};

const renderValue = (value) => {
    if (typeof value === 'object') {
        return (
            <Box
                component="pre"
                sx={{
                    backgroundColor: '#f5f5f5',
                    padding: 1,
                    borderRadius: 1,
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: '200px',
                }}
            >
                {JSON.stringify(value, null, 2)}
            </Box>
        );
    }
    
    const stringValue = value?.toString() || '';

    if (typeof value === 'number' && !Number.isInteger(value)) {
        return (
            <Tooltip title={stringValue}>
                <Chip
                    label={value.toFixed(4)}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
            </Tooltip>
        );
    }

    if (stringValue.length > 40) {
        return (
            <Tooltip title={stringValue}>
                <Typography variant="body2" sx={{ cursor: 'help' }}>
                    {truncate(stringValue, 40)}
                </Typography>
            </Tooltip>
        );
    }
    
    return (
        <Typography variant="body2" component="span">
            {stringValue}
        </Typography>
    );
};

const DataCard = ({ title, data, icon }) => {
    if (typeof data !== 'object' || data === null) {
        return (
            <Card sx={{ height: '100%' }}>
                <CardHeader
                    avatar={icon}
                    title={title}
                    titleTypographyProps={{ variant: 'h6' }}
                />
                <CardContent>
                    <Box textAlign="center" py={2}>
                        <Typography variant="h6" color="text.secondary">
                            결과 없음
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const entries = Object.entries(data)
        .sort(([, aValue], [, bValue]) => {
            const aIsObject = typeof aValue === 'object' && aValue !== null;
            const bIsObject = typeof bValue === 'object' && bValue !== null;

            if (aIsObject === bIsObject) {
                return 0; // Keep original order for pairs of same type
            }
            return aIsObject ? 1 : -1; // Primitives first, then objects
        })
        .filter(([, value]) => value !== null && value !== undefined);

    if (entries.length === 0) {
        return (
            <Card sx={{ height: '100%' }}>
                <CardHeader
                    avatar={icon}
                    title={title}
                    titleTypographyProps={{ variant: 'h6' }}
                />
                <CardContent>
                    <Box textAlign="center" py={10}>
                        <Typography variant="h4" color="text.secondary">
                            No data
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const primitiveEntries = entries.filter(([, value]) => typeof value !== 'object');
    const objectEntries = entries.filter(([, value]) => typeof value === 'object');

    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader
                avatar={icon}
                title={title}
                titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
                {/* Primitive values as table */}
                {primitiveEntries.length > 0 && (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableBody>
                                {primitiveEntries.map(([key, value]) => (
                                    <TableRow key={key} hover>
                                        <TableCell component="th" scope="row" sx={{ fontWeight: 'medium', width: '40%' }}>
                                            <Tooltip title={key}>
                                                <Typography variant="body2" noWrap>
                                                    {truncate(key, 30)}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{renderValue(value)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Object values as accordions */}
                {objectEntries.map(([key, value]) => (
                    <Accordion key={key} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                                {key}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <DataCard title={key} data={value} />
                        </AccordionDetails>
                    </Accordion>
                ))}
            </CardContent>
        </Card>
    );
};

function BenchmarkResults({ data }) {
    if (!data) {
        return (
            <Card>
                <CardContent>
                    <Box textAlign="center" py={4}>
                        <Typography variant="h6" color="text.secondary">
                            No data to display
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const { meta, results, performance } = data;

    return (
        <Box>
            <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
                {meta?.benchmark_name || 'Benchmark Details'}
            </Typography>

            <Grid container spacing={3}>
                {/* Meta Information */}
                <Grid item xs={12} lg={6}>
                    <DataCard
                        title="Meta Information"
                        data={meta}
                        icon={<InfoIcon color="primary" />}
                    />
                </Grid>

                {/* Quality Results */}
                <Grid item xs={12} lg={6}>
                    <DataCard
                        title="Quality Results"
                        data={results}
                        icon={<AssessmentIcon color="secondary" />}
                    />
                </Grid>

                {/* Performance Summary */}
                <Grid item xs={12} lg={4}>
                    <DataCard
                        title="Performance Summary"
                        data={performance.summary}
                        icon={<SpeedIcon color="success" />}
                    />
                </Grid>

                {/* Throughput */}
                <Grid item xs={12} lg={4}>
                    <DataCard
                        title="Throughput"
                        data={performance.throughput}
                        icon={<TimelineIcon color="warning" />}
                    />
                </Grid>

                {/* Latency */}
                <Grid item xs={12} lg={4}>
                    <DataCard
                        title="Latency"
                        data={performance.latency}
                        icon={<TimerIcon color="error" />}
                    />
                </Grid>
            </Grid>
        </Box>
    );
}

export default BenchmarkResults; 