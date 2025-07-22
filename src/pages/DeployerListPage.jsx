import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as DeployIcon,
  PlayArrow,
  Terminal as TerminalIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Description as FileIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Settings as SettingsIcon,
  Work as BenchmarkIcon,
} from '@mui/icons-material';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { vllmManagementApi_functions, projectsApi, filesApi, deployerApi_functions } from '../utils/api';

const DeployerListPage = () => {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 새 배포 다이얼로그 상태
  const [openDialog, setOpenDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  
  // 파일 업로드 다이얼로그 상태
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // VLLM 설정 관련 상태
  const [vllmConfig, setVllmConfig] = useState({
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
  });
  
  // 기본 벤치마크 설정
  const defaultBenchmarkConfig = {
    auto_trigger: true,
    dataset: "alpaca_eval",
    metrics: ["throughput", "latency"],
    test_cases: []
  };
  
  const defaultBenchmarkJob = `apiVersion: batch/v1
kind: Job
metadata:
  name: vllm-evaluation-job
  labels:
    app: benchmark
    vllm-deployment: "VLLM_DEPLOYMENT_NAME"
spec:
  template:
    spec:
      containers:
      - name: evaluation-container
        image: your-eval-image:latest
        env:
        - name: VLLM_ENDPOINT
          # 기존 VLLM 사용 시: VLLM_SERVICE_NAME을 실제 서비스 이름으로 교체하세요
          # 예: "http://vllm-qwen-qwen2-1-5b-instruct:8000"
          value: "http://VLLM_SERVICE_NAME:8000"
        - name: MODEL_NAME
          value: "MODEL_NAME_PLACEHOLDER"
        command: ['sh', '-c']
        args: ['echo "Starting VLLM evaluation..."; sleep 300']
      restartPolicy: Never
  backoffLimit: 3`;
  
  // 벤치마크 Job 관련 상태
  const [benchmarkJobs, setBenchmarkJobs] = useState([{
    id: 1,
    name: 'benchmark-job-1',
    namespace: 'default',
    yaml_content: defaultBenchmarkJob,
    selectedProject: '',
    jobFiles: [],
    selectedJobFile: '',
    configFiles: [],
    selectedConfigFile: '',
    originalJobYaml: '',
    loadingFiles: false
  }]);
  const [tabValue, setTabValue] = useState(0);
  
  // 스케줄링 설정
  const [priority, setPriority] = useState('medium');
  const [immediate, setImmediate] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  
  // 더 이상 사용하지 않는 VLLM 설정 모드 관련 상태들 (Helm custom values로 대체됨)
  
  // 삭제 관련 상태는 더 이상 사용하지 않음 (큐 취소로 대체)
  
  // 프로젝트 및 파일 관련 상태
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [currentDeployments, setCurrentDeployments] = useState([]);

  // VLLM 배포 관련 상태
  const [vllmDeployment, setVllmDeployment] = useState({
    selectedProject: '',
    selectedValuesFile: '',
    selectedValuesContent: '',
    valuesFiles: [],
    loadingFiles: false,
    helmConfig: {
      releaseName: 'vllm-deployment',
      namespace: 'vllm',
      chartPath: './charts/vllm',
      additionalArgs: ''
    }
  });

  // VLLM 생성 비활성화 옵션
  const [skipVllmCreation, setSkipVllmCreation] = useState(false);

  const steps = ['VLLM Configuration', 'Benchmark Jobs', 'Review & Deploy'];

  // VLLM 설정을 YAML로 변환하는 함수
  const convertVllmConfigToYaml = (config) => {
    const yamlConfig = {
      apiVersion: 'v1',
      kind: 'Deployment',
      metadata: {
        name: 'vllm-server',
        labels: {
          app: 'vllm-server'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'vllm-server'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'vllm-server'
            }
          },
          spec: {
            containers: [{
              name: 'vllm-server',
              image: 'vllm/vllm-openai:latest',
              args: [
                '--model', config.model_name,
                '--gpu-memory-utilization', config.gpu_memory_utilization.toString(),
                '--max-num-seqs', config.max_num_seqs.toString(),
                '--block-size', config.block_size.toString(),
                '--tensor-parallel-size', config.tensor_parallel_size.toString(),
                '--pipeline-parallel-size', config.pipeline_parallel_size.toString(),
                '--dtype', config.dtype,
                '--port', config.port.toString(),
                '--host', config.host
              ],
              ports: [{
                containerPort: config.port,
                name: 'http'
              }],
                    resources: config.gpu_resource_type === "cpu" || config.gpu_resource_count === 0 ? {
        limits: {
          cpu: "2",
          memory: "4Gi"
        },
        requests: {
          cpu: "1", 
          memory: "2Gi"
        }
      } : {
        limits: {
          cpu: "2",
          memory: "4Gi", 
          [config.gpu_resource_type]: config.gpu_resource_count
        },
        requests: {
          cpu: "1",
          memory: "2Gi",
          [config.gpu_resource_type]: config.gpu_resource_count
        }
      },
              env: []
            }]
          }
        }
      }
    };

    // 선택적 매개변수 추가
    if (config.max_model_len) {
      yamlConfig.spec.template.spec.containers[0].args.push('--max-model-len', config.max_model_len.toString());
    }
    if (config.quantization) {
      yamlConfig.spec.template.spec.containers[0].args.push('--quantization', config.quantization);
    }
    if (config.served_model_name) {
      yamlConfig.spec.template.spec.containers[0].args.push('--served-model-name', config.served_model_name);
    }
    if (config.trust_remote_code) {
      yamlConfig.spec.template.spec.containers[0].args.push('--trust-remote-code');
    }

    // 추가 인수들
    Object.entries(config.additional_args || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        yamlConfig.spec.template.spec.containers[0].args.push(`--${key}`, value.toString());
      }
    });

    // YAML 형식으로 변환
    const yamlString = `# VLLM Kubernetes Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-server
  namespace: ${config.namespace}
  labels:
    app: vllm-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vllm-server
  template:
    metadata:
      labels:
        app: vllm-server
    spec:
      containers:
      - name: vllm-server
        image: vllm/vllm-openai:latest
        args:
        - "--model"
        - "${config.model_name}"
        - "--gpu-memory-utilization"
        - "${config.gpu_memory_utilization}"
        - "--max-num-seqs"
        - "${config.max_num_seqs}"
        - "--block-size"
        - "${config.block_size}"
        - "--tensor-parallel-size"
        - "${config.tensor_parallel_size}"
        - "--pipeline-parallel-size"
        - "${config.pipeline_parallel_size}"
        - "--dtype"
        - "${config.dtype}"
        - "--port"
        - "${config.port}"
        - "--host"
        - "${config.host}"${config.max_model_len ? `
        - "--max-model-len"
        - "${config.max_model_len}"` : ''}${config.quantization ? `
        - "--quantization"  
        - "${config.quantization}"` : ''}${config.served_model_name ? `
        - "--served-model-name"
        - "${config.served_model_name}"` : ''}${config.trust_remote_code ? `
        - "--trust-remote-code"` : ''}
        ports:
        - containerPort: ${config.port}
          name: http
        resources:${config.gpu_resource_type === "cpu" || config.gpu_resource_count === 0 ? `
          limits:
            cpu: "2"
            memory: "4Gi"
          requests:
            cpu: "1"
            memory: "2Gi"` : `
          limits:
            cpu: "2"
            memory: "4Gi"
            ${config.gpu_resource_type}: ${config.gpu_resource_count}
          requests:
            cpu: "1"
            memory: "2Gi"
            ${config.gpu_resource_type}: ${config.gpu_resource_count}`}
        env: []

---
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
  namespace: ${config.namespace}
  labels:
    app: vllm-server
spec:
  selector:
    app: vllm-server
  ports:
  - port: ${config.port}
    targetPort: ${config.port}
    name: http
  type: ClusterIP`;

    return yamlString;
  };

  // YAML 형식을 간단하게 만들어주는 헬퍼 함수
  const formatAsYaml = (obj) => {
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/{\s*\n\s*}/g, '{}')
      .replace(/\[\s*\n\s*\]/g, '[]');
  };

  // YAML에서 VLLM 설정으로 변환하는 함수 (기본적인 파싱)
  const parseYamlToVllmConfig = (yamlContent) => {
    try {
      // 간단한 YAML 파싱 (실제 환경에서는 js-yaml 라이브러리 사용 권장)
      const config = { ...vllmConfig };
      
      // 기본적인 파싱 로직 (개선 필요)
      if (yamlContent.includes('--model')) {
        const modelMatch = yamlContent.match(/--model['"]\s*([^'"]+)/);
        if (modelMatch) config.model_name = modelMatch[1];
      }
      
      // 더 정교한 파싱은 추후 js-yaml 라이브러리로 구현
      return config;
    } catch (error) {
      console.error('YAML parsing error:', error);
      return vllmConfig;
    }
  };

  useEffect(() => {
    fetchDeployments();
    loadCurrentDeployments();
  }, []);

  useEffect(() => {
    if (openDialog && activeStep === 1) {
      fetchProjects();
    }
  }, [openDialog, activeStep]);

  // VLLM Config useEffect 제거됨 (Helm custom values로 대체됨)

  // 디버깅: benchmarkJobs 상태 변경 추적
  useEffect(() => {
    console.log('benchmarkJobs state changed:', benchmarkJobs);
    benchmarkJobs.forEach((job, index) => {
      console.log(`Job ${index + 1}:`, {
        id: job.id,
        selectedProject: job.selectedProject,
        jobFilesCount: job.jobFiles?.length || 0,
        configFilesCount: job.configFiles?.length || 0,
        loadingFiles: job.loadingFiles
      });
    });
  }, [benchmarkJobs]);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      // VLLM Management 큐 목록을 가져옵니다
      const response = await vllmManagementApi_functions.getQueueList();
      setDeployments(response.data || []);
      setError(null); // 성공 시 에러 클리어
    } catch (err) {
      console.warn('Failed to fetch queue deployments:', err.message);
      // Network error는 UI에 표시하지 않고 빈 배열로 설정
      setDeployments([]);
      setError(null); // 에러 메시지 표시하지 않음
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

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      console.log('Fetching projects...');
      const response = await projectsApi.list();
      console.log('Projects response:', response);
      setProjects(response.data || []);
      console.log('Projects loaded:', response.data?.length || 0, 'projects');
    } catch (err) {
      console.error('Error fetching projects:', err);
      console.error('Error details:', err.response?.data || err.message);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 프로젝트 타입별 필터링 함수
  const getBenchmarkProjects = () => {
    return projects.filter(project => 
      project.project_type === 'benchmark' || !project.project_type
    );
  };

  const getVllmProjects = () => {
    return projects.filter(project => 
      project.project_type === 'vllm'
    );
  };

  // VLLM 파일 관리 함수들
  const fetchVllmFiles = async (projectId) => {
    if (!projectId) return;
    
    try {
      setVllmDeployment(prev => ({ ...prev, loadingFiles: true }));
      console.log('Fetching VLLM files for project:', projectId);
      const response = await filesApi.list(projectId, 'vllm');
      console.log('VLLM files response:', response.data);
      setVllmDeployment(prev => ({ 
        ...prev,
        valuesFiles: response.data || [],
        loadingFiles: false
      }));
    } catch (err) {
      console.error('Error fetching VLLM files:', err);
      setVllmDeployment(prev => ({ 
        ...prev,
        valuesFiles: [],
        loadingFiles: false
      }));
    }
  };

  const handleVllmProjectSelect = async (projectId) => {
    console.log('VLLM project selected:', projectId);
    
    setVllmDeployment(prev => ({
      ...prev,
      selectedProject: projectId,
      selectedValuesFile: '',
      valuesFiles: []
    }));
    
    if (projectId) {
      await fetchVllmFiles(projectId);
    }
  };

  const handleVllmValuesFileSelect = async (fileId) => {
    console.log('VLLM values file selected:', fileId);
    setVllmDeployment(prev => ({
      ...prev,
      selectedValuesFile: fileId,
      selectedValuesContent: fileId ? '# Loading custom values...' : ''
    }));

    if (fileId && vllmDeployment.selectedProject) {
      try {
        console.log('Loading custom values file content...');
        const response = await filesApi.get(vllmDeployment.selectedProject, fileId);
        console.log('Custom values file response:', response.data);
        
        const fileData = response.data;
        let valuesContent = '';
        
        if (fileData.file_type === 'original') {
          valuesContent = fileData.file.content || '';
        } else if (fileData.file_type === 'modified') {
          valuesContent = fileData.file.content || '';
        }
        
        setVllmDeployment(prev => ({
          ...prev,
          selectedValuesContent: valuesContent || '# No content available'
        }));
        console.log('Custom values content loaded:', valuesContent.length, 'characters');
      } catch (err) {
        console.error('Error loading custom values file:', err);
        setVllmDeployment(prev => ({
          ...prev,
          selectedValuesContent: '# Error loading custom values file'
        }));
      }
    }
  };

  // 벤치마크 Job 관리 함수들
  const addBenchmarkJob = () => {
    const newId = Math.max(...benchmarkJobs.map(job => job.id)) + 1;
    setBenchmarkJobs([...benchmarkJobs, {
      id: newId,
      name: `benchmark-job-${newId}`,
      namespace: 'default',
      yaml_content: defaultBenchmarkJob,
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
    console.log('updateBenchmarkJob called:', { jobId, updates });
    setBenchmarkJobs(prev => {
      const updated = prev.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
      );
      console.log('benchmarkJobs updated:', updated);
      return updated;
    });
  };

  // 파일 로딩 함수들
  const fetchJobFiles = async (jobId, projectId) => {
    console.log('fetchJobFiles called with:', { jobId, projectId });
    try {
      updateBenchmarkJob(jobId, { loadingFiles: true });
      console.log('Calling filesApi.list for job files...');
      const response = await filesApi.list(projectId, 'job');
      console.log('Job files response:', response);
      updateBenchmarkJob(jobId, { 
        jobFiles: response.data || [],
        loadingFiles: false
      });
      console.log('Job files updated:', response.data?.length || 0, 'files');
    } catch (err) {
      console.error('Error fetching job files:', err);
      console.error('Error details:', err.response?.data || err.message);
      updateBenchmarkJob(jobId, { 
        jobFiles: [],
        loadingFiles: false 
      });
    }
  };

  const fetchConfigFiles = async (jobId, projectId) => {
    console.log('fetchConfigFiles called with:', { jobId, projectId });
    try {
      console.log('Calling filesApi.list for config files...');
      const response = await filesApi.list(projectId, 'config');
      console.log('Config files response:', response);
      updateBenchmarkJob(jobId, { configFiles: response.data || [] });
      console.log('Config files updated:', response.data?.length || 0, 'files');
    } catch (err) {
      console.error('Error fetching config files:', err);
      console.error('Error details:', err.response?.data || err.message);
      updateBenchmarkJob(jobId, { configFiles: [] });
    }
  };

  const loadJobFileContent = async (jobId, projectId, fileId) => {
    console.log('loadJobFileContent called:', { jobId, projectId, fileId });
    try {
      console.log('Calling filesApi.get for job file content...');
      const response = await filesApi.get(projectId, fileId);
      console.log('Job file content response:', response);
      
      const fileData = response.data;
      let jobYaml = '';
      
      if (fileData.file_type === 'original') {
        jobYaml = fileData.file.content || '';
      } else if (fileData.file_type === 'modified') {
        jobYaml = fileData.file.content || '';
      }
      
      console.log('Extracted job YAML length:', jobYaml.length);
      console.log('Job YAML preview:', jobYaml.substring(0, 200) + '...');
      
      // If content is empty or invalid, use default template
      const finalContent = jobYaml && jobYaml.trim() !== '' ? jobYaml : defaultBenchmarkJob;
      
      updateBenchmarkJob(jobId, { 
        yaml_content: finalContent,
        originalJobYaml: finalContent
      });
      console.log('Job content updated in state with final content length:', finalContent.length);
    } catch (err) {
      console.error('Error loading job file:', err);
      console.error('Error details:', err.response?.data || err.message);
      
      // On error, fallback to default template
      console.log('Falling back to default template due to error');
      updateBenchmarkJob(jobId, { 
        yaml_content: defaultBenchmarkJob,
        originalJobYaml: defaultBenchmarkJob
      });
    }
  };

  const generateYamlWithConfigMap = async (jobYaml, projectId, configFileId) => {
    console.log('generateYamlWithConfigMap called:', { jobYaml: jobYaml.length + ' chars', projectId, configFileId });
    try {
      console.log('Fetching config file content...');
      const configResponse = await filesApi.get(projectId, configFileId);
      console.log('Config file response:', configResponse);
      
      const configFileData = configResponse.data;
      let configContent = '';
      
      if (configFileData.file_type === 'original') {
        configContent = configFileData.file.content || '';
      } else if (configFileData.file_type === 'modified') {
        configContent = configFileData.file.content || '';
      }
      
      const configName = configFileData.name || configFileData.file_path?.split('/').pop()?.replace('.json', '') || 'config';
      
      console.log('Config content length:', configContent.length);
      console.log('Config name:', configName);
      
      // ConfigMap YAML 생성
      const configMap = `---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configName}-config
data:
  config.yaml: |
${configContent.split('\n').map(line => `    ${line}`).join('\n')}`;

      const finalYaml = `${jobYaml}\n${configMap}`;
      console.log('Generated combined YAML length:', finalYaml.length);
      return finalYaml;
    } catch (err) {
      console.error('Error generating YAML with ConfigMap:', err);
      console.error('Error details:', err.response?.data || err.message);
      return jobYaml;
    }
  };

  // 핸들러 함수들
  const handleOpenDialog = () => {
    setActiveStep(0);
    // vllmConfig는 리셋하지 않고 현재 상태 유지
    setBenchmarkJobs([{
      id: 1,
      name: 'benchmark-job-1',
      namespace: 'default',
      yaml_content: defaultBenchmarkJob,
      selectedProject: '',
      jobFiles: [],
      selectedJobFile: '',
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      loadingFiles: false
    }]);
    setTabValue(0);
    setPriority('medium');
    setImmediate(true);
    setScheduledTime('');
    setSkipVllmCreation(false); // VLLM 생성 건너뛰기 옵션 초기화
    // Helm 배포 모드로 변경됨 - YAML 설정 제거
    setOpenDialog(true);
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  // 더 이상 사용하지 않는 VLLM 설정 모드 변경 핸들러 (Helm으로 대체됨)
  /*
  const handleVllmConfigModeChange = (newMode) => {
    if (newMode === 'yaml' && vllmConfigMode === 'form') {
      // Form에서 YAML로 전환 시 현재 설정을 YAML로 변환
      setVllmYamlContent(convertVllmConfigToYaml(vllmConfig));
    } else if (newMode === 'form' && vllmConfigMode === 'yaml') {
      // YAML에서 Form으로 전환 시 YAML 내용을 설정으로 파싱 시도
      const parsedConfig = parseYamlToVllmConfig(vllmYamlContent);
      setVllmConfig(parsedConfig);
    }
    setVllmConfigMode(newMode);
  };
  */

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleProjectSelect = async (jobId, projectId) => {
    console.log('handleProjectSelect called:', { jobId, projectId });
    
    updateBenchmarkJob(jobId, {
      selectedProject: projectId,
      selectedJobFile: '',
      jobFiles: [],
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      yaml_content: defaultBenchmarkJob
    });
    
    console.log('State updated, now fetching files...');
    
    if (projectId) {
      try {
        console.log('Starting parallel fetch...');
        // Job 파일과 Config 파일을 동시에 로딩
        await Promise.all([
          fetchJobFiles(jobId, projectId),
          fetchConfigFiles(jobId, projectId)
        ]);
        console.log('Parallel fetch completed');
      } catch (error) {
        console.error('Error in parallel fetch:', error);
        alert(`File loading failed: ${error.message}`);
      }
    }
  };

  const handleJobFileSelect = async (jobId, fileId) => {
    console.log('handleJobFileSelect called:', { jobId, fileId });
    const job = benchmarkJobs.find(j => j.id === jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return;
    }
    
    console.log('Current job state:', job);
    
    updateBenchmarkJob(jobId, {
      selectedJobFile: fileId,
      selectedConfigFile: ''
    });
    
    if (fileId) {
      console.log('Loading job file content...');
      await loadJobFileContent(jobId, job.selectedProject, fileId);
    } else {
      console.log('Resetting to default job YAML');
      updateBenchmarkJob(jobId, {
        yaml_content: defaultBenchmarkJob,
        originalJobYaml: ''
      });
    }
  };

  const handleConfigFileSelect = async (jobId, fileId) => {
    console.log('handleConfigFileSelect called:', { jobId, fileId });
    const job = benchmarkJobs.find(j => j.id === jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return;
    }
    
    console.log('Current job state before config select:', {
      selectedProject: job.selectedProject,
      selectedJobFile: job.selectedJobFile,
      originalJobYaml: job.originalJobYaml?.length + ' chars',
      yaml_content: job.yaml_content?.length + ' chars'
    });
    
    updateBenchmarkJob(jobId, { selectedConfigFile: fileId });
    
    // Use originalJobYaml if available, otherwise use current yaml_content
    let baseYaml = job.originalJobYaml || job.yaml_content;
    
    // If still no content, use default template
    if (!baseYaml || baseYaml.trim() === '') {
      console.log('No YAML content found, using default template');
      baseYaml = defaultBenchmarkJob;
      // Update the job with default content
      updateBenchmarkJob(jobId, { 
        yaml_content: baseYaml,
        originalJobYaml: baseYaml 
      });
    }
    
    if (fileId) {
      console.log('Generating YAML with ConfigMap...');
      try {
        const updatedYaml = await generateYamlWithConfigMap(
          baseYaml, 
          job.selectedProject, 
          fileId
        );
        console.log('Updating YAML content with ConfigMap');
        updateBenchmarkJob(jobId, { yaml_content: updatedYaml });
      } catch (error) {
        console.error('Error generating ConfigMap:', error);
        // Fallback to base YAML if ConfigMap generation fails
        updateBenchmarkJob(jobId, { yaml_content: baseYaml });
      }
    } else {
      console.log('Reverting to base job YAML without ConfigMap');
      updateBenchmarkJob(jobId, { yaml_content: baseYaml });
    }
  };

  // 파일 업로드 핸들러 (현재는 사용하지 않지만 UI 에러 방지용)
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        // 현재는 Helm 배포로 대체되어 실제 처리하지 않음
        console.log('File uploaded:', file.name, 'Content length:', content.length);
        setUploadedFile(file);
        setFileUploadDialogOpen(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDeploy = async () => {
    try {
      setDeploying(true);
      
      // 배포 시작과 동시에 대화상자 닫기
      setOpenDialog(false);
      
      // Helm 배포를 위한 기본 VLLM 설정 (custom values로 오버라이드됨)
      let finalVllmConfig = vllmConfig;
      
      // Prepare benchmark configs
      const benchmarkConfigs = benchmarkJobs.map(job => ({
        yaml_content: job.yaml_content,
        namespace: job.namespace,
        project_id: job.selectedProject || null,
        job_file_id: job.selectedJobFile || null,
        config_file_id: job.selectedConfigFile || null,
        name: job.name
      }));
      
      const schedulingConfig = {
        immediate,
        scheduled_time: immediate ? null : scheduledTime,
        max_wait_time: 3600 // 1 hour default
      };

      // VLLM Helm 배포 설정 준비 (VLLM 생성을 건너뛰는 경우 기본값 사용)
      const vllmHelmConfig = {
        project_id: skipVllmCreation ? null : (vllmDeployment.selectedProject || null),
        values_file_id: skipVllmCreation ? null : (vllmDeployment.selectedValuesFile || null),
        release_name: vllmDeployment.helmConfig.releaseName,
        namespace: vllmDeployment.helmConfig.namespace || vllmConfig.namespace,
        chart_path: vllmDeployment.helmConfig.chartPath,
        additional_args: vllmDeployment.helmConfig.additionalArgs
      };

      // 요청 데이터 준비
      const requestData = {
        vllm_config: skipVllmCreation ? null : finalVllmConfig, // VLLM 생성을 건너뛰는 경우 null 전송
        vllm_helm_config: vllmHelmConfig,
        benchmark_configs: benchmarkConfigs,
        scheduling_config: schedulingConfig,
        priority: priority,
        vllm_yaml_content: null, // Helm 배포에서는 custom values 파일 사용
        skip_vllm_creation: skipVllmCreation // 백엔드에서 이 플래그를 확인하여 VLLM 생성 여부 결정
      };
      
      console.log('Sending deployment request:', requestData);
      console.log('Final VLLM Config:', finalVllmConfig);
      console.log('Benchmark Configs:', benchmarkConfigs);
      console.log('Scheduling Config:', schedulingConfig);
      console.log('VLLM Helm Config:', vllmHelmConfig);

      // API 호출 - VLLM 생성을 건너뛰는 경우 무조건 큐 배포 사용, 아니면 VLLM 프로젝트 선택 여부에 따라 결정
      let response;
      if (skipVllmCreation || !vllmDeployment.selectedProject) {
        // 큐 배포 사용 (VLLM 생성 건너뛰기 또는 프로젝트 선택 안됨)
        console.log('Using queue deployment API');
        response = await vllmManagementApi_functions.addToQueue(
          requestData.vllm_config,
          requestData.benchmark_configs,
          requestData.scheduling_config,
          requestData.priority,
          requestData.skip_vllm_creation
        );
      } else {
        // Helm 배포 사용 (프로젝트 선택됨)
        console.log('Using Helm deployment API');
        response = await fetch('/deploy/vllm/helm/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        response = { data: await response.json() };
      }

      console.log('Deployment success response:', response.data);
      
      // 대화상자는 이미 닫혔으므로 성공 메시지만 표시
      const successMessage = skipVllmCreation 
        ? 'Benchmark jobs added to queue successfully! (기존 VLLM 사용)'
        : (vllmDeployment.selectedProject && !skipVllmCreation)
          ? `VLLM Helm deployment successful! Release: ${vllmDeployment.helmConfig.releaseName}`
          : 'VLLM deployment with benchmark jobs added to queue successfully!';
      alert(successMessage);
      await fetchDeployments();
    } catch (err) {
      console.error('Deployment error:', err);
      alert(`배포 실패: ${err.message}`);
      // 에러 발생 시에는 대화상자를 다시 열어서 사용자가 수정할 수 있도록 함
      setOpenDialog(true);
    } finally {
      setDeploying(false);
    }
  };

  // ... existing code for delete handlers and other functions ...

  const handleCancelRequest = async (queueRequestId) => {
    if (!confirm('이 큐 요청을 취소하시겠습니까? 실행 중인 작업들이 중지되고 관련 리소스가 정리됩니다.')) {
      return;
    }

    try {
      await vllmManagementApi_functions.cancelQueueRequest(queueRequestId);
      alert('큐 요청이 성공적으로 취소되었습니다. 관련된 모든 작업이 정리되었습니다.');
      await fetchDeployments(); // 목록 새로고침
    } catch (err) {
      console.error('Error cancelling queue request:', err);
      alert(`큐 요청 취소 실패: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleCheckSchedulerStatus = async () => {
    try {
      const response = await deployerApi_functions.getStatus();
      const data = response.data;
      alert(`큐 스케줄러 상태:\n처리 중: ${data.processing_queue ? 'Yes' : 'No'}\n실행 중: ${data.scheduler_running ? 'Yes' : 'No'}\n${data.message}`);
    } catch (err) {
      alert(`큐 스케줄러 상태 확인 실패: ${err.message}`);
    }
  };

  const handleTriggerQueue = async () => {
    try {
      // deployerApi에 trigger endpoint가 없으므로 직접 fetch 사용하되 프록시 경로 사용
      const response = await fetch('/deploy/vllm/queue/scheduler/trigger', {
        method: 'POST'
      });
      const data = await response.json();
      alert(`큐 처리 트리거 성공: ${data.message}`);
      await fetchDeployments(); // 상태 새로고침
    } catch (err) {
      alert(`큐 처리 트리거 실패: ${err.message}`);
    }
  };

  const handleDeleteRequest = async (queueRequestId) => {
    if (!confirm('이 큐 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`http://benchmark-vllm.benchmark-web.svc.cluster.local:8005/queue/${queueRequestId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete queue request');
      }

      alert('큐 요청이 성공적으로 삭제되었습니다.');
      await fetchDeployments(); // 목록 새로고침
    } catch (err) {
      alert(`큐 요청 삭제 실패: ${err.message}`);
    }
  };

  // 더 이상 사용하지 않는 함수들 (큐 관리로 변경됨)
  /*
  const handleDeleteClick = (deployment) => {
    setDeploymentToDelete(deployment);
    setDeleteYamlContent(deployment.yaml_content || '');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteYamlContent.trim() || !deploymentToDelete) {
      alert('삭제할 YAML 내용이 없습니다.');
      return;
    }

    try {
      setDeleting(true);
      await deployerApi_functions.deleteDeployment(
        deleteYamlContent, 
        deploymentToDelete.namespace || 'default'
      );
      
      setDeleteDialogOpen(false);
      setDeploymentToDelete(null);
      setDeleteYamlContent('');
      await fetchDeployments();
      alert('배포가 성공적으로 삭제되었습니다.');
    } catch (err) {
      alert(`삭제 실패: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeploymentToDelete(null);
    setDeleteYamlContent('');
  };

  const handleTerminalAccess = async (deployment) => {
    try {
      const response = await deployerApi_functions.createJobTerminal(
        deployment.resource_name,
        deployment.namespace || 'default'
      );
      
      if (response.data?.session_id) {
        navigate(`/deployer/${deployment.resource_name}/terminal?session_id=${response.data.session_id}`);
      } else {
        navigate(`/deployer/${deployment.resource_name}/terminal`);
      }
    } catch (err) {
      alert(`터미널 세션 생성 실패: ${err.response?.data?.detail || err.message}`);
    }
  };
  */

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'primary';
      case 'completed':
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      case 'deleted':
        return 'default';
      default:
        return 'default';
    }
  };

  const getDisplayModelName = (deployment) => {
    // VLLM 설정이 있는 경우 해당 모델명 표시
    if (deployment.vllm_config?.model_name) {
      return deployment.vllm_config.model_name;
    }
    
    // VLLM 설정이 없는 경우, Job YAML에서 VLLM_ENDPOINT를 파싱하여 해당 모델 찾기
    const modelFromEndpoint = getModelFromJobEndpoint(deployment);
    if (modelFromEndpoint) {
      return `${modelFromEndpoint} (기존 VLLM)`;
    }
    
    // Job에서 엔드포인트를 찾을 수 없는 경우, 현재 배포된 모델 중 첫 번째 사용
    if (currentDeployments.length > 0) {
      const firstRunningModel = currentDeployments[0];
      return `${firstRunningModel.config?.model_name || 'Unknown Model'} (기존 VLLM)`;
    }
    
    // 배포된 VLLM이 없는 경우
    return 'N/A';
  };

  const getModelFromJobEndpoint = (deployment) => {
    try {
      // benchmark_configs에서 VLLM_ENDPOINT를 찾아 해당 서비스의 모델 정보를 가져옴
      if (deployment.benchmark_configs && deployment.benchmark_configs.length > 0) {
        for (const config of deployment.benchmark_configs) {
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

  // Step Content 렌더링 함수들
  const renderVLLMConfigStep = () => (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          VLLM Configuration
        </Typography>
      </Box>

      {/* VLLM 생성 비활성화 옵션 */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={skipVllmCreation}
                onChange={(e) => setSkipVllmCreation(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" component="span">
                  기존 VLLM 사용 (새 VLLM 배포 건너뛰기)
                </Typography>
                <Typography variant="body2" color="textSecondary" component="div">
                  활성화하면 새로운 VLLM을 배포하지 않고 기존 VLLM을 사용합니다.
                </Typography>
                {skipVllmCreation && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>기존 VLLM 사용 모드:</strong> 새로운 VLLM을 배포하지 않고 벤치마크 Job만 실행됩니다.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      벤치마크 Job YAML에서 <code>VLLM_SERVICE_NAME</code>을 실제 VLLM 서비스 이름으로 직접 교체해주세요.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                      예: VLLM_SERVICE_NAME → vllm-qwen-qwen2-1-5b-instruct-1-cpu-0-service
                    </Typography>
                  </Alert>
                )}
              </Box>
            }
            sx={{ mb: 1 }}
          />
        </CardContent>
      </Card>
      
      {/* Helm 배포 설정 섹션 */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper', opacity: skipVllmCreation ? 0.5 : 1 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            🚀 Helm Deployment Configuration
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>VLLM Project</InputLabel>
                  <Select
                    value={vllmDeployment.selectedProject}
                    onChange={(e) => handleVllmProjectSelect(e.target.value)}
                    label="VLLM Project"
                    disabled={loadingProjects || skipVllmCreation}
                  >
                    <MenuItem value="">
                      <em>Select a VLLM project</em>
                    </MenuItem>
                    {getVllmProjects().map((project) => (
                      <MenuItem key={project.project_id} value={project.project_id}>
                        {project.name} (vllm)
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingProjects && (
                    <Typography variant="caption" color="textSecondary">
                      Loading projects...
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    VLLM projects available: {getVllmProjects().length}
                  </Typography>
                </FormControl>
                <IconButton
                  onClick={fetchProjects}
                  disabled={loadingProjects || skipVllmCreation}
                  title="Refresh projects"
                  sx={{ mb: 1 }}
                >
                  <RefreshIcon />
                </IconButton>
              </Box>

              {vllmDeployment.selectedProject && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Custom Values File</InputLabel>
                  <Select
                    value={vllmDeployment.selectedValuesFile}
                    onChange={(e) => handleVllmValuesFileSelect(e.target.value)}
                    label="Custom Values File"
                    disabled={vllmDeployment.loadingFiles || skipVllmCreation}
                  >
                    <MenuItem value="">
                      <em>Use default values</em>
                    </MenuItem>
                    {vllmDeployment.valuesFiles?.map((file) => (
                      <MenuItem key={file.file_id} value={file.file_id}>
                        {file.file_path?.split('/').pop() || 'Untitled'} ({file.source || 'unknown'})
                      </MenuItem>
                    ))}
                  </Select>
                  {vllmDeployment.loadingFiles && (
                    <Typography variant="caption" color="textSecondary">
                      Loading values files...
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    Custom values files available: {vllmDeployment.valuesFiles?.length || 0}
                  </Typography>
                </FormControl>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Helm Release Name"
                value={vllmDeployment.helmConfig.releaseName}
                onChange={(e) => setVllmDeployment(prev => ({
                  ...prev,
                  helmConfig: { ...prev.helmConfig, releaseName: e.target.value }
                }))}
                margin="normal"
                helperText="Name for the Helm release"
                disabled={skipVllmCreation}
              />
              
              <TextField
                fullWidth
                label="Chart Path"
                value={vllmDeployment.helmConfig.chartPath}
                onChange={(e) => setVllmDeployment(prev => ({
                  ...prev,
                  helmConfig: { ...prev.helmConfig, chartPath: e.target.value }
                }))}
                margin="normal"
                helperText="Path to the Helm chart (e.g., ./charts/vllm)"
                disabled={skipVllmCreation}
              />
              
              <TextField
                fullWidth
                label="Additional Helm Args"
                value={vllmDeployment.helmConfig.additionalArgs}
                onChange={(e) => setVllmDeployment(prev => ({
                  ...prev,
                  helmConfig: { ...prev.helmConfig, additionalArgs: e.target.value }
                }))}
                margin="normal"
                helperText="Additional arguments for helm install command"
                placeholder="--timeout 600s --wait"
                disabled={skipVllmCreation}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Custom Values File Preview */}
      {vllmDeployment.selectedProject && vllmDeployment.selectedValuesFile && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              📄 Selected Custom Values File
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {vllmDeployment.valuesFiles?.find(f => f.file_id === vllmDeployment.selectedValuesFile)?.file_path || 'Custom values file'}
            </Typography>
            <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
              <MonacoEditor
                height="400px"
                language="yaml"
                theme="vs-light"
                value={vllmDeployment.selectedValuesContent || '# Loading custom values...'}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: 'on'
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              This custom values file will be used for Helm deployment. The values will override the default chart values.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Default Configuration Notice */}
      {vllmDeployment.selectedProject && !vllmDeployment.selectedValuesFile && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              ⚙️ Default Configuration
            </Typography>
            <Typography variant="body2" color="textSecondary">
              No custom values file selected. The deployment will use the default Helm chart values.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* No Project Selected Notice */}
      {!vllmDeployment.selectedProject && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="warning">
              ⚠️ No VLLM Project Selected
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Please select a VLLM project above to configure Helm deployment with custom values.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const renderBenchmarkJobsStep = () => (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          <BenchmarkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Benchmark Jobs
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addBenchmarkJob}
        >
          Add Job
        </Button>
      </Box>

      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        {benchmarkJobs.map((job, index) => (
          <Tab key={job.id} label={`Job ${index + 1}`} />
        ))}
      </Tabs>

                    {benchmarkJobs.map((job, index) => (
                tabValue === index && (
                  <Card key={job.id} sx={{ mb: 2 }}>
                    <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <TextField
                  label="Job Name"
                  value={job.name}
                  onChange={(e) => updateBenchmarkJob(job.id, { name: e.target.value })}
                  size="small"
                  sx={{ width: 200 }}
                />
                <Box>
                  <TextField
                    label="Namespace"
                    value={job.namespace}
                    onChange={(e) => updateBenchmarkJob(job.id, { namespace: e.target.value })}
                    size="small"
                    sx={{ width: 120, mr: 1 }}
                  />
                  {benchmarkJobs.length > 1 && (
                    <Button
                      color="error"
                      onClick={() => removeBenchmarkJob(job.id)}
                    >
                      Remove
                    </Button>
                  )}
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Project</InputLabel>
                    <Select
                      value={job.selectedProject}
                      onChange={(e) => handleProjectSelect(job.id, e.target.value)}
                      label="Project"
                      disabled={loadingProjects}
                    >
                      <MenuItem value="">
                        <em>None (Default Template)</em>
                      </MenuItem>
                      {getBenchmarkProjects().map((project) => (
                        <MenuItem key={project.project_id} value={project.project_id}>
                          {project.name} ({project.project_type || 'benchmark'})
                        </MenuItem>
                      ))}
                    </Select>
                    {loadingProjects && (
                      <Typography variant="caption" color="textSecondary">
                        Loading projects...
                      </Typography>
                    )}
                    <Typography variant="caption" color="textSecondary">
                      Projects available: {projects.length} | Loading: {loadingProjects ? 'Yes' : 'No'}
                    </Typography>
                  </FormControl>

                                        {job.selectedProject && (
                        <>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Job File</InputLabel>
                            <Select
                              value={job.selectedJobFile}
                              onChange={(e) => handleJobFileSelect(job.id, e.target.value)}
                              label="Job File"
                            >
                              <MenuItem value="">
                                <em>None</em>
                              </MenuItem>
                              {job.jobFiles?.map((file) => (
                                <MenuItem key={file.file_id} value={file.file_id}>
                                  {file.file_path?.split('/').pop() || 'Untitled'} ({file.source || 'unknown'})
                                </MenuItem>
                              ))}
                            </Select>
                            {job.loadingFiles && (
                              <Typography variant="caption" color="textSecondary">
                                Loading files...
                              </Typography>
                            )}
                            <Typography variant="caption" color="textSecondary">
                              Job files available: {job.jobFiles?.length || 0}
                            </Typography>
                          </FormControl>

                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Config File</InputLabel>
                            <Select
                              value={job.selectedConfigFile}
                              onChange={(e) => handleConfigFileSelect(job.id, e.target.value)}
                              label="Config File"
                            >
                              <MenuItem value="">
                                <em>None</em>
                              </MenuItem>
                              {job.configFiles?.map((file) => (
                                <MenuItem key={file.file_id} value={file.file_id}>
                                  {file.file_path?.split('/').pop() || 'Untitled'} ({file.source || 'unknown'})
                                </MenuItem>
                              ))}
                            </Select>
                            <Typography variant="caption" color="textSecondary">
                              Config files available: {job.configFiles?.length || 0}
                            </Typography>
                          </FormControl>
                        </>
                      )}
                </Grid>

                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    YAML Content
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    Content length: {job.yaml_content?.length || 0} chars | 
                    Original: {job.originalJobYaml?.length || 0} chars
                  </Typography>
                  <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
                    <MonacoEditor
                      height="300px"
                      language="yaml"
                      theme="vs-light"
                      value={job.yaml_content || '# No content loaded yet'}
                      onChange={(value) => {
                        console.log('Monaco editor content changed:', value?.length + ' chars');
                        updateBenchmarkJob(job.id, { yaml_content: value || '' });
                      }}
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )
      ))}
    </Box>
  );

  const renderReviewStep = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Review Configuration
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>🚀 VLLM Helm Configuration</Typography>
              
              {/* VLLM 생성 건너뛰기 상태 표시 */}
              {skipVllmCreation ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography><strong>기존 VLLM 사용:</strong> 새로운 VLLM을 배포하지 않고 기존 VLLM을 사용합니다.</Typography>
                </Alert>
              ) : vllmDeployment.selectedProject ? (
                <>
                  <Typography><strong>Project:</strong> {getVllmProjects().find(p => p.project_id === vllmDeployment.selectedProject)?.name || 'Unknown'}</Typography>
                  <Typography><strong>Values File:</strong> {vllmDeployment.selectedValuesFile ? vllmDeployment.valuesFiles?.find(f => f.file_id === vllmDeployment.selectedValuesFile)?.file_path?.split('/').pop() || 'Selected' : 'Default'}</Typography>
                  <Typography><strong>Release Name:</strong> {vllmDeployment.helmConfig.releaseName}</Typography>
                  <Typography><strong>Chart Path:</strong> {vllmDeployment.helmConfig.chartPath}</Typography>
                  {vllmDeployment.helmConfig.additionalArgs && (
                    <Typography><strong>Additional Args:</strong> {vllmDeployment.helmConfig.additionalArgs}</Typography>
                  )}
                  <Divider sx={{ my: 2 }} />
                </>
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No VLLM project selected. Using legacy YAML deployment.
                </Alert>
              )}
              
              {/* VLLM 설정 정보는 건너뛰기가 아닌 경우에만 표시 */}
              {!skipVllmCreation && (
                <>
                  <Typography variant="h6" gutterBottom>VLLM Configuration</Typography>
                  <Typography><strong>Model:</strong> {vllmConfig.model_name}</Typography>
                  <Typography><strong>Namespace:</strong> {vllmConfig.namespace}</Typography>
                  <Typography><strong>GPU Resource:</strong> {vllmConfig.gpu_resource_type} x {vllmConfig.gpu_resource_count}</Typography>
                  <Typography><strong>GPU Memory Utilization:</strong> {vllmConfig.gpu_memory_utilization}</Typography>
                  <Typography><strong>Max Sequences:</strong> {vllmConfig.max_num_seqs}</Typography>
                  <Typography><strong>Block Size:</strong> {vllmConfig.block_size}</Typography>
                  <Typography><strong>Tensor Parallel Size:</strong> {vllmConfig.tensor_parallel_size}</Typography>
                  <Typography><strong>Pipeline Parallel Size:</strong> {vllmConfig.pipeline_parallel_size}</Typography>
                  <Typography><strong>Data Type:</strong> {vllmConfig.dtype}</Typography>
                  <Typography><strong>Port:</strong> {vllmConfig.port}</Typography>
                  <Typography><strong>Host:</strong> {vllmConfig.host}</Typography>
                  {vllmConfig.served_model_name && (
                    <Typography><strong>Served Model Name:</strong> {vllmConfig.served_model_name}</Typography>
                  )}
                  {vllmConfig.max_model_len && (
                    <Typography><strong>Max Model Length:</strong> {vllmConfig.max_model_len}</Typography>
                  )}
                  {vllmConfig.quantization && (
                    <Typography><strong>Quantization:</strong> {vllmConfig.quantization}</Typography>
                  )}
                  <Typography><strong>Trust Remote Code:</strong> {vllmConfig.trust_remote_code ? 'Yes' : 'No'}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Benchmark Jobs</Typography>
              <Typography><strong>Total Jobs:</strong> {benchmarkJobs.length}</Typography>
              {benchmarkJobs.map((job, index) => (
                <Typography key={job.id}>
                  <strong>Job {index + 1}:</strong> {job.name} (ns: {job.namespace})
                </Typography>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Scheduling Configuration</Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    label="Priority"
                    size="small"
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  if (loading) {
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
          VLLM 배포 큐 관리
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDeployments}
            sx={{ mr: 1 }}
          >
            새로고침
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleCheckSchedulerStatus}
            sx={{ mr: 1 }}
          >
            큐 상태
          </Button>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={handleTriggerQueue}
            sx={{ mr: 2 }}
          >
            큐 처리
          </Button>
          <Button
            variant="contained"
            startIcon={<DeployIcon />}
            onClick={handleOpenDialog}
          >
            새 배포
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Deployments Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            VLLM 배포 큐 목록
          </Typography>
          
          {deployments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                큐에 등록된 배포 요청이 없습니다. 새 배포를 생성해보세요.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>큐 요청 ID</TableCell>
                    <TableCell>모델명</TableCell>
                    <TableCell>우선순위</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>진행 단계</TableCell>
                    <TableCell>생성 시간</TableCell>
                    <TableCell align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deployments.map((deployment, index) => (
                    <TableRow key={deployment.queue_request_id || index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {deployment.queue_request_id?.substring(0, 8) || 'N/A'}
                          {deployment.helm_deployment && (
                            <Chip 
                              label="Helm" 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {getDisplayModelName(deployment)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={deployment.priority || 'medium'}
                          color={deployment.priority === 'urgent' ? 'error' : 
                                 deployment.priority === 'high' ? 'warning' : 
                                 deployment.priority === 'low' ? 'default' : 'primary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={deployment.status || 'Unknown'}
                          color={getStatusColor(deployment.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {deployment.current_step || 'pending'} 
                        {deployment.total_steps && ` (${deployment.completed_steps || 0}/${deployment.total_steps})`}
                      </TableCell>
                      <TableCell>
                        {deployment.created_at 
                          ? new Date(deployment.created_at).toLocaleString()
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          onClick={() => navigate(`/vllm-management`)}
                          title="VLLM Management에서 상세 보기"
                        >
                          <ViewIcon />
                        </IconButton>
                        {deployment.status === 'pending' && (
                          <IconButton
                            color="error"
                            onClick={() => handleCancelRequest(deployment.queue_request_id)}
                            title="요청 취소"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                        {(deployment.status === 'completed' || deployment.status === 'failed' || deployment.status === 'skipped') && (
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteRequest(deployment.queue_request_id)}
                            title="요청 삭제"
                          >
                            <DeleteIcon />
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

      {/* 2-Step Deploy Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">새 VLLM 배포 생성</Typography>
            <Stepper activeStep={activeStep} sx={{ width: '50%' }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {activeStep === 0 && renderVLLMConfigStep()}
          {activeStep === 1 && renderBenchmarkJobsStep()}
          {activeStep === 2 && renderReviewStep()}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            취소
          </Button>
          
          {activeStep > 0 && (
            <Button
              startIcon={<BackIcon />}
              onClick={handleBack}
            >
              이전
            </Button>
          )}
          
          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              endIcon={<NextIcon />}
              onClick={handleNext}
            >
              다음
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? <CircularProgress size={20} /> : '배포 시작'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog 제거됨 - 큐 취소로 대체 */}

      {/* File Upload Dialog */}
      <Dialog open={fileUploadDialogOpen} onClose={() => setFileUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload YAML File</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload a YAML file for VLLM deployment configuration.
          </Typography>
          <input
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileUpload}
            style={{ width: '100%', padding: '8px' }}
          />
          {uploadedFile && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Uploaded: {uploadedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileUploadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* FAB for mobile */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' }
        }}
        onClick={handleOpenDialog}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default DeployerListPage; 