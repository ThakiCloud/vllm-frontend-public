import axios from 'axios';

// GitHub URL 변환 유틸리티
export const convertGitHubUrl = (repositoryUrl) => {
  if (!repositoryUrl) return '';
  
  // 다양한 GitHub URL 형식을 처리
  let cleanUrl = repositoryUrl.trim();
  
  // @ 접두사 제거
  if (cleanUrl.startsWith('@')) {
    cleanUrl = cleanUrl.substring(1);
  }
  
  // 이미 API URL 형식인 경우 그대로 반환 (먼저 체크)
  if (cleanUrl.includes('api.github.com/repos/')) {
    return cleanUrl;
  }
  
  // .git 접미사 제거
  if (cleanUrl.endsWith('.git')) {
    cleanUrl = cleanUrl.slice(0, -4);
  }
  
  // https://github.com/owner/repo 형식에서 owner/repo 추출
  const githubMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (githubMatch) {
    const [, owner, repo] = githubMatch;
    return `https://api.github.com/repos/${owner}/${repo}`;
  }
  
  // owner/repo 형식인 경우
  const ownerRepoMatch = cleanUrl.match(/^([^\/]+)\/([^\/]+)$/);
  if (ownerRepoMatch) {
    const [, owner, repo] = ownerRepoMatch;
    return `https://api.github.com/repos/${owner}/${repo}`;
  }
  
  // 변환할 수 없는 경우 원본 반환
  return repositoryUrl;
};

// API Base URLs (하드코딩)
// 환경에 따른 API URL 설정
const isDevelopment = process.env.NODE_ENV === 'development';

const BENCHMARK_API_BASE_URL = isDevelopment 
  ? 'http://localhost:8000'   // 개발환경: 직접 접근
  : '/results';                       // 프로덕션: nginx에서 /standardized_output, /raw_input 직접 프록시

const PROJECT_API_BASE_URL = isDevelopment 
  ? 'http://localhost:8001'   // 개발환경: 직접 접근  
  : '/manage';                   // 프로덕션: nginx에서 /api/* → 8001포트 프록시

const DEPLOYER_API_BASE_URL = isDevelopment 
  ? 'http://localhost:8002'   // 개발환경: 직접 접근
  : '/deploy';                       // 프로덕션: nginx에서 /deploy/* → 8002포트 프록시

const VLLM_API_GATEWAY_BASE_URL = isDevelopment 
  ? 'http://localhost:8080'   // 개발환경: 직접 접근
  : '/vllm-api-gateway';

const VLLM_MANAGEMENT_API_BASE_URL = isDevelopment 
  ? 'http://localhost:8005'   // 개발환경: 직접 접근 (benchmark-vllm)
  : '/vllm';                  // 프로덕션: nginx에서 /vllm/* → 8005포트 프록시                       

// Benchmark Results API Client (기존)
export const benchmarkApi = axios.create({
  baseURL: BENCHMARK_API_BASE_URL,
  headers: { 
    'Content-Type': 'application/json',
  },
});

// Project Management API Client (신규)
export const projectApi = axios.create({
  baseURL: PROJECT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Benchmark Deployer API Client (신규)
export const deployerApi = axios.create({
  baseURL: DEPLOYER_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const vllmApiGateway = axios.create({
  baseURL: VLLM_API_GATEWAY_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// VLLM Management API Client (신규)
export const vllmManagementApi = axios.create({
  baseURL: VLLM_MANAGEMENT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Benchmark Results API (기존 벤치마크 결과용)
export const benchmarkResultsApi = {
  list: () => benchmarkApi.get('/standardized_output'),
  get: (pk) => benchmarkApi.get(`/standardized_output/${pk}`),
  getRawInput: (pk) => benchmarkApi.get(`/raw_input/${pk}`),  // raw_input API 추가
  listRawInput: () => benchmarkApi.get('/raw_input'),  // raw_input 목록 API 추가
};

// Projects API (신규 프로젝트 관리용)
export const projectsApi = {
  list: () => projectApi.get('/projects'),
  get: (id) => projectApi.get(`/projects/${id}`),
  create: (data) => projectApi.post('/projects', data),
  update: (id, data) => projectApi.put(`/projects/${id}`, data),
  delete: (id) => projectApi.delete(`/projects/${id}`),
  sync: (id) => projectApi.post(`/projects/${id}/sync`),
};

// Files API (신규 파일 관리용)
export const filesApi = {
  // 모든 파일 조회 (original + modified files 통합)
  list: (projectId, fileType) => {
    const params = fileType ? `?file_type=${fileType}` : '';
    return projectApi.get(`/projects/${projectId}/files${params}`);
  },
  
  // 특정 파일 조회 (file_id로)
  get: (projectId, fileId) => projectApi.get(`/projects/${projectId}/files/${fileId}`),
  
  // 파일 생성/수정/삭제는 modifiedFilesApi 사용
  // 원본 파일은 GitHub 동기화를 통해서만 생성되고, 직접 생성/수정/삭제 불가
};

// Modified Files API (백엔드 API 엔드포인트에 맞게)
export const modifiedFilesApi = {
  // Modified files는 filesApi.list()를 통해 통합적으로 조회됨
  // 별도의 list 엔드포인트 없음
  
  // 특정 Modified file 조회
  get: (fileId) => projectApi.get(`/modified-files/${fileId}`),
  
  // 새로운 Modified file 생성 (프로젝트별 엔드포인트 사용)
  create: (projectId, data) => projectApi.post(`/projects/${projectId}/modified-files`, data),
  
  // Modified file 업데이트
  update: (fileId, data) => projectApi.put(`/modified-files/${fileId}`, data),
  
  // Modified file 삭제
  delete: (fileId) => projectApi.delete(`/modified-files/${fileId}`),
  
  // 프로젝트의 모든 Modified files 삭제 (리셋)
  deleteAll: (projectId) => projectApi.delete(`/projects/${projectId}/modified-files`),
};

// Benchmark Deployer API (신규 배포 및 터미널 관리용)
export const deployerApi_functions = {
  // VLLM Helm 배포 API
  deployVllmWithHelm: (vllmConfig, vllmHelmConfig, benchmarkConfigs = [], schedulingConfig = null, priority = 'medium', skipVllmCreation = false) => 
    deployerApi.post('/vllm/helm/deploy', {
      vllm_config: vllmConfig,
      vllm_helm_config: vllmHelmConfig,
      benchmark_configs: benchmarkConfigs,
      scheduling_config: schedulingConfig,
      priority,
      skip_vllm_creation: skipVllmCreation
    }),
  
  // 기존 큐 기반 배포 (GitHub 토큰 없음)
  deployVllmToQueue: (vllmConfig, benchmarkConfigs = [], schedulingConfig = null, priority = 'medium', skipVllmCreation = false) => 
    deployerApi.post('/vllm/queue/deployment', {
      vllm_config: vllmConfig,
      benchmark_configs: benchmarkConfigs,
      scheduling_config: schedulingConfig,
      priority,
      skip_vllm_creation: skipVllmCreation
    }),
  
  // 큐 관리
  getVllmQueueList: () => 
    deployerApi.get('/vllm/queue/list'),
  
  getVllmQueueStatus: () => 
    deployerApi.get('/vllm/queue/status'),
  
  cancelVllmQueueRequest: (requestId) => 
    deployerApi.post(`/vllm/queue/${requestId}/cancel`),
  
  changeVllmQueuePriority: (requestId, priority) => 
    deployerApi.post(`/vllm/queue/${requestId}/priority`, { priority }),
  
  // 스케줄러 관리
  triggerVllmScheduler: () => 
    deployerApi.post('/vllm/queue/scheduler/trigger'),
  
  // 터미널 세션
  createTerminalSession: () => 
    deployerApi.post('/terminal/create'),
  
  getTerminalSession: (sessionId) => 
    deployerApi.get(`/terminal/${sessionId}`),
  
  deleteTerminalSession: (sessionId) => 
    deployerApi.delete(`/terminal/${sessionId}`),
  
  // WebSocket 연결
  connectWebSocket: (sessionId, baseUrl = null) => {
    let wsBaseUrl;
    
    if (baseUrl) {
      wsBaseUrl = baseUrl;
    } else if (isDevelopment) {
      wsBaseUrl = 'ws://localhost:8002';
    } else {
      // 프로덕션 환경에서는 현재 프로토콜에 따라 ws/wss 결정
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBaseUrl = `${protocol}//${window.location.host}/deploy`;
    }
    
    const url = `${wsBaseUrl}/terminal/${sessionId}`;
    return new WebSocket(url);
  }
};

// WebSocket 연결 함수 (기존 - 호환성 유지)
export const createWebSocketConnection = (sessionId, baseUrl = null) => {
  let wsBaseUrl;
  
  if (baseUrl) {
    wsBaseUrl = baseUrl;
  } else if (isDevelopment) {
    wsBaseUrl = 'ws://localhost:8002';
  } else {
    // 프로덕션 환경에서는 현재 프로토콜에 따라 ws/wss 결정
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBaseUrl = `${protocol}//${window.location.host}/deploy`;
  }
  
  const url = `${wsBaseUrl}/terminal/${sessionId}`;
  return new WebSocket(url);
};

export const vllmApiGateway_functions = {
  getModelList: () => vllmApiGateway.get('/v1/models'),
};

// VLLM Management API Functions (신규)
export const vllmManagementApi_functions = {
  // 기존 VLLM 배포 관리
  deploy: (config, deploymentName = null) => 
    vllmManagementApi.post('/deploy', { config, deployment_name: deploymentName }),
  
  deployFromFile: (configFile) => 
    vllmManagementApi.post('/deploy-from-file', { config_file: configFile }),
  
  deployDefault: () => 
    vllmManagementApi.post('/deploy-default'),
  
  listDeployments: () => 
    vllmManagementApi.get('/deployments'),
  
  getDeploymentStatus: (deploymentId) => 
    vllmManagementApi.get(`/deployments/${deploymentId}/status`),
  
  stopDeployment: (deploymentId) => 
    vllmManagementApi.delete(`/deployments/${deploymentId}`),
  
  // 신규 큐 관리 API
  addToQueue: (config, benchmarkConfigs = null, schedulingConfig = null, priority = 'medium', skipVllmCreation = false) => 
    vllmManagementApi.post('/queue/deployment', {
      vllm_config: config,
      benchmark_configs: benchmarkConfigs,
      scheduling_config: schedulingConfig,
      priority,
      skip_vllm_creation: skipVllmCreation
    }),
  
  getQueueList: () => 
    vllmManagementApi.get('/queue/list'),
  
  getQueueStatus: () => 
    vllmManagementApi.get('/queue/status'),
  
  getQueueRequest: (requestId) => 
    vllmManagementApi.get(`/queue/${requestId}`),
  
  cancelQueueRequest: (requestId) => 
    vllmManagementApi.post(`/queue/${requestId}/cancel`),
  
  deleteQueueRequest: (requestId) => 
    vllmManagementApi.delete(`/queue/${requestId}`),
  
  forceDeleteQueueRequest: (requestId) => 
    vllmManagementApi.delete(`/queue/${requestId}/force`),
  
  changeQueuePriority: (requestId, priority) => 
    vllmManagementApi.post(`/queue/${requestId}/priority`, { priority }),
  
  // 신규 스케줄러 API
  startScheduler: () => 
    vllmManagementApi.post('/scheduler/start'),
  
  stopScheduler: () => 
    vllmManagementApi.post('/scheduler/stop'),
  
  pauseScheduler: () => 
    vllmManagementApi.post('/scheduler/pause'),
  
  resumeScheduler: () => 
    vllmManagementApi.post('/scheduler/resume'),
  
  getSchedulerStatus: () => 
    vllmManagementApi.get('/scheduler/status'),
  
  updateSchedulerConfig: (config) => 
    vllmManagementApi.put('/scheduler/config', config),
  
  // 신규 비교 및 분석 API
  compareDeployments: () => 
    vllmManagementApi.get('/compare/deployments'),
  
  compareConfigs: (config1, config2) => 
    vllmManagementApi.post('/compare/configs', { config1, config2 }),
  
  analyzeGpuResources: () => 
    vllmManagementApi.get('/compare/gpu-resources'),
  
  checkCompatibility: (config) => 
    vllmManagementApi.post('/compare/compatibility', { config }),
  
  // 신규 벤치마크 연동 API
  triggerBenchmark: (deploymentId, benchmarkConfig) => 
    vllmManagementApi.post('/benchmark/trigger', { deployment_id: deploymentId, benchmark_config: benchmarkConfig }),
  
  getBenchmarkResults: (deploymentId) => 
    vllmManagementApi.get(`/benchmark/results/${deploymentId}`),

  // 벤치마크 Job 생성 API (benchmark-deployer 연동)
  createBenchmarkJob: (vllmDeploymentId, jobConfig) => 
    vllmManagementApi.post('/benchmark/create-job', { 
      vllm_deployment_id: vllmDeploymentId, 
      job_config: jobConfig 
    }),
  
  // 큐에 벤치마크 Job 생성 요청 추가
  addBenchmarkJobToQueue: (vllmConfig, benchmarkJobConfig, priority = 'medium') => 
    vllmManagementApi.post('/queue/benchmark-job', {
      vllm_config: vllmConfig,
      benchmark_job_config: benchmarkJobConfig,
      priority
    }),
  
  // 헬스체크 및 시스템 상태
  getHealth: () => 
    vllmManagementApi.get('/health'),
  
  getSystemStatus: () => 
    vllmManagementApi.get('/status'),
  
  // 설정 파일 관리
  listConfigFiles: () => 
    vllmManagementApi.get('/configs/files'),
  
  validateConfig: (config) => 
    vllmManagementApi.get('/configs/validate', { params: { config } }),
};

// Terminal WebSocket 함수 (별칭)
export const createTerminalWebSocket = createWebSocketConnection;

// Default export for backward compatibility
export default benchmarkApi; 