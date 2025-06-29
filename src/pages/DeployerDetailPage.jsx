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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Terminal as TerminalIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
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
  const [terminalSessions, setTerminalSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(isTerminalMode ? 2 : 0); // 터미널 모드면 터미널 탭(2)을 기본으로
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLines, setLogLines] = useState(100);
  
  // Terminal states
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [ws, setWs] = useState(null);
  
  const terminalRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchJobStatus();
    fetchTerminalSessions();
    
    // 터미널 모드에서 session_id가 있으면 자동 연결
    if (isTerminalMode) {
      const searchParams = new URLSearchParams(location.search);
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        // 약간의 딜레이 후 터미널 연결 (터미널 세션 목록이 로드된 후)
        setTimeout(() => {
          connectToTerminal(sessionId);
        }, 1000);
      }
    }
  }, [jobName, isTerminalMode, location.search]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchLogs();
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

  const fetchTerminalSessions = async () => {
    try {
      const response = await deployerApi_functions.listTerminalSessions(jobName);
      // 백엔드 TerminalSessionListResponse: sessions 필드를 사용
      setTerminalSessions(response.data?.sessions || []);
    } catch (err) {
      console.error('Failed to fetch terminal sessions:', err);
    }
  };

  const createTerminalSession = async () => {
    try {
      const response = await deployerApi_functions.createJobTerminal(jobName);
      const session = response.data;
      setCurrentSession(session);
      await fetchTerminalSessions();
      connectToTerminal(session.session_id);
    } catch (err) {
      alert(`터미널 생성 실패: ${err.response?.data?.detail || err.message}`);
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
        setTerminalOutput(prev => prev + '\n=== 터미널 연결됨 ===\n');
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            setTerminalOutput(prev => 
              prev + `\n=== 연결 완료: ${data.pod_name} (${data.container_name}) ===\n`
            );
            break;
          case 'output':
          case 'error_output':
            setTerminalOutput(prev => prev + data.data);
            break;
          case 'error':
            setTerminalOutput(prev => prev + `\nERROR: ${data.message}\n`);
            break;
        }
      };

      websocket.onclose = () => {
        setTerminalConnected(false);
        setTerminalOutput(prev => prev + '\n=== 터미널 연결 종료 ===\n');
      };

      websocket.onerror = (error) => {
        setTerminalOutput(prev => prev + `\n=== 연결 오류: ${error.message || 'Unknown error'} ===\n`);
      };

    } catch (err) {
      alert(`터미널 연결 실패: ${err.message}`);
    }
  };

  const sendTerminalCommand = () => {
    if (ws && terminalConnected && terminalInput.trim()) {
      ws.send(JSON.stringify({
        type: 'input',
        data: terminalInput + '\n'
      }));
      setTerminalInput('');
    }
  };

  const handleTerminalKeyPress = (event) => {
    if (event.key === 'Enter') {
      sendTerminalCommand();
    }
  };

  const disconnectTerminal = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setCurrentSession(null);
    setTerminalConnected(false);
  };

  const deleteTerminalSession = async (sessionId) => {
    try {
      await deployerApi_functions.deleteTerminalSession(sessionId);
      await fetchTerminalSessions();
      if (currentSession?.session_id === sessionId) {
        disconnectTerminal();
      }
    } catch (err) {
      alert(`세션 삭제 실패: ${err.response?.data?.detail || err.message}`);
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
          onClick={fetchJobStatus}
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
            <Tab label="세션 관리" />
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
              sx={{ 
                p: 2, 
                mb: 2, 
                height: '400px', 
                overflow: 'auto',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {terminalOutput || '터미널을 연결하여 시작하세요...'}
              </pre>
            </Paper>

            {/* Terminal Input */}
            {terminalConnected && (
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyPress={handleTerminalKeyPress}
                  placeholder="명령어를 입력하세요..."
                  variant="outlined"
                  size="small"
                  sx={{ fontFamily: 'monospace' }}
                />
                <Button
                  variant="contained"
                  onClick={sendTerminalCommand}
                  disabled={!terminalInput.trim()}
                >
                  실행
                </Button>
              </Box>
            )}
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

        {/* Sessions Tab */}
        {tabValue === 2 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>
              터미널 세션 관리
            </Typography>
            
            {terminalSessions.length === 0 ? (
              <Typography color="textSecondary">
                활성 터미널 세션이 없습니다.
              </Typography>
            ) : (
              <List>
                {terminalSessions.map((session) => (
                  <ListItem key={session.session_id} divider>
                    <ListItemText
                      primary={`세션 ${session.session_id.substring(0, 8)}...`}
                      secondary={`Pod: ${session.pod_name} | Container: ${session.container_name} | 생성: ${new Date(session.created_at).toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => connectToTerminal(session.session_id)}
                        sx={{ mr: 1 }}
                      >
                        연결
                      </Button>
                      <IconButton
                        edge="end"
                        onClick={() => deleteTerminalSession(session.session_id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        )}
      </Card>
    </Box>
  );
};

export default DeployerDetailPage; 