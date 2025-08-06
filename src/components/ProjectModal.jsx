import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { useProjectStore } from '../store/projectStore';
import { convertGitHubUrl } from '../utils/api';

function ProjectModal({ open, onClose, project = null }) {
  const [formData, setFormData] = useState({
    name: '',
    project_type: 'benchmark',
    repository_url: '',
    github_token: '',
    config_path: 'config/',
    job_path: 'job/',
    vllm_values_path: '',
  });
  const [errors, setErrors] = useState({});
  
  const { createProject, updateProject, loading, error } = useProjectStore();

  const isEditing = Boolean(project);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        project_type: project.project_type || 'benchmark',
        repository_url: project.repository_url || '',
        github_token: project.github_token || '',
        config_path: project.config_path || 'config/',
        job_path: project.job_path || 'job/',
        vllm_values_path: project.vllm_values_path || '',
      });
    } else {
      setFormData({
        name: '',
        project_type: 'benchmark',
        repository_url: '',
        github_token: '',
        config_path: 'config/',
        job_path: 'job/',
        vllm_values_path: '',
      });
    }
    setErrors({});
  }, [project, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (formData.repository_url.trim()) {
      const githubPattern = /github\.com\/[\w.-]+\/[\w.-]+/;
      const cleanUrl = formData.repository_url.replace(/^@/, '').replace(/\.git$/, '');
      if (!githubPattern.test(cleanUrl)) {
        newErrors.repository_url = 'Please enter a valid GitHub repository URL';
      }
    }
    
    if (formData.project_type === 'benchmark') {
      if (!formData.config_path.trim()) {
        newErrors.config_path = 'Config path is required';
      }
      
      if (!formData.job_path.trim()) {
        newErrors.job_path = 'Job path is required';
      }
    } else if (formData.project_type === 'vllm') {
      if (!formData.vllm_values_path.trim()) {
        newErrors.vllm_values_path = 'VLLM values path is required';
      }
    }
    

    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // GitHub URL을 API URL로 변환
      const convertedData = {
        ...formData,
        repository_url: convertGitHubUrl(formData.repository_url),
      };
      
      console.log('Original form data:', formData);
      console.log('Converted project data:', convertedData);
      console.log('Project type being sent:', convertedData.project_type);
      
      if (isEditing) {
        console.log('Updating project...');
        await updateProject(project.project_id, convertedData);
      } else {
        console.log('Creating new project...');
        const result = await createProject(convertedData);
        console.log('Project creation result:', result);
      }
      
      // 성공 시에만 모달 닫기
      onClose();
    } catch (error) {
      
      if (isEditing) {
        // failed 상태를 사용자가 볼 수 있도록 잠깐 후 모달 닫기
        setTimeout(() => {
          onClose();
        }, 1000);
      }
      // 생성 시 에러는 모달을 유지하여 에러 메시지 표시
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      project_type: 'benchmark',
      repository_url: '',
      github_token: '',
      config_path: 'config/',
      job_path: 'job/',
      vllm_values_path: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        {isEditing ? 'Edit Project' : 'Create New Project'}
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            name="name"
            label="Project Name"
            value={formData.name}
            onChange={handleChange}
            error={Boolean(errors.name)}
            helperText={errors.name}
            fullWidth
            required
          />

          <FormControl fullWidth required>
            <InputLabel>Project Type</InputLabel>
            <Select
              name="project_type"
              value={formData.project_type}
              onChange={handleChange}
              label="Project Type"
              error={Boolean(errors.project_type)}
            >
              <MenuItem value="benchmark">Benchmark</MenuItem>
              <MenuItem value="vllm">VLLM</MenuItem>
            </Select>
            <FormHelperText error={Boolean(errors.project_type)}>
              {errors.project_type || 'Select the type of project to manage'}
            </FormHelperText>
          </FormControl>
          
          <TextField
            name="repository_url"
            label="GitHub Repository URL"
            value={formData.repository_url}
            onChange={handleChange}
            error={Boolean(errors.repository_url)}
            helperText={errors.repository_url || 'Supports: @https://github.com/user/repo.git, https://github.com/user/repo, user/repo'}
            fullWidth
            placeholder="@https://github.com/username/repository.git"
          />
          
          <TextField
            name="github_token"
            label="GitHub Token"
            type="password"
            value={formData.github_token}
            onChange={handleChange}
            error={Boolean(errors.github_token)}
            helperText={errors.github_token || 'Personal access token with repo permissions'}
            fullWidth
          />
          
          {formData.project_type === 'benchmark' && (
            <>
              <TextField
                name="config_path"
                label="Config Path"
                value={formData.config_path}
                onChange={handleChange}
                error={Boolean(errors.config_path)}
                helperText={errors.config_path || 'Path to config files in the repository'}
                fullWidth
                required
              />
              
              <TextField
                name="job_path"
                label="Job Path"
                value={formData.job_path}
                onChange={handleChange}
                error={Boolean(errors.job_path)}
                helperText={errors.job_path || 'Path to job files in the repository'}
                fullWidth
                required
              />
            </>
          )}

          {formData.project_type === 'vllm' && (
            <TextField
              name="vllm_values_path"
              label="VLLM Values Path"
              value={formData.vllm_values_path}
              onChange={handleChange}
              error={Boolean(errors.vllm_values_path)}
              helperText={errors.vllm_values_path || 'Path to custom-values*.yaml files in the repository (e.g., charts/)'}
              fullWidth
              required
              placeholder="charts/"
            />
          )}

        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {isEditing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectModal; 