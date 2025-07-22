import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Settings as SettingsIcon,
  Work as BenchmarkIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { vllmManagementApi_functions } from '../utils/api';

const VllmManagementPage = () => {
  const [queueData, setQueueData] = useState([]);
  const [processingRequests, setProcessingRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [completedRequests, setCompletedRequests] = useState([]);
  const [queueStatus, setQueueStatus] = useState({
    total_requests: 0,
    pending_requests: 0,
    processing_requests: 0,
    completed_requests: 0,
    failed_requests: 0,
    cancelled_requests: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [currentDeployments, setCurrentDeployments] = useState([]);

  useEffect(() => {
    console.log('VllmManagementPage: Component mounted, starting data load');
    loadQueueData();
    loadCurrentDeployments();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('VllmManagementPage: Auto-refresh triggered');
      loadQueueData();
      loadCurrentDeployments();
    }, 30000);
    return () => {
      console.log('VllmManagementPage: Component unmounted, clearing interval');
      clearInterval(interval);
    };
  }, []);

  const loadQueueData = async () => {
    try {
      console.log('VllmManagementPage: loadQueueData called');
      setLoading(true);
      
      // API calls to VLLM Management queue endpoints via nginx proxy
      console.log('VllmManagementPage: Making API calls to benchmark-vllm service');
      const [queueResponse, statusResponse] = await Promise.all([
        vllmManagementApi_functions.getQueueList(),
        vllmManagementApi_functions.getQueueStatus()
      ]);
      
      console.log('VllmManagementPage: API responses received');

      const queueList = queueResponse.data;
      const status = statusResponse.data;
      
      console.log('VllmManagementPage: Data received', {
        queueListLength: queueList.length,
        status: status
      });
      
      // 큐 데이터를 상태별로 분리
      const processing = queueList.filter(req => req.status === 'processing');
      const pending = queueList.filter(req => req.status === 'pending');
      const completed = queueList.filter(req => 
        req.status === 'completed' || 
        req.status === 'failed' || 
        req.status === 'cancelled'
      );
      
      setQueueData(queueList);
      setProcessingRequests(processing);
      setPendingRequests(pending);
      setCompletedRequests(completed);
      setQueueStatus(status);
      setError(null);
    } catch (err) {
      console.error('VllmManagementPage: Error loading queue data:', err);
      setError(`Failed to load queue data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentDeployments = async () => {
    try {
      // VLLM 배포 목록을 가져옵니다
      const response = await vllmManagementApi_functions.listDeployments();
      
      if (response.data) {
        // running 상태인 배포만 필터링
        const runningDeployments = Object.values(response.data).filter(
          deployment => deployment.status === 'running'
        );
        setCurrentDeployments(runningDeployments);
      } else {
        // API 호출 실패 시 빈 배열로 설정 (에러는 표시하지 않음)
        setCurrentDeployments([]);
      }
    } catch (err) {
      // 네트워크 에러 등의 경우 빈 배열로 설정 (에러는 표시하지 않음)
      console.warn('Failed to load current VLLM deployments:', err.message);
      setCurrentDeployments([]);
    }
  };

  const handleCancelRequest = async (queueRequestId, requestStatus) => {
    // Show confirmation dialog
    let action, confirmMessage, actionMessage;
    
    if (requestStatus === 'processing') {
      action = 'cancel';
      confirmMessage = 'Are you sure you want to cancel this request? This will stop any running jobs and clean up resources.';
      actionMessage = 'Request cancelled successfully! All associated jobs have been cleaned up.';
    } else if (requestStatus === 'failed') {
      // For failed requests, offer both regular delete and force delete
      const forceDelete = window.confirm(
        'This request has failed. Choose:\n' +
        'OK - Force delete (clean up any remaining resources)\n' +
        'Cancel - Regular delete (only if no resources are running)'
      );
      
      action = forceDelete ? 'force-delete' : 'delete';
      confirmMessage = forceDelete 
        ? 'Are you sure you want to force delete this failed request? This will clean up any remaining resources.'
        : 'Are you sure you want to delete this failed request?';
      actionMessage = forceDelete
        ? 'Failed request force deleted successfully! All resources have been cleaned up.'
        : 'Failed request deleted successfully!';
    } else {
      action = 'delete';
      confirmMessage = 'Are you sure you want to delete this request?';
      actionMessage = 'Request deleted successfully!';
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      if (requestStatus === 'processing') {
        // For processing requests, use cancel endpoint
        await vllmManagementApi_functions.cancelQueueRequest(queueRequestId);
      } else if (action === 'force-delete') {
        // For force delete, use the force delete endpoint
        await vllmManagementApi_functions.forceDeleteQueueRequest(queueRequestId);
      } else {
        // For regular delete, use delete endpoint
        await vllmManagementApi_functions.deleteQueueRequest(queueRequestId);
      }

      await loadQueueData();
      alert(actionMessage);
    } catch (err) {
      console.error(`Error ${action}ing request:`, err);
      
      // If regular delete failed for a failed request, suggest force delete
      if (action === 'delete' && requestStatus === 'failed' && err.response?.status === 400) {
        const tryForceDelete = window.confirm(
          `Regular delete failed: ${err.message}\n\n` +
          'This might be because some resources are still running. ' +
          'Would you like to try force delete instead?'
        );
        
        if (tryForceDelete) {
          try {
            await vllmManagementApi_functions.forceDeleteQueueRequest(queueRequestId);
            await loadQueueData();
            alert('Request force deleted successfully! All resources have been cleaned up.');
          } catch (forceErr) {
            console.error('Error force deleting request:', forceErr);
            alert(`Failed to force delete request: ${forceErr.message}`);
          }
        }
      } else {
        alert(`Failed to ${action} request: ${err.message}`);
      }
    }
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'pending': return 'info';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status, currentStep) => {
    // Handle special VLLM failure case
    if (status === 'failed' && currentStep === 'vllm_deployment_failed') {
      return 'VLLM 배포 실패';
    }
    
    switch (status) {
      case 'completed': return '완료';
      case 'processing': 
        if (currentStep === 'vllm_deployment') return '처리 중 (VLLM 배포)';
        if (currentStep === 'benchmark_jobs') return '처리 중 (벤치마크 실행)';
        if (currentStep && currentStep.startsWith('benchmark_job_')) {
          const jobNumber = currentStep.split('_')[2];
          return `처리 중 (벤치마크 작업 ${jobNumber})`;
        }
        return '처리 중';
      case 'pending': return '대기 중';
      case 'failed': return '실패';
      case 'cancelled': return '취소됨';
      default: return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getDisplayModelName = (request) => {
    // VLLM 설정이 있는 경우 해당 모델명 표시
    if (request.vllm_config?.model_name) {
      return request.vllm_config.model_name;
    }
    
    // VLLM 설정이 없는 경우, Job YAML에서 VLLM_ENDPOINT를 파싱하여 해당 모델 찾기
    const modelFromEndpoint = getModelFromJobEndpoint(request);
    if (modelFromEndpoint) {
      return `${modelFromEndpoint} (기존 VLLM 사용)`;
    }
    
    // Job에서 엔드포인트를 찾을 수 없는 경우, 현재 배포된 모델 중 첫 번째 사용
    if (currentDeployments.length > 0) {
      const firstRunningModel = currentDeployments[0];
      return `${firstRunningModel.config?.model_name || 'Unknown Model'} (기존 VLLM 사용)`;
    }
    
    // 배포된 VLLM이 없는 경우
    return 'No VLLM (Benchmark Only)';
  };

  const getModelFromJobEndpoint = (request) => {
    try {
      // benchmark_configs에서 VLLM_ENDPOINT를 찾아 해당 서비스의 모델 정보를 가져옴
      if (request.benchmark_configs && request.benchmark_configs.length > 0) {
        for (const config of request.benchmark_configs) {
          const yamlContent = config.yaml_content;
          if (yamlContent) {
            // VLLM_ENDPOINT 환경변수에서 서비스 이름 추출 (다양한 형태 지원)
            const endpointMatch = yamlContent.match(/VLLM_ENDPOINT[^:]*:\s*['"]*([^'"\n]+)['"]/);
            if (endpointMatch) {
              const endpoint = endpointMatch[1].trim();
              // http://service-name:port 또는 service-name:port 형태에서 service-name 추출
              const serviceMatch = endpoint.match(/(?:https?:\/\/)?([^:\/\s]+)(?::\d+)?/);
              if (serviceMatch) {
                const serviceName = serviceMatch[1];
                // 현재 배포된 서비스 중에서 해당 서비스 이름과 매칭되는 모델 찾기
                const matchingDeployment = currentDeployments.find(deployment => {
                  const deploymentServiceName = deployment.k8s_service_name;
                  return deploymentServiceName === serviceName || 
                         deploymentServiceName?.includes(serviceName) ||
                         serviceName.includes(deploymentServiceName);
                });
                
                if (matchingDeployment) {
                  return matchingDeployment.config?.model_name;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing job endpoint:', error);
    }
    return null;
  };

  const getStepProgress = (request) => {
    if (request.status === 'completed') return 100;
    if (request.status === 'failed' || request.status === 'cancelled') return 0;
    if (request.status === 'pending') return 0;
    
    // For processing status, calculate based on current step
    if (request.status === 'processing') {
      const currentStep = request.current_step;
      const hasVllm = request.vllm_config && !request.skip_vllm_creation;
      const benchmarkCount = request.benchmark_configs ? request.benchmark_configs.length : 0;
      
      // Calculate total steps: VLLM deployment (if needed) + benchmark jobs
      const totalSteps = (hasVllm ? 1 : 0) + benchmarkCount;
      
      if (totalSteps === 0) return 0;
      
      let completedSteps = 0;
      
      // Check VLLM deployment step
      if (hasVllm) {
        if (currentStep === 'vllm_deployment') {
          completedSteps = 0.5; // In progress
        } else if (currentStep === 'benchmark_jobs' || currentStep?.startsWith('benchmark_job_')) {
          completedSteps = 1; // VLLM deployment completed
        } else if (currentStep === 'vllm_deployment_failed') {
          return 25; // Failed at VLLM deployment
        }
      }
      
      // Check benchmark jobs
      if (currentStep === 'benchmark_jobs') {
        completedSteps += 0.5; // Starting benchmark jobs
      } else if (currentStep?.startsWith('benchmark_job_')) {
        const jobMatch = currentStep.match(/benchmark_job_(\d+)/);
        if (jobMatch) {
          const jobNumber = parseInt(jobMatch[1]);
          completedSteps += Math.min(jobNumber / benchmarkCount, benchmarkCount);
        }
      }
      
      return Math.round((completedSteps / totalSteps) * 100);
    }
    
    return 0;
  };

  const getProgressText = (request) => {
    if (request.status === 'completed') return '완료';
    if (request.status === 'failed') return '실패';
    if (request.status === 'cancelled') return '취소됨';
    if (request.status === 'pending') return '대기 중';
    
    if (request.status === 'processing') {
      const currentStep = request.current_step;
      const hasVllm = request.vllm_config && !request.skip_vllm_creation;
      const benchmarkCount = request.benchmark_configs ? request.benchmark_configs.length : 0;
      const totalSteps = (hasVllm ? 1 : 0) + benchmarkCount;
      
      let currentStepNumber = 0;
      let stepDescription = '';
      
      if (hasVllm) {
        if (currentStep === 'vllm_deployment') {
          currentStepNumber = 1;
          stepDescription = 'VLLM 배포 중';
        } else if (currentStep === 'vllm_deployment_failed') {
          return '1/' + totalSteps + ' - VLLM 배포 실패';
        } else if (currentStep === 'benchmark_jobs' || currentStep?.startsWith('benchmark_job_')) {
          currentStepNumber = 1; // VLLM completed
          if (currentStep === 'benchmark_jobs') {
            currentStepNumber++;
            stepDescription = '벤치마크 시작 중';
          } else if (currentStep?.startsWith('benchmark_job_')) {
            const jobMatch = currentStep.match(/benchmark_job_(\d+)/);
            if (jobMatch) {
              const jobNumber = parseInt(jobMatch[1]);
              currentStepNumber = 1 + jobNumber;
              stepDescription = `벤치마크 작업 ${jobNumber}`;
            }
          }
        }
      } else {
        // No VLLM deployment needed
        if (currentStep === 'benchmark_jobs') {
          currentStepNumber = 1;
          stepDescription = '벤치마크 시작 중';
        } else if (currentStep?.startsWith('benchmark_job_')) {
          const jobMatch = currentStep.match(/benchmark_job_(\d+)/);
          if (jobMatch) {
            const jobNumber = parseInt(jobMatch[1]);
            currentStepNumber = jobNumber;
            stepDescription = `벤치마크 작업 ${jobNumber}`;
          }
        }
      }
      
      return `${currentStepNumber}/${totalSteps} - ${stepDescription}`;
    }
    
    return request.status;
  };

  const renderStepperForRequest = (request) => {
    const steps = ['VLLM Deployment'];
    
    // Add benchmark job steps
    if (request.benchmark_configs && request.benchmark_configs.length > 0) {
      request.benchmark_configs.forEach((_, index) => {
        steps.push(`Benchmark Job ${index + 1}`);
      });
    }

    const activeStep = request.completed_steps;
    const isError = request.status === 'failed';
    const isCompleted = request.status === 'completed';

    return (
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 2 }}>
        {steps.map((label, index) => (
          <Step key={label} completed={isCompleted || index < activeStep}>
            <StepLabel 
              error={isError && index === activeStep}
              icon={
                isCompleted || index < activeStep ? (
                  <CheckCircleIcon color="success" />
                ) : isError && index === activeStep ? (
                  <ErrorIcon color="error" />
                ) : undefined
              }
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    );
  };

  const renderQueueTable = (requests, title, emptyMessage) => {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title} ({requests.length})
          </Typography>
          
          {requests.length === 0 ? (
            <Box textAlign="center" py={2}>
              <Typography color="textSecondary">
                {emptyMessage}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Request ID</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.queue_request_id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {request.queue_request_id.slice(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getDisplayModelName(request)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.benchmark_configs?.length || 0} benchmark jobs
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(request.status, request.current_step)}
                          color={getStatusColor(request.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={request.priority}
                          color={getPriorityColor(request.priority)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ width: 200 }}>
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={getStepProgress(request)}
                            sx={{ mb: 1 }}
                            color={
                              request.status === 'failed' ? 'error' :
                              request.status === 'completed' ? 'success' : 'primary'
                            }
                          />
                          <Typography variant="caption">
                            {getProgressText(request)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(request.created_at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          onClick={() => handleViewDetails(request)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                        {(request.status === 'pending' || request.status === 'processing' || 
                          request.status === 'completed' || request.status === 'failed' || request.status === 'cancelled') && (
                          <IconButton
                            color="error"
                            onClick={() => handleCancelRequest(request.queue_request_id, request.status)}
                            title={request.status === 'processing' ? 'Cancel Request' : 'Delete Request'}
                          >
                            <StopIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDetailDialog = () => {
    if (!selectedRequest) return null;

    return (
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Queue Request Details - {selectedRequest.queue_request_id.slice(0, 8)}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    VLLM Configuration
                  </Typography>
                  {selectedRequest.vllm_config ? (
                    <>
                      <Typography><strong>Model:</strong> {selectedRequest.vllm_config.model_name || 'Not specified'}</Typography>
                      <Typography><strong>Namespace:</strong> {selectedRequest.vllm_config.namespace || 'vllm'}</Typography>
                      <Typography><strong>GPU Resource:</strong> {selectedRequest.vllm_config.gpu_resource_type || 'cpu'} x {selectedRequest.vllm_config.gpu_resource_count || 0}</Typography>
                      <Typography><strong>Max Sequences:</strong> {selectedRequest.vllm_config.max_num_seqs || 2}</Typography>
                      <Typography><strong>Block Size:</strong> {selectedRequest.vllm_config.block_size || 16}</Typography>
                      <Typography><strong>Tensor Parallel Size:</strong> {selectedRequest.vllm_config.tensor_parallel_size || 1}</Typography>
                      <Typography><strong>Pipeline Parallel Size:</strong> {selectedRequest.vllm_config.pipeline_parallel_size || 1}</Typography>
                      <Typography><strong>Data Type:</strong> {selectedRequest.vllm_config.dtype || 'float32'}</Typography>
                      <Typography><strong>GPU Memory:</strong> {(selectedRequest.vllm_config.gpu_memory_utilization || 0) * 100}%</Typography>
                      <Typography><strong>Port:</strong> {selectedRequest.vllm_config.port || 8000}</Typography>
                      <Typography><strong>Host:</strong> {selectedRequest.vllm_config.host || '0.0.0.0'}</Typography>
                      {selectedRequest.vllm_config.max_model_len && (
                        <Typography><strong>Max Model Length:</strong> {selectedRequest.vllm_config.max_model_len}</Typography>
                      )}
                      {selectedRequest.vllm_config.quantization && (
                        <Typography><strong>Quantization:</strong> {selectedRequest.vllm_config.quantization}</Typography>
                      )}
                      {selectedRequest.vllm_config.served_model_name && (
                        <Typography><strong>Served Model:</strong> {selectedRequest.vllm_config.served_model_name}</Typography>
                      )}
                      <Typography><strong>Trust Remote Code:</strong> {selectedRequest.vllm_config.trust_remote_code ? 'Yes' : 'No'}</Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      {(() => {
                        const modelFromEndpoint = getModelFromJobEndpoint(selectedRequest);
                        if (modelFromEndpoint) {
                          return `Using existing VLLM: ${modelFromEndpoint}`;
                        }
                        return currentDeployments.length > 0 
                          ? `Using existing VLLM: ${currentDeployments[0].config?.model_name || 'Unknown Model'}` 
                          : 'No VLLM configuration - Benchmark jobs only';
                      })()}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Request Information
                  </Typography>
                  <Typography><strong>Status:</strong> 
                    <Chip 
                      label={selectedRequest.status} 
                      color={getStatusColor(selectedRequest.status)} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Typography><strong>Priority:</strong>
                    <Chip 
                      label={selectedRequest.priority} 
                      color={getPriorityColor(selectedRequest.priority)} 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Typography><strong>Created:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</Typography>
                  {selectedRequest.started_at && (
                    <Typography><strong>Started:</strong> {new Date(selectedRequest.started_at).toLocaleString()}</Typography>
                  )}
                  {selectedRequest.completed_at && (
                    <Typography><strong>Completed:</strong> {new Date(selectedRequest.completed_at).toLocaleString()}</Typography>
                  )}
                  <Typography><strong>Progress:</strong> {selectedRequest.completed_steps}/{selectedRequest.total_steps} steps</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <BenchmarkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Benchmark Jobs ({selectedRequest.benchmark_configs?.length || 0})
                  </Typography>
                  
                  {selectedRequest.benchmark_configs && selectedRequest.benchmark_configs.length > 0 ? (
                    <List>
                      {selectedRequest.benchmark_configs.map((job, index) => (
                        <div key={index}>
                          <ListItem>
                            <ListItemIcon>
                              <BenchmarkIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary={job.name || `Benchmark Job ${index + 1}`}
                              secondary={`Namespace: ${job.namespace} | Project: ${job.project_id || 'None'}`}
                            />
                          </ListItem>
                          {index < selectedRequest.benchmark_configs.length - 1 && <Divider />}
                        </div>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No benchmark jobs configured</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Progress Timeline</Typography>
                  {renderStepperForRequest(selectedRequest)}
                  
                  {selectedRequest.current_step && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Step: {selectedRequest.current_step}
                      </Typography>
                    </Box>
                  )}
                  
                  {selectedRequest.error_message && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {selectedRequest.error_message}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (loading && queueData.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          VLLM Deployment Queue
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadQueueData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Queue Status Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {queueStatus.total_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {queueStatus.pending_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {queueStatus.processing_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Processing
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {queueStatus.completed_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {queueStatus.failed_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="text.secondary">
                {queueStatus.cancelled_requests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cancelled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Processing Requests */}
      {renderQueueTable(
        processingRequests,
        "🔄 현재 처리 중인 요청",
        "현재 처리 중인 요청이 없습니다."
      )}

      {/* Pending Requests */}
      {renderQueueTable(
        pendingRequests,
        "⏳ 대기 중인 요청",
        "대기 중인 요청이 없습니다."
      )}

      {/* Completed Requests */}
      {renderQueueTable(
        completedRequests,
        "✅ 완료된 요청 (완료/실패/취소)",
        "완료된 요청이 없습니다."
      )}

      {/* Detail Dialog */}
      {renderDetailDialog()}
    </Box>
  );
};

export default VllmManagementPage;