import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  TextField,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Terminal as TerminalIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { deployerApi_functions, createTerminalWebSocket } from '../utils/api';

const DeployerDetailPage = ({ terminal = false }) => {
  const { jobName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 터미널 모드 체크: prop 또는 URL 경로
  const isTerminalMode = terminal || location.pathname.includes('/terminal');
  
  const [jobStatus, setJobStatus] = useState(null);
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(isTerminalMode ? 0 : 0); // 터미널 모드면 터미널 탭(0)을 기본으로
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLines, setLogLines] = useState(100);
  
  // 배포 정보 (YAML 내용 포함)
  const [deploymentInfo, setDeploymentInfo] = useState(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  
  // Terminal states
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [ws, setWs] = useState(null);
  
  const terminalRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const initializePage = async () => {
      // 먼저 Job 상태를 가져옵니다
      await fetchJobStatus();
      
      // 배포 정보도 함께 가져옵니다 (YAML 내용 포함)
      await fetchDeploymentInfo();
      
      // 터미널 모드에서 session_id가 있으면 자동 연결
      if (isTerminalMode) {
        const searchParams = new URLSearchParams(location.search);
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
          // 약간의 딜레이 후 터미널 연결
          setTimeout(() => {
            connectToTerminal(sessionId);
          }, 1500);
        }
      }
    };
    
    initializePage();
  }, [jobName, isTerminalMode, location.search]);



  useEffect(() => {
    if (tabValue === 1) {
      fetchLogs();
    } else if (tabValue === 2) {
      fetchDeploymentInfo();
    }
  }, [tabValue, jobName]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 터미널 출력 자동 스크롤
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // 터미널 포커스 유지
  useEffect(() => {
    const handleWindowClick = (event) => {
      // 터미널이 연결되어 있고, 클릭이 터미널 영역 내부에서 발생했을 때
      if (terminalConnected && terminalRef.current && terminalRef.current.contains(event.target)) {
        terminalRef.current.focus();
      }
    };

    if (terminalConnected) {
      document.addEventListener('click', handleWindowClick);
      return () => document.removeEventListener('click', handleWindowClick);
    }
  }, [terminalConnected]);

  const fetchJobStatus = async () => {
    try {
      setLoading(true);
      const response = await deployerApi_functions.getJobStatus(jobName);
      setJobStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await deployerApi_functions.getJobLogs(jobName, 'default', logLines);
      // 백엔드 LogResponse: logs는 List[str] 형태이므로 join으로 문자열 변환
      const logsArray = response.data.logs || [];
      setLogs(Array.isArray(logsArray) ? logsArray.join('\n') : (logsArray || '로그가 없습니다.'));
    } catch (err) {
      setLogs(`로그 조회 실패: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchDeploymentInfo = async () => {
    try {
      setDeploymentLoading(true);
      const response = await deployerApi_functions.listDeployments();
      const deployments = response.data || [];
      
      // jobName과 일치하는 배포 찾기
      const deployment = deployments.find(d => d.resource_name === jobName);
      if (deployment) {
        setDeploymentInfo(deployment);
      } else {
        setDeploymentInfo(null);
      }
    } catch (err) {
      setDeploymentInfo(null);
    } finally {
      setDeploymentLoading(false);
    }
  };



  const createTerminalSession = async () => {
    try {
      // Job 터미널 세션 생성 (TerminalSessionRequest 구조로 요청)
      const response = await deployerApi_functions.createJobTerminal(
        jobName, 
        jobStatus?.namespace || 'default',
        { shell: '/bin/bash' } // 추가 옵션
      );
      
      // TerminalSessionResponse 구조에 맞게 처리
      const session = response.data;
      
      setCurrentSession(session);
      
      // 세션 ID로 터미널 연결
      if (session?.session_id) {
        connectToTerminal(session.session_id);
      } else {
        alert('터미널 세션은 생성되었지만 세션 ID를 찾을 수 없습니다.');
      }
    } catch (err) {
      let errorMessage = '터미널 생성 실패';
      if (err.response?.data?.detail) {
        errorMessage += `: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      
      alert(errorMessage);
    }
  };

  const connectToTerminal = (sessionId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const websocket = createTerminalWebSocket(sessionId);
      wsRef.current = websocket;
      setWs(websocket);

      websocket.onopen = () => {
        setTerminalConnected(true);
        setTerminalOutput(prev => prev + `\n=== 터미널 연결됨 (세션: ${sessionId.substring(0, 8)}...) ===\n`);
        
        // 터미널에 포커스
        setTimeout(() => {
          terminalRef.current?.focus();
        }, 100);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              setTerminalOutput(prev => 
                prev + `\n=== 연결 완료: ${data.pod_name || 'Unknown Pod'} (${data.container_name || 'Unknown Container'}) ===\n`
              );
              break;
            case 'output':
            case 'stdout':
              setTerminalOutput(prev => prev + data.data);
              break;
            case 'error_output':
            case 'stderr':
              setTerminalOutput(prev => prev + data.data);
              break;
            case 'error':
              setTerminalOutput(prev => prev + `\nERROR: ${data.message}\n`);
              break;
            default:
              setTerminalOutput(prev => prev + JSON.stringify(data) + '\n');
          }
        } catch (parseErr) {
          setTerminalOutput(prev => prev + event.data + '\n');
        }
      };

      websocket.onclose = (event) => {
        setTerminalConnected(false);
        setTerminalOutput(prev => prev + `\n=== 터미널 연결 종료 (코드: ${event.code}) ===\n`);
      };

      websocket.onerror = (error) => {
        setTerminalOutput(prev => prev + `\n=== 연결 오류: ${error.message || 'WebSocket 연결 실패'} ===\n`);
      };

    } catch (err) {
      alert(`터미널 연결 실패: ${err.message}`);
    }
  };

  const sendTerminalCommand = () => {
    if (ws && terminalConnected && terminalInput.trim()) {
      try {
        ws.send(JSON.stringify({
          type: 'input',
          data: terminalInput + '\n'
        }));
        setTerminalInput('');
      } catch (err) {
        setTerminalOutput(prev => prev + `\n=== 명령 전송 실패: ${err.message} ===\n`);
      }
    }
  };

  const handleTerminalKeyDown = (event) => {
    if (!terminalConnected) return;

    // 터미널에 포커스 유지
    event.preventDefault();

    switch (event.key) {
      case 'Enter':
        if (terminalInput.trim()) {
          sendTerminalCommand();
        } else {
          // 빈 엔터도 전송
          try {
            setTerminalOutput(prev => prev + '\n');
            ws.send(JSON.stringify({
              type: 'input',
              data: '\n'
            }));
          } catch (err) {
          }
        }
        break;

      case 'Backspace':
        setTerminalInput(prev => prev.slice(0, -1));
        break;

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // 화살표 키는 터미널로 전송
        try {
          ws.send(JSON.stringify({
            type: 'input',
            data: `\x1b[${event.key === 'ArrowUp' ? 'A' : event.key === 'ArrowDown' ? 'B' : event.key === 'ArrowLeft' ? 'D' : 'C'}`
          }));
        } catch (err) {
        }
        break;

      case 'Tab':
        // Tab 키도 터미널로 전송 (자동완성)
        try {
          ws.send(JSON.stringify({
            type: 'input',
            data: '\t'
          }));
        } catch (err) {
        }
        break;

      case 'c':
        if (event.ctrlKey) {
          // Ctrl+C
          try {
            setTerminalOutput(prev => prev + '^C\n');
            ws.send(JSON.stringify({
              type: 'input',
              data: '\x03' // Ctrl+C
            }));
            setTerminalInput('');
          } catch (err) {
          }
        } else {
          // 일반 문자 입력
          setTerminalInput(prev => prev + event.key);
        }
        break;

      case 'd':
        if (event.ctrlKey) {
          // Ctrl+D
          try {
            ws.send(JSON.stringify({
              type: 'input',
              data: '\x04' // Ctrl+D
            }));
          } catch (err) {}
        } else {
          // 일반 문자 입력
          setTerminalInput(prev => prev + event.key);
        }
        break;

      default:
        // 일반 문자 입력 (길이 1인 문자만)
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          setTerminalInput(prev => prev + event.key);
        }
        break;
    }
  };

  const disconnectTerminal = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setCurrentSession(null);
    setTerminalConnected(false);
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

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobName}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/deployer')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {jobName}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchJobStatus();
            fetchDeploymentInfo();
          }}
        >
          새로고침
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Job Status Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            작업 상태
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography color="textSecondary" gutterBottom>
                상태
              </Typography>
              <Chip
                label={jobStatus?.status || 'Unknown'}
                color={getStatusColor(jobStatus?.status)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography color="textSecondary" gutterBottom>
                네임스페이스
              </Typography>
              <Typography variant="body1">
                {jobStatus?.namespace || 'default'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography color="textSecondary" gutterBottom>
                시작 시간
              </Typography>
              <Typography variant="body1">
                {jobStatus?.start_time 
                  ? new Date(jobStatus.start_time).toLocaleString()
                  : 'N/A'
                }
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography color="textSecondary" gutterBottom>
                Pod 상태
              </Typography>
              <Typography variant="body1">
                활성: {jobStatus?.active_pods || 0} | 
                성공: {jobStatus?.succeeded_pods || 0} | 
                실패: {jobStatus?.failed_pods || 0}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="터미널" />
            <Tab label="로그" />
            <Tab label="YAML" />
          </Tabs>
        </Box>

        {/* Terminal Tab */}
        {tabValue === 0 && (
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                터미널
              </Typography>
              <Box>
                {!terminalConnected ? (
                  <Button
                    variant="contained"
                    startIcon={<TerminalIcon />}
                    onClick={createTerminalSession}
                  >
                    터미널 연결
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={disconnectTerminal}
                  >
                    연결 해제
                  </Button>
                )}
              </Box>
            </Box>

            {/* Terminal Output */}
            <Paper 
              variant="outlined" 
              tabIndex={0}
              ref={terminalRef}
              onClick={() => terminalRef.current?.focus()}
              onKeyDown={handleTerminalKeyDown}
              sx={{ 
                p: 2, 
                mb: 2, 
                height: '400px', 
                overflow: 'auto',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '14px',
                cursor: terminalConnected ? 'text' : 'default',
                outline: 'none',
                '&:focus': {
                  boxShadow: terminalConnected ? '0 0 0 2px #1976d2' : 'none'
                }
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {terminalOutput || '터미널을 연결하여 시작하세요...'}
                {terminalConnected && (
                  <span>
                    {terminalInput}
                    <span 
                      className="terminal-cursor"
                      style={{ 
                        backgroundColor: '#ffffff', 
                        color: '#1e1e1e',
                        display: 'inline-block',
                        width: '8px',
                        height: '16px',
                        marginLeft: '2px'
                      }}
                    >
                      &nbsp;
                    </span>
                  </span>
                )}
              </pre>
            </Paper>

            {/* Global CSS for terminal cursor animation */}
            <style>
              {`
                @keyframes blink {
                  0%, 50% { opacity: 1; }
                  51%, 100% { opacity: 0; }
                }
                .terminal-cursor {
                  animation: blink 1s infinite;
                }
              `}
            </style>
          </CardContent>
        )}

        {/* Logs Tab */}
        {tabValue === 1 && (
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                로그
              </Typography>
              <Box>
                <TextField
                  type="number"
                  value={logLines}
                  onChange={(e) => setLogLines(Number(e.target.value))}
                  size="small"
                  sx={{ width: '100px', mr: 1 }}
                  label="라인 수"
                />
                <Button
                  variant="outlined"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  sx={{ mr: 1 }}
                >
                  {logsLoading ? <CircularProgress size={20} /> : '새로고침'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadLogs}
                >
                  다운로드
                </Button>
              </Box>
            </Box>

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                height: '500px', 
                overflow: 'auto',
                backgroundColor: '#f5f5f5',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {logs}
              </pre>
            </Paper>
          </CardContent>
        )}

        {/* YAML Tab */}
        {tabValue === 2 && (
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                배포 YAML
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  onClick={fetchDeploymentInfo}
                  disabled={deploymentLoading}
                  sx={{ mr: 1 }}
                >
                  {deploymentLoading ? <CircularProgress size={20} /> : '새로고침'}
                </Button>
                {deploymentInfo?.yaml_content && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      const blob = new Blob([deploymentInfo.yaml_content], { type: 'text/yaml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${jobName}-deployment.yaml`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    다운로드
                  </Button>
                )}
              </Box>
            </Box>

            {deploymentInfo ? (
              <Box>
                {/* 배포 메타데이터 */}
                <Paper 
                  variant="outlined" 
                  sx={{ p: 2, mb: 2, backgroundColor: '#e3f2fd' }}
                >
                  <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                    배포 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        배포 ID
                      </Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {deploymentInfo.deployment_id || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        리소스 타입
                      </Typography>
                      <Typography variant="body2">
                        {deploymentInfo.resource_type || 'Unknown'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        네임스페이스
                      </Typography>
                      <Typography variant="body2">
                        {deploymentInfo.namespace || 'default'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        생성 시간
                      </Typography>
                      <Typography variant="body2">
                        {deploymentInfo.created_at 
                          ? new Date(deploymentInfo.created_at).toLocaleString()
                          : 'N/A'
                        }
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* YAML 내용 */}
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    height: '400px', 
                    overflow: 'auto',
                    backgroundColor: '#f8f9fa',
                    fontFamily: 'monospace',
                    fontSize: '14px'
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                    {deploymentInfo.yaml_content || '배포 정보에 YAML 내용이 없습니다.'}
                  </pre>
                </Paper>
              </Box>
            ) : (
              <Alert severity="info">
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  배포 정보를 찾을 수 없습니다
                </Typography>
                <Typography variant="body2">
                  이 작업({jobName})에 대한 배포 정보가 존재하지 않거나 아직 로드되지 않았습니다.
                  '새로고침' 버튼을 클릭하여 다시 시도해보세요.
                </Typography>
              </Alert>
            )}
          </CardContent>
        )}


      </Card>
    </Box>
  );
};

export default DeployerDetailPage; 