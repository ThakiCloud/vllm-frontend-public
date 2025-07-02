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
} from '@mui/material';
import { useProjectStore } from '../store/projectStore';
import { convertGitHubUrl } from '../utils/api';

function ProjectModal({ open, onClose, project = null }) {
  const [formData, setFormData] = useState({
    name: '',
    repository_url: '',
    github_token: '',
    config_path: 'config/',
    job_path: 'job/',
    polling_interval: 86400,
  });
  const [errors, setErrors] = useState({});
  
  const { createProject, updateProject, loading, error } = useProjectStore();

  const isEditing = Boolean(project);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        repository_url: project.repository_url || '',
        github_token: project.github_token || '',
        config_path: project.config_path || 'config/',
        job_path: project.job_path || 'job/',
        polling_interval: project.polling_interval || 300,
      });
    } else {
      setFormData({
        name: '',
        repository_url: '',
        github_token: '',
        config_path: 'config/',
        job_path: 'job/',
        polling_interval: 300,
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
    
    if (!formData.repository_url.trim()) {
      newErrors.repository_url = 'Repository URL is required';
    } else {
      // GitHub URL validation - 더 유연하게 변경
      const githubPattern = /github\.com\/[\w.-]+\/[\w.-]+/;
      const cleanUrl = formData.repository_url.replace(/^@/, '').replace(/\.git$/, '');
      if (!githubPattern.test(cleanUrl)) {
        newErrors.repository_url = 'Please enter a valid GitHub repository URL';
      }
    }
    
    if (!formData.github_token.trim()) {
      newErrors.github_token = 'GitHub token is required';
    }
    
    if (!formData.config_path.trim()) {
      newErrors.config_path = 'Config path is required';
    }
    
    if (!formData.job_path.trim()) {
      newErrors.job_path = 'Job path is required';
    }
    
    if (formData.polling_interval < 60) {
      newErrors.polling_interval = 'Polling interval must be at least 60 seconds';
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
      
      if (isEditing) {
        await updateProject(project.project_id, convertedData);
      } else {
        await createProject(convertedData);
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
      repository_url: '',
      github_token: '',
      config_path: 'config/',
      job_path: 'job/',
      polling_interval: 300,
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
          
          <TextField
            name="repository_url"
            label="GitHub Repository URL"
            value={formData.repository_url}
            onChange={handleChange}
            error={Boolean(errors.repository_url)}
            helperText={errors.repository_url || 'Supports: @https://github.com/user/repo.git, https://github.com/user/repo, user/repo'}
            fullWidth
            required
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
            required
          />
          
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
          
          <TextField
            name="polling_interval"
            label="Polling Interval (seconds)"
            type="number"
            value={formData.polling_interval}
            onChange={handleChange}
            error={Boolean(errors.polling_interval)}
            helperText={errors.polling_interval || 'How often to check for updates (minimum 60 seconds)'}
            fullWidth
            inputProps={{ min: 60 }}
          />
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