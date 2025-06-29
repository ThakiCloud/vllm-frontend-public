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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as DeployIcon,
  Terminal as TerminalIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { deployerApi_functions, projectsApi, filesApi } from '../utils/api';

const DeployerListPage = () => {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [deploying, setDeploying] = useState(false);
  
  // 삭제 관련 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deploymentToDelete, setDeploymentToDelete] = useState(null);
  const [deleteYamlContent, setDeleteYamlContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // 프로젝트 및 파일 관련 상태
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [jobFiles, setJobFiles] = useState([]);
  const [selectedJobFile, setSelectedJobFile] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Config 파일 관련 상태 추가
  const [configFiles, setConfigFiles] = useState([]);
  const [selectedConfigFile, setSelectedConfigFile] = useState('');
  const [loadingConfigFiles, setLoadingConfigFiles] = useState(false);
  const [originalJobYaml, setOriginalJobYaml] = useState(''); // 원본 Job YAML 저장용

  const defaultYaml = `apiVersion: batch/v1
kind: Job
metadata:
  name: my-benchmark-job
  labels:
    app: benchmark
spec:
  template:
    spec:
      containers:
      - name: benchmark-container
        image: busybox
        command: ['sh', '-c']
        args: ['echo "Hello World"; sleep 300']
      restartPolicy: Never
  backoffLimit: 3`;

  useEffect(() => {
    fetchDeployments();
  }, []);

  useEffect(() => {
    if (openDialog) {
      fetchProjects();
    }
  }, [openDialog]);

  useEffect(() => {
    if (selectedProject) {
      fetchJobFiles();
    } else {
      setJobFiles([]);
      setSelectedJobFile('');
      setYamlContent(defaultYaml); // 프로젝트 선택 해제 시 기본 템플릿으로 초기화
    }
  }, [selectedProject]);

  // Job 파일 선택 시 config 파일 불러오기
  useEffect(() => {
    if (selectedProject && selectedJobFile) {
      fetchConfigFiles();
    } else {
      setConfigFiles([]);
      setSelectedConfigFile('');
    }
  }, [selectedProject, selectedJobFile]);
  
  const fetchDeployments = async () => {
    try {
      setLoading(true);
      const response = await deployerApi_functions.listDeployments();
      console.log(response.data);
      setDeployments(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await projectsApi.list();
      setProjects(response.data || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchJobFiles = async () => {
    if (!selectedProject) return;
    
    try {
      setLoadingFiles(true);
      const response = await filesApi.list(selectedProject, 'job');
      setJobFiles(response.data || []);
    } catch (err) {
      console.error('Failed to fetch job files:', err);
      setJobFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchConfigFiles = async () => {
    if (!selectedProject || !selectedJobFile) return;
    
    try {
      setLoadingConfigFiles(true);
      const response = await filesApi.list(selectedProject, 'config');
      setConfigFiles(response.data || []);
    } catch (err) {
      console.error('Failed to fetch config files:', err);
      setConfigFiles([]);
    } finally {
      setLoadingConfigFiles(false);
    }
  };

  const loadJobFileContent = async (fileId) => {
    try {
      const response = await filesApi.get(selectedProject, fileId);
      const fileData = response.data;

      // 파일 타입에 따라 적절한 내용 가져오기
      let jobYaml = '';
      if (fileData.file_type === 'original') {
        jobYaml = fileData.file.content || '';
      } else if (fileData.file_type === 'modified') {
        jobYaml = fileData.file.content || '';
      }
      
      // 원본 Job YAML 저장
      setOriginalJobYaml(jobYaml);
      setYamlContent(jobYaml);
    } catch (err) {
      alert(`파일 로드 실패: ${err.response?.data?.detail || err.message}`);
    }
  };

  const loadConfigFileContent = async (fileId) => {
    if (!fileId) return null;
    
    try {
      const response = await filesApi.get(selectedProject, fileId);
      const fileData = response.data;

      // Config 파일 내용 반환
      if (fileData.file_type === 'original') {
        return fileData.file.content || '';
      } else if (fileData.file_type === 'modified') {
        return fileData.file.content || '';
      }
      return '';
    } catch (err) {
      console.error(`Config 파일 로드 실패: ${err.response?.data?.detail || err.message}`);
      return null;
    }
  };

  const generateYamlWithConfigMap = async (jobYaml, configFileId) => {
    if (!configFileId || !jobYaml) {
      return jobYaml;
    }

    try {
      // Config 파일 내용 로드
      const configContent = await loadConfigFileContent(configFileId);
      if (!configContent) {
        return jobYaml;
      }

      // ConfigMap YAML 생성
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

      // Job YAML 파싱 및 volume, volumeMount 추가
      const lines = jobYaml.split('\n');
      const modifiedLines = [];
      let inContainerSpec = false;
      let containerIndent = 0;
      let volumeMountAdded = false;
      let volumeAdded = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        modifiedLines.push(line);

        // containers 섹션 찾기
        if (line.trim().startsWith('containers:')) {
          inContainerSpec = true;
        }

        // container 내부에서 image 라인 다음에 volumeMounts 추가
        if (inContainerSpec && line.includes('image:') && !volumeMountAdded) {
          // 다음 몇 라인을 확인하여 volumeMounts가 이미 있는지 체크
          let hasVolumeMounts = false;
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].includes('volumeMounts:')) {
              hasVolumeMounts = true;
              break;
            }
            if (lines[j].trim().startsWith('-') || lines[j].includes('restartPolicy:')) {
              break;
            }
          }

          if (!hasVolumeMounts) {
            // 현재 들여쓰기 레벨 파악
            const currentIndent = line.match(/^(\s*)/)[1];
              modifiedLines.push(`${currentIndent}volumeMounts:`);
              modifiedLines.push(`${currentIndent}- name: config-volume`);
              modifiedLines.push(`${currentIndent}  mountPath: /app/configs`);
              modifiedLines.push(`${currentIndent}  readOnly: true`);
            volumeMountAdded = true;
          }
        }

        // restartPolicy 라인 다음에 volumes 추가
        if (line.trim().startsWith('restartPolicy:') && !volumeAdded) {
          // 현재 들여쓰기 레벨 파악 (spec.template.spec 레벨)
          const currentIndent = line.match(/^(\s*)/)[1];
          modifiedLines.push(`${currentIndent}volumes:`);
          modifiedLines.push(`${currentIndent}- name: config-volume`);
          modifiedLines.push(`${currentIndent}  configMap:`);
          modifiedLines.push(`${currentIndent}    name: ${configMapName}`);
          volumeAdded = true;
        }
      }

             // 수정된 Job과 ConfigMap을 결합 (Job 먼저, ConfigMap 뒤에)
       return `${modifiedLines.join('\n')}\n${configMap}`;

    } catch (err) {
      console.error('YAML 생성 중 오류:', err);
      return jobYaml;
    }
  };

  const handleDeploy = async () => {
    if (!yamlContent.trim()) {
      alert('YAML 내용을 입력해주세요.');
      return;
    }

    try {
      setDeploying(true);
      await deployerApi_functions.deploy(yamlContent, namespace);
      setOpenDialog(false);
      setYamlContent('');
      setNamespace('default');
      await fetchDeployments();
      alert('배포가 성공적으로 완료되었습니다.');
    } catch (err) {
      alert(`배포 실패: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleOpenDialog = () => {
    setYamlContent(defaultYaml);
    setNamespace('default');
    setSelectedProject('');
    setSelectedJobFile('');
    setJobFiles([]);
    // Config 관련 상태 초기화
    setConfigFiles([]);
    setSelectedConfigFile('');
    setOriginalJobYaml('');
    setOpenDialog(true);
  };

  const handleProjectSelect = (projectId) => {
    // 프로젝트 변경 시 기존 선택 초기화
    setSelectedProject(projectId);
    setSelectedJobFile('');
    setYamlContent(defaultYaml);
    // Config 관련 상태 초기화
    setConfigFiles([]);
    setSelectedConfigFile('');
    setOriginalJobYaml('');
  };

  const handleJobFileSelect = async (fileId) => {
    setSelectedJobFile(fileId);
    // Config 관련 상태 초기화
    setSelectedConfigFile('');
    
    if (fileId) {
      await loadJobFileContent(fileId);
    } else {
      setYamlContent(defaultYaml);
      setOriginalJobYaml('');
    }
  };

  const handleConfigFileSelect = async (fileId) => {
    setSelectedConfigFile(fileId);
    
    if (originalJobYaml) {
      if (fileId) {
        // Config 파일이 선택되면 ConfigMap을 포함한 YAML 생성
        const updatedYaml = await generateYamlWithConfigMap(originalJobYaml, fileId);
        setYamlContent(updatedYaml);
      } else {
        // Config 파일 선택을 취소하면 원본 Job YAML로 되돌림
        setYamlContent(originalJobYaml);
      }
    }
  };

  const handleDeleteClick = (deployment) => {
    setDeploymentToDelete(deployment);
    // 백엔드에서 제공한 YAML 사용
    setDeleteYamlContent(deployment.yaml_content || '');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteYamlContent.trim()) {
      alert('삭제할 YAML 내용이 없습니다. 배포 데이터에 YAML이 포함되어 있지 않습니다.');
      return;
    }

    if (!deploymentToDelete) {
      alert('삭제할 배포가 선택되지 않았습니다.');
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
      // Job 터미널 세션 생성
      const response = await deployerApi_functions.createJobTerminal(
        deployment.resource_name,
        deployment.namespace || 'default'
      );
      
      // 터미널 세션이 생성되면 터미널 페이지로 이동
      if (response.data?.session_id) {
        navigate(`/deployer/${deployment.resource_name}/terminal?session_id=${response.data.session_id}`);
      } else {
        // 세션 ID가 없으면 기본 터미널 페이지로 이동
        navigate(`/deployer/${deployment.resource_name}/terminal`);
      }
    } catch (err) {
      alert(`터미널 세션 생성 실패: ${err.response?.data?.detail || err.message}`);
    }
  };

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
          Benchmark Deployer
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDeployments}
            sx={{ mr: 2 }}
          >
            새로고침
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
            활성 배포 목록
          </Typography>
          
          {deployments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                배포된 작업이 없습니다. 새 배포를 생성해보세요.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>작업 이름</TableCell>
                    <TableCell>네임스페이스</TableCell>
                    <TableCell>타입</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>생성 시간</TableCell>
                    <TableCell align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deployments.map((deployment, index) => (
                    <TableRow key={deployment.deployment_id || index}>
                      <TableCell>{deployment.resource_name}</TableCell>
                      <TableCell>{deployment.namespace}</TableCell>
                      <TableCell>{deployment.resource_type}</TableCell>
                      <TableCell>
                        <Chip
                          label={deployment.status || 'Unknown'}
                          color={getStatusColor(deployment.status)}
                          size="small"
                        />
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
                          onClick={() => navigate(`/deployer/${deployment.resource_name}`)}
                          title="상세 보기"
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          color="secondary"
                          onClick={() => handleTerminalAccess(deployment)}
                          title="터미널 접속"
                        >
                          <TerminalIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteClick(deployment)}
                          title="삭제"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Deploy Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>새 배포 생성</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* 왼쪽: 설정 및 파일 선택 */}
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 2, mt: 1 }}>
                <TextField
                  fullWidth
                  label="네임스페이스"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  placeholder="예: default, benchmark, testing"
                  helperText="배포할 Kubernetes 네임스페이스를 입력하세요"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                기존 Job 파일 불러오기
              </Typography>
              
              {/* 프로젝트 선택 */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>프로젝트 선택</InputLabel>
                  <Select
                    value={selectedProject}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    label="프로젝트 선택"
                    disabled={loadingProjects}
                  >
                  <MenuItem key="empty-project" value="">
                    <em>없음 (기본 템플릿 사용)</em>
                  </MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.project_id} value={project.project_id}>
                      <Box display="flex" alignItems="center">
                        <FolderIcon sx={{ mr: 1, fontSize: 16 }} />
                        {project.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 프로젝트 선택 안내 */}
              {!selectedProject && (
                <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                  <Box>
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      📋 프로젝트를 먼저 선택해주세요
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      프로젝트를 선택하면 해당 프로젝트의 Job 파일들을 불러올 수 있습니다.
                      또는 기본 템플릿을 사용하여 배포할 수도 있습니다.
                    </Typography>
                  </Box>
                </Alert>
              )}

              {/* Job 파일 목록 */}
              {selectedProject && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, mb: 1 }}>
                    Job 파일 목록
                  </Typography>
                  
                  {loadingFiles ? (
                    <Box display="flex" justifyContent="center" my={2}>
                      <CircularProgress size={24} />
                      <Typography sx={{ ml: 1 }}>파일 로딩 중...</Typography>
                    </Box>
                  ) : jobFiles.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      이 프로젝트에는 job 파일이 없습니다.
                    </Alert>
                  ) : (
                    <Box sx={{ maxHeight: '300px', overflow: 'auto', mb: 2 }}>
                      {/* 기본 템플릿 옵션 */}
                      <Paper
                        sx={{
                          p: 2,
                          mb: 1,
                          cursor: 'pointer',
                          border: selectedJobFile === '' ? 2 : 1,
                          borderColor: selectedJobFile === '' ? 'primary.main' : 'divider',
                          backgroundColor: selectedJobFile === '' ? 'action.selected' : 'background.paper',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          }
                        }}
                        onClick={() => handleJobFileSelect('')}
                      >
                        <Box display="flex" alignItems="center">
                          <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              기본 템플릿 사용
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              기본 Job 템플릿을 사용합니다
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>

                      {/* 실제 job 파일들 */}
                      {jobFiles.map((file) => (
                        <Paper
                          key={file.file_id}
                          sx={{
                            p: 2,
                            mb: 1,
                            cursor: 'pointer',
                            border: selectedJobFile === file.file_id ? 2 : 1,
                            borderColor: selectedJobFile === file.file_id ? 'primary.main' : 'divider',
                            backgroundColor: selectedJobFile === file.file_id ? 'action.selected' : 'background.paper',
                            '&:hover': {
                              backgroundColor: 'action.hover'
                            }
                          }}
                          onClick={() => handleJobFileSelect(file.file_id)}
                        >
                          <Box display="flex" alignItems="center">
                            <FileIcon 
                              sx={{ 
                                mr: 1, 
                                color: file.source === 'modified' ? 'warning.main' : 'primary.main' 
                              }} 
                            />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {file.file_path}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {file.source === 'modified' ? '수정된 파일' : '원본 파일'}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {selectedProject && !loadingFiles && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {selectedJobFile 
                    ? '선택한 파일의 내용이 오른쪽에 표시됩니다. 내용을 확인 후 배포하세요.'
                    : '위에서 Job 파일을 선택하거나 기본 템플릿을 사용하세요.'
                  }
                </Alert>
              )}

              {/* Config 파일 선택 섹션 */}
              {selectedProject && selectedJobFile && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="h6" gutterBottom>
                    Config 파일 선택 (선택사항)
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Config 파일을 선택하면 ConfigMap으로 생성되어 /app/config/eval_config.json 경로에 마운트됩니다.
                  </Typography>

                  {loadingConfigFiles ? (
                    <Box display="flex" justifyContent="center" my={2}>
                      <CircularProgress size={24} />
                      <Typography sx={{ ml: 1 }}>Config 파일 로딩 중...</Typography>
                    </Box>
                  ) : configFiles.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      이 프로젝트에는 config 파일이 없습니다.
                    </Alert>
                  ) : (
                    <Box sx={{ maxHeight: '200px', overflow: 'auto', mb: 2 }}>
                      {/* Config 파일 선택 안함 옵션 */}
                      <Paper
                        sx={{
                          p: 2,
                          mb: 1,
                          cursor: 'pointer',
                          border: selectedConfigFile === '' ? 2 : 1,
                          borderColor: selectedConfigFile === '' ? 'primary.main' : 'divider',
                          backgroundColor: selectedConfigFile === '' ? 'action.selected' : 'background.paper',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          }
                        }}
                        onClick={() => handleConfigFileSelect('')}
                      >
                        <Box display="flex" alignItems="center">
                          <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              Config 파일 사용 안함
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              기본 Job만 배포합니다
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>

                      {/* 실제 config 파일들 */}
                      {configFiles.map((file) => (
                        <Paper
                          key={file.file_id}
                          sx={{
                            p: 2,
                            mb: 1,
                            cursor: 'pointer',
                            border: selectedConfigFile === file.file_id ? 2 : 1,
                            borderColor: selectedConfigFile === file.file_id ? 'primary.main' : 'divider',
                            backgroundColor: selectedConfigFile === file.file_id ? 'action.selected' : 'background.paper',
                            '&:hover': {
                              backgroundColor: 'action.hover'
                            }
                          }}
                          onClick={() => handleConfigFileSelect(file.file_id)}
                        >
                          <Box display="flex" alignItems="center">
                            <FileIcon 
                              sx={{ 
                                mr: 1, 
                                color: file.source === 'modified' ? 'warning.main' : 'secondary.main' 
                              }} 
                            />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {file.file_path}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {file.source === 'modified' ? '수정된 파일' : '원본 파일'}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {selectedConfigFile && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2" fontWeight="medium" gutterBottom>
                        ✅ Config 파일이 선택되었습니다
                      </Typography>
                      <Typography variant="body2">
                        선택한 config 파일이 ConfigMap으로 생성되어 컨테이너의 /app/config/eval_config.json 경로에 마운트됩니다.
                        오른쪽 YAML 미리보기에서 ConfigMap과 volumeMount 설정을 확인할 수 있습니다.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
            </Grid>

            {/* 오른쪽: YAML 내용 (읽기 전용) */}
            <Grid item xs={12} md={8}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="h6" gutterBottom>
                  YAML 내용 미리보기
                </Typography>
                {selectedProject && selectedJobFile && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Job: {jobFiles.find(f => f.file_id === selectedJobFile)?.file_name || '선택된 파일'}
                      {jobFiles.find(f => f.file_id === selectedJobFile)?.file_type === 'modified' && ' (수정된 파일)'}
                    </Typography>
                    {selectedConfigFile && (
                      <Typography variant="body2" color="text.secondary">
                        Config: {configFiles.find(f => f.file_id === selectedConfigFile)?.file_name || '선택된 Config 파일'}
                        {configFiles.find(f => f.file_id === selectedConfigFile)?.file_type === 'modified' && ' (수정된 파일)'}
                        → ConfigMap + VolumeMount 포함
                      </Typography>
                    )}
                  </Box>
                )}
                {!selectedProject && (
                  <Typography variant="body2" color="text.secondary">
                    먼저 프로젝트를 선택해주세요
                  </Typography>
                )}
                {selectedProject && !selectedJobFile && (
                  <Typography variant="body2" color="text.secondary">
                    기본 템플릿
                  </Typography>
                )}
              </Box>
              
              <TextField
                fullWidth
                multiline
                rows={20}
                value={yamlContent}
                variant="outlined"
                InputProps={{
                  readOnly: true,
                  sx: { 
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    backgroundColor: '#f8f9fa',
                    '& .MuiInputBase-input': {
                      color: '#2d3748'
                    }
                  }
                }}
                placeholder="기존 Job 파일을 선택하거나 기본 템플릿이 표시됩니다..."
                helperText="내용을 확인한 후 배포 버튼을 클릭하세요. (수정 불가)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            취소
          </Button>
          <Button 
            onClick={handleDeploy} 
            variant="contained"
            disabled={deploying || !yamlContent.trim() || !namespace.trim()}
            startIcon={deploying ? <CircularProgress size={20} /> : <DeployIcon />}
          >
            {deploying ? '배포 중...' : '배포'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ 배포 삭제 확인
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              주의: 이 작업은 되돌릴 수 없습니다!
            </Typography>
            <Typography variant="body2">
              다음 배포를 삭제하려고 합니다:
            </Typography>
            <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                • 이름: {deploymentToDelete?.resource_name}
              </Typography>
              <Typography variant="body2">
                • 네임스페이스: {deploymentToDelete?.namespace}
              </Typography>
              <Typography variant="body2">
                • 타입: {deploymentToDelete?.resource_type}
              </Typography>
            </Box>
          </Alert>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            삭제할 리소스의 YAML 내용
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            배포 시 사용했던 원본 YAML 내용입니다. 이 내용으로 리소스를 삭제합니다.
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={15}
            value={deleteYamlContent}
            variant="outlined"
            InputProps={{
              readOnly: true,
              sx: { 
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: '#f8f9fa',
                '& .MuiInputBase-input': {
                  color: '#2d3748'
                }
              }
            }}
            placeholder={deleteYamlContent ? "YAML 내용을 로딩 중..." : "배포 데이터에서 YAML 내용을 찾을 수 없습니다."}
            sx={{ mt: 2 }}
            helperText={deleteYamlContent ? "원본 YAML 내용을 확인한 후 삭제 버튼을 클릭하세요." : "YAML 내용이 없으면 삭제할 수 없습니다."}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting || !deleteYamlContent.trim()}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
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