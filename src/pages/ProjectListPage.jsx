import { useState, useEffect } from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Box,
  Fab,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Sync as SyncIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import ProjectModal from '../components/ProjectModal';

function ProjectListPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  
  const {
    projects,
    loading,
    error,
    fetchProjects,
    deleteProject,
    syncProject,
    clearError,
    projectSyncStates,
    setProjectSyncState,
    clearProjectSyncState,
    getProjectSyncState,
  } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSync = async (projectId) => {
    try {
      await syncProject(projectId);
      // sync 상태 관리는 이제 store에서 자동으로 처리됨
    } catch (error) {
      // 에러 처리도 store에서 자동으로 처리됨
    }
  };

  const handleDelete = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await deleteProject(projectId);
      } catch (error) {
        // 삭제 실패 시 에러 처리 (콘솔 로그 제거)
      }
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  // ProjectModal 콜백 함수들은 더 이상 필요 없음 (store에서 자동 처리)

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

  if (loading && projects.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Benchmark Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsModalOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects found
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first project to get started with benchmark management.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Create Project
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => {
            // sync status 결정: 로컬 상태가 있으면 우선 사용, 없으면 서버 데이터 기반
            const lastSync = project.last_sync;
            const serverSyncStatusValue = lastSync ? 'synced' : 'pending';
            const localSyncState = projectSyncStates[project.project_id];
            const finalSyncStatusValue = localSyncState || serverSyncStatusValue;
            const syncStatus = getSyncStatus(finalSyncStatusValue);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={project.project_id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h2" noWrap>
                        {project.name}
                      </Typography>
                      <Chip
                        label={syncStatus.label}
                        color={syncStatus.color}
                        size="small"
                      />
                    </Box>

                    <Box display="flex" alignItems="center" mb={1}>
                      <GitHubIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        noWrap
                        sx={{ flex: 1 }}
                      >
                        {project.repository_url}
                      </Typography>
                    </Box>

                    <Box mb={1}>
                      <Chip
                        label={project.project_type || 'benchmark'}
                        color={project.project_type === 'vllm' ? 'secondary' : 'primary'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    </Box>

                    {project.project_type === 'vllm' ? (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Values Path: {project.vllm_values_path || 'charts/'}
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Config Path: {project.config_path || 'config/'}
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Job Path: {project.job_path || 'job/'}
                        </Typography>
                      </>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      Last Sync: {formatLastSync(project.last_sync)}
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Box>
                      <Tooltip title={
                        localSyncState === 'syncing' ? "Syncing in progress..." : 
                        localSyncState === 'failed' ? "Sync failed - click to retry" : 
                        "Sync with GitHub"
                      }>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleSync(project.project_id)}
                            disabled={localSyncState === 'syncing'}
                            color={localSyncState === 'failed' ? 'error' : 'default'}
                          >
                            <SyncIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      
                      <Tooltip title="Edit Project">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(project)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Delete Project">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(project.project_id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Button
                      component={Link}
                      to={`/projects/${project.project_id}`}
                      variant="contained"
                      size="small"
                    >
                      View Files
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <ProjectModal
        open={isModalOpen}
        onClose={handleCloseModal}
        project={editingProject}
      />

      {loading && (
        <Box
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={9999}
        >
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}

export default ProjectListPage; 