import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  Memory,
  Speed
} from '@mui/icons-material';
import { vllmManagementApi_functions } from '../utils/api';

function VllmMonitoringPage({ systemStatus }) {
  const [gpuAnalysis, setGpuAnalysis] = useState(null);
  const [deploymentComparison, setDeploymentComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMonitoringData();
    // Refresh monitoring data every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      const [gpuResponse, comparisonResponse] = await Promise.all([
        vllmManagementApi_functions.analyzeGpuResources(),
        vllmManagementApi_functions.compareDeployments()
      ]);
      
      setGpuAnalysis(gpuResponse.data);
      setDeploymentComparison(comparisonResponse.data);
      setError(null);
    } catch (err) {
      setError('Failed to load monitoring data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getResourceUtilization = () => {
    if (!gpuAnalysis || !gpuAnalysis.resource_usage) return [];
    
    return Object.entries(gpuAnalysis.resource_usage).map(([resourceType, data]) => ({
      type: resourceType,
      used: data.used || 0,
      total: data.total || 1,
      percentage: Math.round(((data.used || 0) / (data.total || 1)) * 100)
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        VLLM Monitoring Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* System Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 1 }} />
                <Typography variant="h6">System Overview</Typography>
              </Box>
              
              {systemStatus ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Service Status:</strong>{' '}
                    <Chip 
                      label={systemStatus.status} 
                      color={systemStatus.status === 'healthy' ? 'success' : 'error'}
                      size="small" 
                    />
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Active Deployments:</strong> {systemStatus.active_deployments}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Service:</strong> {systemStatus.service}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Last Check:</strong> {new Date(systemStatus.last_check).toLocaleString()}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  System status not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* GPU Resource Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Memory sx={{ mr: 1 }} />
                <Typography variant="h6">GPU Resource Usage</Typography>
              </Box>
              
              {getResourceUtilization().length > 0 ? (
                <Box>
                  {getResourceUtilization().map((resource) => (
                    <Box key={resource.type} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{resource.type}</Typography>
                        <Typography variant="body2">
                          {resource.used}/{resource.total} ({resource.percentage}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={resource.percentage}
                        color={resource.percentage > 80 ? 'error' : resource.percentage > 60 ? 'warning' : 'primary'}
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No GPU resource data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Deployment Conflicts */}
        {deploymentComparison && deploymentComparison.conflicts && deploymentComparison.conflicts.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  Resource Conflicts Detected
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Deployment 1</TableCell>
                        <TableCell>Deployment 2</TableCell>
                        <TableCell>Conflict Type</TableCell>
                        <TableCell>Resource</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {deploymentComparison.conflicts.map((conflict, index) => (
                        <TableRow key={index}>
                          <TableCell>{conflict.deployment1_name}</TableCell>
                          <TableCell>{conflict.deployment2_name}</TableCell>
                          <TableCell>
                            <Chip label={conflict.conflict_type} color="error" size="small" />
                          </TableCell>
                          <TableCell>{conflict.resource_type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Deployment Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Timeline sx={{ mr: 1 }} />
                <Typography variant="h6">Deployment Statistics</Typography>
              </Box>
              
              {deploymentComparison && deploymentComparison.statistics ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Total Deployments:</strong> {deploymentComparison.statistics.total_deployments || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Running:</strong> {deploymentComparison.statistics.running_deployments || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Failed:</strong> {deploymentComparison.statistics.failed_deployments || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Success Rate:</strong> {
                      deploymentComparison.statistics.success_rate 
                        ? `${Math.round(deploymentComparison.statistics.success_rate * 100)}%`
                        : 'N/A'
                    }
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Statistics not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Speed sx={{ mr: 1 }} />
                <Typography variant="h6">Performance Metrics</Typography>
              </Box>
              
              {deploymentComparison && deploymentComparison.performance ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Avg. Deployment Time:</strong> {
                      deploymentComparison.performance.avg_deployment_time 
                        ? `${Math.round(deploymentComparison.performance.avg_deployment_time)}s`
                        : 'N/A'
                    }
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Fastest Deployment:</strong> {
                      deploymentComparison.performance.fastest_deployment 
                        ? `${Math.round(deploymentComparison.performance.fastest_deployment)}s`
                        : 'N/A'
                    }
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Slowest Deployment:</strong> {
                      deploymentComparison.performance.slowest_deployment 
                        ? `${Math.round(deploymentComparison.performance.slowest_deployment)}s`
                        : 'N/A'
                    }
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Performance metrics not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        {deploymentComparison && deploymentComparison.recent_activity && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>Deployment</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {deploymentComparison.recent_activity.map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(activity.timestamp).toLocaleString()}</TableCell>
                          <TableCell>{activity.event}</TableCell>
                          <TableCell>{activity.deployment_name}</TableCell>
                          <TableCell>
                            <Chip 
                              label={activity.status} 
                              color={activity.status === 'success' ? 'success' : 'error'}
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
      </Grid>
    </Box>
  );
}

export default VllmMonitoringPage;