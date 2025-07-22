import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Visibility as ViewIcon,
  Assignment as LogIcon
} from '@mui/icons-material';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { vllmManagementApi_functions, projectsApi, filesApi, deployerApi_functions } from '../utils/api';

const defaultVllmConfig = {
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
  served_model_name: "test-model-cpu",
  port: 8000,
  host: "0.0.0.0",
  namespace: "vllm",
  gpu_resource_type: "cpu",
  gpu_resource_count: 0,
  additional_args: {
    "disable-log-stats": true,
    "disable-log-requests": true,
    "enforce-eager": true,
    "disable-custom-all-reduce": true
  }
};

const defaultBenchmarkConfig = {
  auto_trigger: true,
  dataset: "alpaca_eval",
  metrics: ["throughput", "latency"],
  test_cases: []
};

function VllmQueuePage() {
  const [queueList, setQueueList] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [configText, setConfigText] = useState(JSON.stringify(defaultVllmConfig, null, 2));
  const [createBenchmarkJobs, setCreateBenchmarkJobs] = useState(false);
  const [benchmarkJobs, setBenchmarkJobs] = useState([{
    id: 1,
    name: 'benchmark-job-1',
    namespace: 'default',
    yaml_content: JSON.stringify(defaultBenchmarkConfig, null, 2),
    selectedProject: '',
    jobFiles: [],
    selectedJobFile: '',
    configFiles: [],
    selectedConfigFile: '',
    originalJobYaml: '',
    loadingFiles: false
  }]);
  const [priority, setPriority] = useState('medium');
  const [immediate, setImmediate] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Project management states
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Log viewing states
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedRequestLogs, setSelectedRequestLogs] = useState(null);
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentDeployments, setCurrentDeployments] = useState([]);

  useEffect(() => {
    loadQueueData();
    loadCurrentDeployments();
    // Refresh queue every 10 seconds
    const interval = setInterval(() => {
      loadQueueData();
      loadCurrentDeployments();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (createDialogOpen && createBenchmarkJobs) {
      fetchProjects();
    }
  }, [createDialogOpen, createBenchmarkJobs]);

  const loadQueueData = async () => {
    try {
      setLoading(true);
      const [queueResponse, statusResponse] = await Promise.all([
        vllmManagementApi_functions.getQueueList(),
        vllmManagementApi_functions.getQueueStatus()
      ]);
      setQueueList(queueResponse.data);
      setQueueStatus(statusResponse.data);
      setError(null);
    } catch (err) {
      setError('Failed to load queue data: ' + err.message);
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
        setCurrentDeployments([]);
      }
    } catch (err) {
      // 네트워크 에러 등의 경우 빈 배열로 설정 (에러는 표시하지 않음)
      console.warn('Failed to load current VLLM deployments:', err.message);
      setCurrentDeployments([]);
    }
  };

  const handleAddToQueue = async () => {
    try {
      setCreating(true);
      const vllmConfig = JSON.parse(configText);
      
      // Prepare benchmark configs
      const benchmarkConfigs = [];
      if (createBenchmarkJobs) {
        benchmarkJobs.forEach(job => {
          benchmarkConfigs.push({
            yaml_content: job.yaml_content,
            namespace: job.namespace,
            name: job.name
          });
        });
      }
      
      const schedulingConfig = {
        immediate,
        scheduled_time: immediate ? null : scheduledTime,
        max_wait_time: 3600 // 1 hour default
      };

      await vllmManagementApi_functions.addToQueue(
        vllmConfig,
        benchmarkConfigs, // Always pass array, even if empty
        schedulingConfig,
        priority
      );
      
      setCreateDialogOpen(false);
      resetForm();
      await loadQueueData();
    } catch (err) {
      setError('Failed to add to queue: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCancelRequest = async (requestId, requestStatus = null) => {
    // Determine request status if not provided
    if (!requestStatus) {
      const request = queueList.find(r => r.queue_request_id === requestId);
      requestStatus = request?.status || 'unknown';
    }
    
    let action, confirmMessage;
    
    if (requestStatus === 'processing') {
      action = 'cancel';
      confirmMessage = 'Are you sure you want to cancel this request? This will stop any running jobs and clean up resources.';
    } else if (requestStatus === 'failed') {
      // For failed requests, offer force delete option
      const forceDelete = window.confirm(
        'This request has failed. Choose:\n' +
        'OK - Force delete (clean up any remaining resources)\n' +
        'Cancel - Regular delete (only if no resources are running)'
      );
      
      if (!forceDelete) {
        // User chose regular delete, show confirmation
        if (!window.confirm('Are you sure you want to delete this failed request?')) {
          return;
        }
        action = 'delete';
      } else {
        // User chose force delete, show confirmation
        if (!window.confirm('Are you sure you want to force delete this failed request? This will clean up any remaining resources.')) {
          return;
        }
        action = 'force-delete';
      }
    } else {
      // For other statuses, regular delete
      if (!window.confirm('Are you sure you want to delete this request?')) {
        return;
      }
      action = 'delete';
    }
    
    // If we haven't shown a confirmation yet (for processing requests), show it now
    if (action === 'cancel' && !window.confirm(confirmMessage)) {
      return;
    }

    try {
      if (action === 'cancel') {
        await vllmManagementApi_functions.cancelQueueRequest(requestId);
      } else if (action === 'force-delete') {
        await vllmManagementApi_functions.forceDeleteQueueRequest(requestId);
      } else {
        await vllmManagementApi_functions.deleteQueueRequest(requestId);
      }
      
      await loadQueueData();
      setError(null);
      
      // Show success message based on action
      const successMessage = action === 'cancel' 
        ? 'Request cancelled successfully!'
        : action === 'force-delete'
        ? 'Request force deleted successfully! All resources have been cleaned up.'
        : 'Request deleted successfully!';
      
      // You could add a success message state here if needed
      console.log(successMessage);
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
            await vllmManagementApi_functions.forceDeleteQueueRequest(requestId);
            await loadQueueData();
            setError(null);
            console.log('Request force deleted successfully! All resources have been cleaned up.');
          } catch (forceErr) {
            console.error('Error force deleting request:', forceErr);
            setError(`Failed to force delete request: ${forceErr.message}`);
          }
        }
      } else {
        setError(`Failed to ${action} request: ${err.message}`);
      }
    }
  };

  const handleChangePriority = async (requestId, newPriority) => {
    try {
      await vllmManagementApi_functions.changeQueuePriority(requestId, newPriority);
      await loadQueueData();
    } catch (err) {
      setError('Failed to change priority: ' + err.message);
    }
  };

  const resetForm = () => {
    setConfigText(JSON.stringify(defaultVllmConfig, null, 2));
    setCreateBenchmarkJobs(false);
    setBenchmarkJobs([{
      id: 1,
      name: 'benchmark-job-1',
      namespace: 'default',
      yaml_content: JSON.stringify(defaultBenchmarkConfig, null, 2),
      selectedProject: '',
      jobFiles: [],
      selectedJobFile: '',
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      loadingFiles: false
    }]);
    setPriority('medium');
    setImmediate(true);
    setScheduledTime('');
    setProjects([]);
  };

  // Log viewing functions
  const handleViewLogs = async (request) => {
    setSelectedRequestLogs(request);
    setLogDialogOpen(true);
    setLoadingLogs(true);
    setLogs('');

    try {
      // Try to get logs from deployer API if deployment_id exists
      if (request.deployment_id) {
                 try {
           const response = await deployerApi_functions.getJobLogs(
             request.deployment_id, 
             request.vllm_config?.namespace || 'default',
             1000
           );
           // 로그 데이터가 문자열이면 그대로, 객체면 적절히 처리
           const logData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
           setLogs(logData || 'No logs available');
         } catch (err) {
           setLogs('Failed to fetch deployment logs');
         }
      } else {
        setLogs('Deployment not started yet - no logs available');
      }
    } catch (error) {
      setLogs(`Error fetching logs: ${error.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRefreshLogs = async () => {
    if (!selectedRequestLogs) return;
    
    setLoadingLogs(true);
    try {
      if (selectedRequestLogs.deployment_id) {
                 try {
           const response = await deployerApi_functions.getJobLogs(
             selectedRequestLogs.deployment_id, 
             selectedRequestLogs.vllm_config?.namespace || 'default',
             1000
           );
           // 로그 데이터가 문자열이면 그대로, 객체면 적절히 처리
           const logData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
           setLogs(logData || 'No logs available');
         } catch (err) {
           setLogs('Failed to fetch deployment logs');
         }
      }
    } catch (error) {
      setLogs(`Error refreshing logs: ${error.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Project management functions
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      console.log('Fetching projects...');
      const response = await projectsApi.list();
      console.log('Projects response:', response.data);
      setProjects(response.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Benchmark Jobs management functions
  const addBenchmarkJob = () => {
    const newId = Math.max(...benchmarkJobs.map(job => job.id)) + 1;
    setBenchmarkJobs([...benchmarkJobs, {
      id: newId,
      name: `benchmark-job-${newId}`,
      namespace: 'default',
      yaml_content: JSON.stringify(defaultBenchmarkConfig, null, 2),
      selectedProject: '',
      jobFiles: [],
      selectedJobFile: '',
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      loadingFiles: false
    }]);
  };

  const removeBenchmarkJob = (jobId) => {
    if (benchmarkJobs.length > 1) {
      setBenchmarkJobs(benchmarkJobs.filter(job => job.id !== jobId));
    }
  };

  const updateBenchmarkJob = (jobId, updates) => {
    console.log('updateBenchmarkJob called:', jobId, updates);
    setBenchmarkJobs(prevJobs => {
      const updatedJobs = prevJobs.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
      );
      console.log('Updated benchmark jobs:', updatedJobs);
      return updatedJobs;
    });
  };

  // File management functions for benchmark jobs
  const fetchJobFiles = async (jobId, projectId) => {
    if (!projectId) return;
    
    try {
      updateBenchmarkJob(jobId, { loadingFiles: true });
      console.log('Fetching job files for project:', projectId);
      const response = await filesApi.list(projectId, 'job');
      console.log('Job files response:', response.data);
      updateBenchmarkJob(jobId, { 
        jobFiles: response.data || [],
        loadingFiles: false
      });
    } catch (err) {
      console.error('Error fetching job files:', err);
      updateBenchmarkJob(jobId, { 
        jobFiles: [],
        loadingFiles: false
      });
    }
  };

  const fetchConfigFiles = async (jobId, projectId) => {
    if (!projectId) return;
    
    try {
      const response = await filesApi.list(projectId, 'config');
      updateBenchmarkJob(jobId, { configFiles: response.data || [] });
    } catch (err) {
      updateBenchmarkJob(jobId, { configFiles: [] });
    }
  };

  const loadJobFileContent = async (jobId, projectId, fileId) => {
    try {
      const response = await filesApi.get(projectId, fileId);
      const fileData = response.data;

      let jobYaml = '';
      if (fileData.file_type === 'original') {
        jobYaml = fileData.file.content || '';
      } else if (fileData.file_type === 'modified') {
        jobYaml = fileData.file.content || '';
      }
      
      updateBenchmarkJob(jobId, { 
        originalJobYaml: jobYaml,
        yaml_content: jobYaml
      });
    } catch (err) {
      setError('Failed to load job file: ' + err.message);
    }
  };

  const loadConfigFileContent = async (projectId, fileId) => {
    if (!fileId) return null;
    
    try {
      const response = await filesApi.get(projectId, fileId);
      const fileData = response.data;

      if (fileData.file_type === 'original') {
        return fileData.file.content || '';
      } else if (fileData.file_type === 'modified') {
        return fileData.file.content || '';
      }
      return '';
    } catch (err) {
      return null;
    }
  };

  const generateYamlWithConfigMap = async (jobYaml, projectId, configFileId) => {
    if (!configFileId || !jobYaml) {
      return jobYaml;
    }

    try {
      const configContent = await loadConfigFileContent(projectId, configFileId);
      if (!configContent) {
        return jobYaml;
      }

      const configMapName = `eval-config-${Date.now()}`;
      const configMap = `---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configMapName}
  labels:
    app: benchmark
data:
  eval_config.json: |
${configContent.split('\n').map(line => `    ${line}`).join('\n')}`;

      // Add volume mount to job YAML
      const lines = jobYaml.split('\n');
      const modifiedLines = [];
      let volumeMountAdded = false;
      let volumeAdded = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        modifiedLines.push(line);

        if (line.includes('image:') && !volumeMountAdded) {
          const currentIndent = line.match(/^(\s*)/)[1];
          modifiedLines.push(`${currentIndent}volumeMounts:`);
          modifiedLines.push(`${currentIndent}- name: config-volume`);
          modifiedLines.push(`${currentIndent}  mountPath: /app/configs`);
          modifiedLines.push(`${currentIndent}  readOnly: true`);
          volumeMountAdded = true;
        }

        if (line.trim().startsWith('restartPolicy:') && !volumeAdded) {
          const currentIndent = line.match(/^(\s*)/)[1];
          modifiedLines.push(`${currentIndent}volumes:`);
          modifiedLines.push(`${currentIndent}- name: config-volume`);
          modifiedLines.push(`${currentIndent}  configMap:`);
          modifiedLines.push(`${currentIndent}    name: ${configMapName}`);
          volumeAdded = true;
        }
      }

      return `${modifiedLines.join('\n')}\n${configMap}`;
    } catch (err) {
      return jobYaml;
    }
  };

  // Handlers for benchmark job file selection
  const handleProjectSelect = async (jobId, projectId) => {
    console.log('handleProjectSelect called:', jobId, projectId);
    updateBenchmarkJob(jobId, {
      selectedProject: projectId,
      selectedJobFile: '',
      jobFiles: [],
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      yaml_content: JSON.stringify(defaultBenchmarkConfig, null, 2)
    });
    
    if (projectId) {
      console.log('Fetching job files for project:', projectId);
      await fetchJobFiles(jobId, projectId);
    }
  };

  const handleJobFileSelect = async (jobId, fileId) => {
    const job = benchmarkJobs.find(j => j.id === jobId);
    if (!job) return;
    
    updateBenchmarkJob(jobId, {
      selectedJobFile: fileId,
      selectedConfigFile: ''
    });
    
    if (fileId) {
      await loadJobFileContent(jobId, job.selectedProject, fileId);
      await fetchConfigFiles(jobId, job.selectedProject);
    } else {
      updateBenchmarkJob(jobId, {
        yaml_content: JSON.stringify(defaultBenchmarkConfig, null, 2),
        originalJobYaml: '',
        configFiles: []
      });
    }
  };

  const handleConfigFileSelect = async (jobId, fileId) => {
    const job = benchmarkJobs.find(j => j.id === jobId);
    if (!job) return;
    
    updateBenchmarkJob(jobId, { selectedConfigFile: fileId });
    
    // Use originalJobYaml if available, otherwise use current yaml_content
    const baseYaml = job.originalJobYaml || job.yaml_content;
    
    if (baseYaml) {
      if (fileId) {
        const updatedYaml = await generateYamlWithConfigMap(
          baseYaml, 
          job.selectedProject, 
          fileId
        );
        updateBenchmarkJob(jobId, { yaml_content: updatedYaml });
      } else {
        updateBenchmarkJob(jobId, { yaml_content: baseYaml });
      }
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

  const getStatusText = (request) => {
    const status = request.status;
    const currentStep = request.current_step;
    
    // Handle special VLLM failure case
    if (status === 'failed' && currentStep === 'vllm_deployment_failed') {
      return 'VLLM Failed';
    }
    
    switch (status) {
      case 'completed': return 'Completed';
      case 'processing': 
        if (currentStep === 'vllm_deployment') return 'Deploying VLLM';
        if (currentStep === 'benchmark_jobs') return 'Running Jobs';
        return 'Processing';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
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
      return `${modelFromEndpoint} (Using Existing)`;
    }
    
    // Job에서 엔드포인트를 찾을 수 없는 경우, 현재 배포된 모델 중 첫 번째 사용
    if (currentDeployments.length > 0) {
      const firstRunningModel = currentDeployments[0];
      return `${firstRunningModel.config?.model_name || 'Unknown Model'} (Using Existing)`;
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Deployment Queue
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadQueueData}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Add to Queue
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Queue Status Overview */}
      {queueStatus && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Queue Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Typography variant="body2">
                <strong>Total Requests:</strong> {queueStatus.total_requests || 0}
              </Typography>
              <Typography variant="body2">
                <strong>Pending:</strong> {queueStatus.pending_requests || 0}
              </Typography>
              <Typography variant="body2">
                <strong>Processing:</strong> {queueStatus.processing_requests || 0}
              </Typography>
              <Typography variant="body2">
                <strong>Completed:</strong> {queueStatus.completed_requests || 0}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Queue List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
                              <TableRow>
                <TableCell>Request ID</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Model</TableCell>
                <TableCell>GPU Config</TableCell>
                <TableCell>Benchmark Jobs</TableCell>
                <TableCell>VLLM Config</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queueList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No requests in queue
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                queueList.map((request) => (
                  <TableRow key={request.queue_request_id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {request.queue_request_id?.slice(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.priority}
                        color={getPriorityColor(request.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(request)}
                        color={getStatusColor(request.status)}
                        size="small"
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
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {getDisplayModelName(request)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        <strong>Type:</strong> {request.vllm_config?.gpu_resource_type}<br/>
                        <strong>Count:</strong> {request.vllm_config?.gpu_resource_count}<br/>
                        <strong>Memory:</strong> {request.vllm_config?.gpu_memory_utilization || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {request.benchmark_configs && request.benchmark_configs.length > 0 ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {request.benchmark_configs.length} Job(s)
                          </Typography>
                          {request.benchmark_configs.map((config, idx) => (
                            <Typography key={idx} variant="caption" sx={{ display: 'block' }}>
                              {config.name || `Job ${idx + 1}`} ({config.namespace})
                            </Typography>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No benchmark jobs
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        <strong>Seqs:</strong> {request.vllm_config?.max_num_seqs}<br/>
                        <strong>TP:</strong> {request.vllm_config?.tensor_parallel_size}<br/>
                        <strong>Port:</strong> {request.vllm_config?.port}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(request.created_at).toLocaleString()}
                      </Typography>
                      {request.started_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Started: {new Date(request.started_at).toLocaleString()}
                        </Typography>
                      )}
                      {request.completed_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Completed: {new Date(request.completed_at).toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                        {/* View Logs Button */}
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleViewLogs(request)}
                          title="View Logs"
                        >
                          <LogIcon />
                        </IconButton>
                        
                        {request.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleChangePriority(request.queue_request_id, 'high')}
                              title="Increase Priority"
                            >
                              <ArrowUpIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleChangePriority(request.queue_request_id, 'low')}
                              title="Decrease Priority"
                            >
                              <ArrowDownIcon />
                            </IconButton>
                          </Box>
                        )}
                        {['pending', 'processing'].includes(request.status) && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelRequest(request.queue_request_id, request.status)}
                            title="Cancel Request"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                        {request.deployment_id && (
                          <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                            Deploy: {request.deployment_id.slice(0, 8)}...
                          </Typography>
                        )}
                        {request.error_message && (
                          <Typography variant="caption" color="error" title={request.error_message}>
                            Error: {request.error_message.slice(0, 20)}...
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add to Queue Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Add Deployment to Queue</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={
                <Switch
                  checked={immediate}
                  onChange={(e) => setImmediate(e.target.checked)}
                />
              }
              label="Deploy Immediately"
            />
          </Box>

          {!immediate && (
            <TextField
              fullWidth
              type="datetime-local"
              label="Scheduled Time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              sx={{ mb: 2 }}
              InputLabelProps={{ shrink: true }}
            />
          )}
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            VLLM Configuration
          </Typography>
          <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1, mb: 2 }}>
            <MonacoEditor
              height="300px"
              language="json"
              theme="vs-light"
              value={configText}
              onChange={(value) => setConfigText(value || '')}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14
              }}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={createBenchmarkJobs}
                onChange={(e) => setCreateBenchmarkJobs(e.target.checked)}
              />
            }
            label="Create Benchmark Jobs"
            sx={{ mt: 2, mb: 1 }}
          />
          
          {createBenchmarkJobs && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  Benchmark Jobs ({benchmarkJobs.length})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addBenchmarkJob}
                >
                  Add Job
                </Button>
              </Box>

              {benchmarkJobs.map((job, index) => (
                <Card key={job.id} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        Job #{index + 1}
                      </Typography>
                      {benchmarkJobs.length > 1 && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeBenchmarkJob(job.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Box>

                                         <Grid container spacing={1}>
                       <Grid item xs={6}>
                         <TextField
                           fullWidth
                           label="Job Name"
                           value={job.name}
                           onChange={(e) => updateBenchmarkJob(job.id, { name: e.target.value })}
                           size="small"
                         />
                       </Grid>
                       <Grid item xs={6}>
                         <TextField
                           fullWidth
                           label="Namespace"
                           value={job.namespace}
                           onChange={(e) => updateBenchmarkJob(job.id, { namespace: e.target.value })}
                           size="small"
                         />
                       </Grid>
                     </Grid>

                     <Grid container spacing={1} sx={{ mt: 1 }}>
                       <Grid item xs={12} sm={4}>
                         <FormControl fullWidth size="small">
                           <InputLabel>Project</InputLabel>
                           <Select
                             value={job.selectedProject}
                             onChange={(e) => handleProjectSelect(job.id, e.target.value)}
                             label="Project"
                             disabled={loadingProjects}
                           >
                             <MenuItem value="">
                               <em>None</em>
                             </MenuItem>
                             {projects.map((project) => (
                               <MenuItem key={project.project_id} value={project.project_id}>
                                 {project.name}
                               </MenuItem>
                             ))}
                           </Select>
                         </FormControl>
                       </Grid>

                       {job.selectedProject && (
                         <Grid item xs={12} sm={4}>
                           <FormControl fullWidth size="small">
                             <InputLabel>Job File</InputLabel>
                             <Select
                               value={job.selectedJobFile}
                               onChange={(e) => handleJobFileSelect(job.id, e.target.value)}
                               label="Job File"
                               disabled={job.loadingFiles}
                             >
                               <MenuItem value="">
                                 <em>Use default template</em>
                               </MenuItem>
                               {job.jobFiles.map((file) => (
                                 <MenuItem key={file.file_id} value={file.file_id}>
                                   {file.file_path} ({file.source})
                                 </MenuItem>
                               ))}
                             </Select>
                           </FormControl>
                         </Grid>
                       )}

                       {job.selectedProject && job.selectedJobFile && (
                         <Grid item xs={12} sm={4}>
                           <FormControl fullWidth size="small">
                             <InputLabel>Config File (Optional)</InputLabel>
                             <Select
                               value={job.selectedConfigFile}
                               onChange={(e) => handleConfigFileSelect(job.id, e.target.value)}
                               label="Config File (Optional)"
                             >
                               <MenuItem value="">
                                 <em>No config file</em>
                               </MenuItem>
                               {job.configFiles.map((file) => (
                                 <MenuItem key={file.file_id} value={file.file_id}>
                                   {file.file_path} ({file.source})
                                 </MenuItem>
                               ))}
                             </Select>
                           </FormControl>
                         </Grid>
                       )}
                     </Grid>

                     <Typography variant="caption" sx={{ mt: 2, mb: 1, display: 'block' }}>
                       YAML Configuration
                     </Typography>
                    <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
                      <MonacoEditor
                        height="150px"
                        language="yaml"
                        theme="vs-light"
                        value={job.yaml_content}
                        onChange={(value) => updateBenchmarkJob(job.id, { yaml_content: value || '' })}
                        options={{
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 11
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddToQueue}
            disabled={creating}
          >
            {creating ? <CircularProgress size={20} /> : 'Add to Queue'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog
        open={logDialogOpen}
        onClose={() => setLogDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Deployment Logs - {selectedRequestLogs?.queue_request_id?.slice(0, 8)}...
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={handleRefreshLogs}
              disabled={loadingLogs}
              size="small"
            >
              Refresh
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRequestLogs && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Model:</strong> {selectedRequestLogs.vllm_config?.model_name} | 
                <strong> Status:</strong> {selectedRequestLogs.status} | 
                <strong> Deployment ID:</strong> {selectedRequestLogs.deployment_id || 'Not started'}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1, height: '400px' }}>
            {loadingLogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : (
              <MonacoEditor
                height="400px"
                language="text"
                theme="vs-light"
                value={logs}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: 'on',
                  automaticLayout: true
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default VllmQueuePage;