import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Compare as CompareIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { vllmManagementApi_functions } from '../utils/api';

const defaultConfig1 = {
  model_name: "Qwen/Qwen2-1.5B-Instruct",
  gpu_memory_utilization: 0.0,
  max_num_seqs: 2,
  block_size: 16,
  tensor_parallel_size: 1,
  pipeline_parallel_size: 1,
  trust_remote_code: false,
  dtype: "float32",
  max_model_len: 512,
  quantization: null,
  served_model_name: "test-model-cpu-1",
  port: 8000,
  host: "0.0.0.0",
  namespace: "vllm",
  gpu_resource_type: "cpu",
  gpu_resource_count: 0
};

const defaultConfig2 = {
  model_name: "Qwen/Qwen2-7B-Instruct",
  gpu_memory_utilization: 0.9,
  max_num_seqs: 128,
  block_size: 16,
  tensor_parallel_size: 1,
  pipeline_parallel_size: 1,
  trust_remote_code: false,
  dtype: "auto",
  max_model_len: 4096,
  quantization: null,
  served_model_name: "test-model-gpu-1",
  port: 8001,
  host: "0.0.0.0",
  namespace: "vllm",
  gpu_resource_type: "nvidia.com/gpu",
  gpu_resource_count: 1
};

function VllmComparisonPage() {
  const [config1Text, setConfig1Text] = useState(JSON.stringify(defaultConfig1, null, 2));
  const [config2Text, setConfig2Text] = useState(JSON.stringify(defaultConfig2, null, 2));
  const [comparisonResult, setComparisonResult] = useState(null);
  const [compatibilityCheck, setCompatibilityCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompareConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const config1 = JSON.parse(config1Text);
      const config2 = JSON.parse(config2Text);
      
      const [comparisonResponse, compatibility1Response, compatibility2Response] = await Promise.all([
        vllmManagementApi_functions.compareConfigs(config1, config2),
        vllmManagementApi_functions.checkCompatibility(config1),
        vllmManagementApi_functions.checkCompatibility(config2)
      ]);
      
      setComparisonResult(comparisonResponse.data);
      setCompatibilityCheck({
        config1: compatibility1Response.data,
        config2: compatibility2Response.data
      });
    } catch (err) {
      setError('Failed to compare configurations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDifferenceColor = (type) => {
    switch (type) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getDifferenceIcon = (type) => {
    switch (type) {
      case 'critical': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      case 'info': return <CheckIcon />;
      default: return null;
    }
  };

  const getCompatibilityStatus = (compatibility) => {
    if (!compatibility) return null;
    
    if (compatibility.compatible) {
      return <Chip icon={<CheckIcon />} label="Compatible" color="success" />;
    } else {
      return <Chip icon={<ErrorIcon />} label="Issues Found" color="error" />;
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Configuration Comparison & Analysis
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Compare two VLLM configurations to analyze differences, conflicts, and compatibility issues.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Configuration Editors */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuration 1
              </Typography>
              <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
                <MonacoEditor
                  height="400px"
                  language="json"
                  theme="vs-light"
                  value={config1Text}
                  onChange={(value) => setConfig1Text(value || '')}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14
                  }}
                />
              </Box>
              {compatibilityCheck && (
                <Box sx={{ mt: 2 }}>
                  {getCompatibilityStatus(compatibilityCheck.config1)}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuration 2
              </Typography>
              <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
                <MonacoEditor
                  height="400px"
                  language="json"
                  theme="vs-light"
                  value={config2Text}
                  onChange={(value) => setConfig2Text(value || '')}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14
                  }}
                />
              </Box>
              {compatibilityCheck && (
                <Box sx={{ mt: 2 }}>
                  {getCompatibilityStatus(compatibilityCheck.config2)}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Compare Button */}
        <Grid item xs={12}>
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<CompareIcon />}
              onClick={handleCompareConfigs}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Compare Configurations'}
            </Button>
          </Box>
        </Grid>

        {/* Comparison Results */}
        {comparisonResult && (
          <>
            {/* Summary */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Comparison Summary
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {comparisonResult.total_differences || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Differences
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="error">
                          {comparisonResult.critical_differences || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Critical Issues
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color={comparisonResult.compatible ? 'success' : 'error'}>
                          {comparisonResult.compatible ? 'YES' : 'NO'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Compatible
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {comparisonResult.resource_conflict && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Resource Conflict:</strong> {comparisonResult.resource_conflict.message}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Detailed Differences */}
            {comparisonResult.differences && comparisonResult.differences.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Detailed Differences
                    </Typography>
                    
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Field</TableCell>
                            <TableCell>Configuration 1</TableCell>
                            <TableCell>Configuration 2</TableCell>
                            <TableCell>Impact</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparisonResult.differences.map((diff, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  {diff.field}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {JSON.stringify(diff.value1)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {JSON.stringify(diff.value2)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  icon={getDifferenceIcon(diff.impact)}
                                  label={diff.impact}
                                  color={getDifferenceColor(diff.impact)}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Recommendations */}
            {comparisonResult.recommendations && comparisonResult.recommendations.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recommendations
                    </Typography>
                    
                    {comparisonResult.recommendations.map((recommendation, index) => (
                      <Accordion key={index}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip
                              label={recommendation.priority}
                              color={getDifferenceColor(recommendation.priority)}
                              size="small"
                              sx={{ mr: 2 }}
                            />
                            <Typography variant="body1">
                              {recommendation.title}
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="body2" paragraph>
                            {recommendation.description}
                          </Typography>
                          
                          {recommendation.suggested_action && (
                            <Alert severity="info">
                              <Typography variant="body2">
                                <strong>Suggested Action:</strong> {recommendation.suggested_action}
                              </Typography>
                            </Alert>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </>
        )}

        {/* Compatibility Details */}
        {compatibilityCheck && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Compatibility Analysis
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Configuration 1
                    </Typography>
                    {getCompatibilityStatus(compatibilityCheck.config1)}
                    
                    {compatibilityCheck.config1.issues && compatibilityCheck.config1.issues.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        {compatibilityCheck.config1.issues.map((issue, index) => (
                          <Alert key={index} severity={issue.severity} sx={{ mb: 1 }}>
                            <Typography variant="body2">
                              <strong>{issue.field}:</strong> {issue.message}
                            </Typography>
                          </Alert>
                        ))}
                      </Box>
                    )}
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Configuration 2
                    </Typography>
                    {getCompatibilityStatus(compatibilityCheck.config2)}
                    
                    {compatibilityCheck.config2.issues && compatibilityCheck.config2.issues.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        {compatibilityCheck.config2.issues.map((issue, index) => (
                          <Alert key={index} severity={issue.severity} sx={{ mb: 1 }}>
                            <Typography variant="body2">
                              <strong>{issue.field}:</strong> {issue.message}
                            </Typography>
                          </Alert>
                        ))}
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default VllmComparisonPage;