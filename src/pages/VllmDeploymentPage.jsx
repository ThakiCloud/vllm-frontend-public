import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  WorkOutline as BenchmarkIcon
} from '@mui/icons-material';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { vllmManagementApi_functions, projectsApi, filesApi } from '../utils/api';

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
          value: "http://VLLM_SERVICE_NAME:8000"
        - name: MODEL_NAME
          value: "MODEL_NAME_PLACEHOLDER"
        command: ['sh', '-c']
        args: ['echo "Starting VLLM evaluation..."; sleep 300']
      restartPolicy: Never
  backoffLimit: 3`;

function VllmDeploymentPage({ onSystemStatusChange }) {
  const [deployments, setDeployments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [configText, setConfigText] = useState(JSON.stringify(defaultVllmConfig, null, 2));
  const [deploymentName, setDeploymentName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Benchmark job related states
  const [createBenchmarkJob, setCreateBenchmarkJob] = useState(false);
  const [benchmarkJobs, setBenchmarkJobs] = useState([{
    id: 1,
    jobText: defaultBenchmarkJob,
    namespace: 'default',
    selectedProject: '',
    jobFiles: [],
    selectedJobFile: '',
    configFiles: [],
    selectedConfigFile: '',
    originalJobYaml: '',
    name: 'benchmark-job-1',
    loadingFiles: false
  }]);
  const [tabValue, setTabValue] = useState(0);
  
  // Project and file selection states for multiple benchmark jobs
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    loadDeployments();
    // Refresh deployments every 30 seconds
    const interval = setInterval(loadDeployments, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (createDialogOpen && createBenchmarkJob) {
      fetchProjects();
    }
  }, [createDialogOpen, createBenchmarkJob]);



  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await vllmManagementApi_functions.listDeployments();
      setDeployments(response.data);
      setError(null);
      
      // Update system status
      if (onSystemStatusChange) {
        const statusResponse = await vllmManagementApi_functions.getSystemStatus();
        onSystemStatusChange(statusResponse.data);
      }
    } catch (err) {
      setError('Failed to load deployments: ' + err.message);
    } finally {
      setLoading(false);
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
      jobText: defaultBenchmarkJob,
      namespace: 'default',
      selectedProject: '',
      jobFiles: [],
      selectedJobFile: '',
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      name: `benchmark-job-${newId}`,
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
        jobText: jobYaml
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
      jobText: defaultBenchmarkJob
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
        jobText: defaultBenchmarkJob,
        originalJobYaml: '',
        configFiles: []
      });
    }
  };

  const handleConfigFileSelect = async (jobId, fileId) => {
    const job = benchmarkJobs.find(j => j.id === jobId);
    if (!job) return;
    
    updateBenchmarkJob(jobId, { selectedConfigFile: fileId });
    
    // Use originalJobYaml if available, otherwise use current jobText
    const baseYaml = job.originalJobYaml || job.jobText;
    
    if (baseYaml) {
      if (fileId) {
        const updatedYaml = await generateYamlWithConfigMap(
          baseYaml, 
          job.selectedProject, 
          fileId
        );
        updateBenchmarkJob(jobId, { jobText: updatedYaml });
      } else {
        updateBenchmarkJob(jobId, { jobText: baseYaml });
      }
    }
  };

  const handleCreateDeployment = async () => {
    try {
      setCreating(true);
      const config = JSON.parse(configText);
      
      // Prepare benchmark configs (can be multiple)
      const benchmarkConfigs = [];
      if (createBenchmarkJob) {
        benchmarkJobs.forEach((job, index) => {
          benchmarkConfigs.push({
            yaml_content: job.jobText,
            namespace: job.namespace,
            project_id: job.selectedProject || null,
            job_file_id: job.selectedJobFile || null,
            config_file_id: job.selectedConfigFile || null,
            name: job.name || `benchmark-job-${index + 1}`
          });
        });
      }
      
      // All deployments go through the queue now
      await vllmManagementApi_functions.addToQueue(
        config,
        benchmarkConfigs, // Always pass array, even if empty
        null, // scheduling config
        'medium',
        false // skipVllmCreation - always create VLLM in this page
      );
      
      setError(null);
      alert('VLLM deployment added to queue successfully!');
      
      // Reset form
      setCreateDialogOpen(false);
      setDeploymentName('');
      setConfigText(JSON.stringify(defaultVllmConfig, null, 2));
      resetBenchmarkJobForm();
      await loadDeployments();
    } catch (err) {
      setError('Failed to create deployment: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const resetBenchmarkJobForm = () => {
    setCreateBenchmarkJob(false);
    setBenchmarkJobs([{
      id: 1,
      jobText: defaultBenchmarkJob,
      namespace: 'default',
      selectedProject: '',
      jobFiles: [],
      selectedJobFile: '',
      configFiles: [],
      selectedConfigFile: '',
      originalJobYaml: '',
      name: 'benchmark-job-1',
      loadingFiles: false
    }]);
    setTabValue(0);
    setProjects([]);
  };



  const handleStopDeployment = async (deploymentId) => {
    try {
      await vllmManagementApi_functions.stopDeployment(deploymentId);
      await loadDeployments();
    } catch (err) {
      setError('Failed to stop deployment: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'success';
      case 'starting': return 'warning';
      case 'stopped': return 'default';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <PlayIcon />;
      case 'starting': return <CircularProgress size={16} />;
      case 'stopped': return <StopIcon />;
      case 'failed': return <DeleteIcon />;
      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          VLLM Deployments
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadDeployments}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Deployment
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {Object.entries(deployments).length === 0 ? (
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No deployments found. Create your first VLLM deployment.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            Object.entries(deployments).map(([deploymentId, deployment]) => (
              <Grid item xs={12} md={6} lg={4} key={deploymentId}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="h3">
                        {deployment.deployment_name}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(deployment.status)}
                        label={deployment.status}
                        color={getStatusColor(deployment.status)}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Model:</strong> {deployment.config?.model_name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>GPU Resource:</strong> {deployment.config?.gpu_resource_type} x {deployment.config?.gpu_resource_count}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Port:</strong> {deployment.config?.port}
                    </Typography>
                    
                    {deployment.pod_name && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Pod:</strong> {deployment.pod_name}
                      </Typography>
                    )}
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Created:</strong> {new Date(deployment.created_at).toLocaleString()}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      {deployment.status === 'running' && (
                        <Tooltip title="Stop Deployment">
                          <IconButton
                            color="error"
                            onClick={() => handleStopDeployment(deploymentId)}
                          >
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Create Deployment Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Create New VLLM Deployment</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Left Column - Basic Configuration */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Deployment Name (optional)"
                value={deploymentName}
                onChange={(e) => setDeploymentName(e.target.value)}
                margin="normal"
                helperText="Leave empty for auto-generated name"
              />
              
              {/* Benchmark Job Switch */}
              <FormControlLabel
                control={
                  <Switch
                    checked={createBenchmarkJob}
                    onChange={(e) => setCreateBenchmarkJob(e.target.checked)}
                    icon={<BenchmarkIcon />}
                    checkedIcon={<BenchmarkIcon />}
                  />
                }
                label="Create Benchmark Job"
                sx={{ mt: 2, mb: 1 }}
              />
              
              {createBenchmarkJob && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    A benchmark evaluation job will be created automatically after VLLM deployment.
                  </Typography>
                </Alert>
              )}

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                VLLM Configuration (JSON)
              </Typography>
              
              <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
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
            </Grid>

            {/* Right Column - Benchmark Job Configuration */}
            <Grid item xs={12} md={6}>
              {createBenchmarkJob ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
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
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            Benchmark Job #{index + 1}
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

                                                 <Grid container spacing={2}>
                           <Grid item xs={12} sm={6}>
                             <TextField
                               fullWidth
                               label="Job Name"
                               value={job.name}
                               onChange={(e) => updateBenchmarkJob(job.id, { name: e.target.value })}
                               size="small"
                             />
                           </Grid>
                           <Grid item xs={12} sm={6}>
                             <TextField
                               fullWidth
                               label="Namespace"
                               value={job.namespace}
                               onChange={(e) => updateBenchmarkJob(job.id, { namespace: e.target.value })}
                               size="small"
                             />
                           </Grid>
                         </Grid>

                         <Grid container spacing={2} sx={{ mt: 1 }}>
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

                         <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                           Job YAML Configuration
                         </Typography>
                        <Box sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
                          <MonacoEditor
                            height="200px"
                            language="yaml"
                            theme="vs-light"
                            value={job.jobText}
                            onChange={(value) => updateBenchmarkJob(job.id, { jobText: value || '' })}
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
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    Enable "Create Benchmark Job" to configure evaluation settings
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            resetBenchmarkJobForm();
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDeployment}
            disabled={creating}
          >
            {creating ? <CircularProgress size={20} /> : 'Add to Queue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default VllmDeploymentPage;