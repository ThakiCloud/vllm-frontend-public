import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Breadcrumbs,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Sync as SyncIcon,
  Delete as DeleteIcon,
  GitHub as GitHubIcon,
  InsertDriveFile as FileIcon,
  Add as AddIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import { useProjectStore } from '../store/projectStore';
import FileModal from '../components/FileModal';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`file-tabpanel-${index}`}
      aria-labelledby={`file-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const {
    currentProject,
    files,
    loading,
    error,
    fetchProject,
    fetchFiles,
    fetchModifiedFiles,
    syncProject,
    deleteModifiedFile,
    resetProjectFiles,
    clearError,
    projectSyncStates,
    getProjectSyncState,
  } = useProjectStore();

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchFiles(projectId, 'config');
      fetchFiles(projectId, 'job');
      fetchModifiedFiles(projectId);
    }
  }, [projectId, fetchProject, fetchFiles, fetchModifiedFiles]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSync = async () => {
    try {
      await syncProject(projectId);
      // sync 상태 관리는 이제 store에서 자동으로 처리됨
    } catch (error) {
      // 에러 처리도 store에서 자동으로 처리됨
    }
  };

  const handleCreateFile = (category) => {
    setSelectedFile({ category, is_custom: true });
    setIsFileModalOpen(true);
  };

  const handleDeleteFile = async (fileId, category) => {
    if (window.confirm('Are you sure you want to delete this modified file?')) {
      try {
        await deleteModifiedFile(fileId);
        // 삭제 후 modified files 목록 새로고침
        await fetchModifiedFiles(projectId);
      } catch (error) {
        // 파일 삭제 실패 시 에러 처리 (콘솔 로그 제거)
      }
    }
  };

  const handleCloseFileModal = () => {
    setIsFileModalOpen(false);
    setSelectedFile(null);
    // Refresh files after modal close
    fetchFiles(projectId, 'config');
    fetchFiles(projectId, 'job');
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getSyncStatus = (status) => {
    const statusConfig = {
      synced: { color: 'success', label: 'Synced' },
      syncing: { color: 'warning', label: 'Syncing' },
      failed: { color: 'error', label: 'Failed' },
      pending: { color: 'default', label: 'Pending' },
    };
    return statusConfig[status] || statusConfig.pending;
  };

  const getCombinedFiles = (fileType) => {
    const originalFiles = files[fileType] || [];
    const modifiedFiles = files.modified || [];
    
    // 백엔드에서 source 필드로 구분된 데이터를 처리
    const typeModifiedFiles = modifiedFiles.filter(f => f.file_type === fileType);
    
    const combinedFiles = [];
    
    // 모든 원본 파일들을 추가
    originalFiles.forEach(originalFile => {
      combinedFiles.push({
        ...originalFile,
        is_modified: false,
        source_type: 'original'
      });
    });
    
    // 모든 수정된 파일들을 추가 (원본 파일과 관계없이 독립적으로)
    typeModifiedFiles.forEach(modifiedFile => {
      combinedFiles.push({
        ...modifiedFile,
        is_modified: true,
        source_type: 'modified'
      });
    });
    
    return combinedFiles;
  };

  const renderFileCard = (file, category) => {
    // 파일 ID 식별 - 수정된 파일이면 file_id, 원본이면 file_id
    const fileId = file.file_id;
    const displayPath = file.file_path;
    const isOriginal = file.source_type === 'original';
    
    return (
    <Grid item xs={12} sm={6} md={4} key={`${fileId}-${file.source_type}`}>
      <Card sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        border: file.is_modified ? '2px solid #ff9800' : '1px solid #e0e0e0',
        backgroundColor: file.is_modified ? '#fff3e0' : 'inherit'
      }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <FileIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="h6" noWrap title={displayPath}>
              {displayPath ? displayPath.split('/').pop() : 'Untitled'}
              {isOriginal ? ' (Original)' : ' (Modified)'}
            </Typography>
          </Box>
          
          {/* 파일 경로 표시 */}
          {displayPath && (
            <Typography variant="body2" color="text.secondary" gutterBottom noWrap title={displayPath}>
              📁 {displayPath}
            </Typography>
          )}
          
          <Box mb={2}>
            <Chip
              label={file.file_type?.toUpperCase() || category.toUpperCase()}
              color="primary"
              size="small"
              sx={{ mr: 1 }}
            />
            
            <Chip
              label={isOriginal ? "ORIGINAL" : "MODIFIED"}
              color={isOriginal ? "default" : "warning"}
              size="small"
              sx={{ mr: 1 }}
            />
            
            {file.sha && (
              <Chip
                label={`SHA: ${file.sha.substring(0, 8)}`}
                variant="outlined"
                size="small"
              />
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Last Modified: {file.last_modified || file.modified_at ? new Date(file.last_modified || file.modified_at).toLocaleString() : 'Unknown'}
          </Typography>
          
          <Typography variant="caption" color="text.secondary">
            {isOriginal ? 'Synced' : 'Created'}: {file.synced_at || file.created_at ? new Date(file.synced_at || file.created_at).toLocaleString() : 'Never'}
          </Typography>
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box>
            {file.is_modified && (
              <Tooltip title="Delete Modified File">
                <IconButton
                  size="small"
                  onClick={() => handleDeleteFile(fileId, category)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Button
            component={Link}
            to={`/projects/${projectId}/files/${fileId}/edit`}
            variant="outlined"
            size="small"
          >
            View/Edit
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );};

  const handleResetFiles = async () => {
    if (window.confirm('Are you sure you want to reset all files? This will delete all modified files and keep only the original files.')) {
      try {
        await resetProjectFiles(projectId);
        // Reset 후 목록 새로고침
        await fetchModifiedFiles(projectId);
      } catch (error) {
        // 파일 리셋 실패 시 에러 처리 (콘솔 로그 제거)
      }
    }
  };

  if (loading && !currentProject) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!currentProject) {
    return (
      <Box textAlign="center" py={8}>
        <Typography variant="h6" color="text.secondary">
          Project not found
        </Typography>
        <Button component={Link} to="/projects" sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  // sync status 결정: global 상태가 있으면 우선 사용, 없으면 서버 데이터 기반
  const lastSync = currentProject.project?.last_sync || currentProject.last_sync;
  const serverSyncStatusValue = lastSync ? 'synced' : 'pending';
  const globalSyncState = getProjectSyncState(projectId);
  const finalSyncStatusValue = globalSyncState || serverSyncStatusValue;
  const syncStatus = getSyncStatus(finalSyncStatusValue);
  
  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Button
            component={Link}
            to="/projects"
            startIcon={<ArrowBackIcon />}
            size="small"
          >
            Projects
          </Button>
          <Typography color="text.primary">
            {currentProject.name}
          </Typography>
        </Breadcrumbs>

        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {currentProject.name}
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Chip
                label={syncStatus.label}
                color={syncStatus.color}
                size="small"
              />
              <Box display="flex" alignItems="center">
                <GitHubIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {currentProject.repository_url}
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Last Sync: {formatLastSync(currentProject.project.last_sync)}
            </Typography>
          </Box>

          <Box display="flex" gap={2}>
            <Tooltip title={globalSyncState === 'syncing' ? "Syncing in progress..." : "Sync with repository"}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={handleSync}
                  disabled={globalSyncState === 'syncing'}
                  color={globalSyncState === 'failed' ? 'error' : 'primary'}
                >
                  {globalSyncState === 'syncing' ? 'Syncing...' : 
                   globalSyncState === 'failed' ? 'Sync Failed' : 'Sync'}
                </Button>
              </span>
            </Tooltip>
            
            <Tooltip title="Reset all files to original state">
              <Button
                variant="outlined"
                color="warning"
                startIcon={<RestoreIcon />}
                onClick={handleResetFiles}
                disabled={globalSyncState === 'syncing'}
              >
                Reset Files
              </Button>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* File Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={`Config Files (${files.config?.length || 0})`} 
            id="file-tab-0"
            aria-controls="file-tabpanel-0"
          />
          <Tab 
            label={`Job Files (${files.job?.length || 0})`} 
            id="file-tab-1"
            aria-controls="file-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Config Files Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Config Files</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleCreateFile('config')}
          >
            Create Custom Config
          </Button>
        </Box>

        {files.config?.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No config files found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sync with GitHub or create a custom config file to get started.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {getCombinedFiles('config').map((file) => renderFileCard(file, 'config'))}
          </Grid>
        )}
      </TabPanel>

      {/* Job Files Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Job Files</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleCreateFile('job')}
          >
            Create Custom Job
          </Button>
        </Box>

        {files.job?.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No job files found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sync with GitHub or create a custom job file to get started.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {getCombinedFiles('job').map((file) => renderFileCard(file, 'job'))}
          </Grid>
        )}
      </TabPanel>

      <FileModal
        open={isFileModalOpen}
        onClose={handleCloseFileModal}
        projectId={projectId}
        file={selectedFile}
      />
    </Box>
  );
}

export default ProjectDetailPage; 