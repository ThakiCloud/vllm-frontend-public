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

// Default export for backward compatibility
export default benchmarkApi; 