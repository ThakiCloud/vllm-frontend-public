import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import yaml from 'js-yaml';
import { useProjectStore } from '../store/projectStore';

function FileModal({ open, onClose, projectId, file = null }) {
  const [formData, setFormData] = useState({
    file_path: '',
    file_type: 'config',
    content: '{}',
  });
  const [errors, setErrors] = useState({});
  const [availableFiles, setAvailableFiles] = useState([]);
  
  const { files, createFile, updateFile, loading, error } = useProjectStore();

  const isEditing = Boolean(file?.file_id);

  // 파일 확장자에 따른 초기 콘텐츠 생성
  const getInitialContent = (filePath) => {
    if (!filePath) return '{}';
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === 'yaml' || extension === 'yml') {
      return 'name: "example"\nversion: "1.0.0"\ndescription: "Example YAML configuration"';
    }
    return '{\n  "name": "example",\n  "version": "1.0.0",\n  "description": "Example JSON configuration"\n}';
  };

  // 파일 형식 감지
  const getFileFormat = (filePath) => {
    if (!filePath) return 'json';
    const extension = filePath.split('.').pop()?.toLowerCase();
    return (extension === 'yaml' || extension === 'yml') ? 'yaml' : 'json';
  };

  useEffect(() => {
    if (file) {
      if (file.file_id) {
        // Editing existing file
        let fileContent = '';
        if (typeof file.content === 'object') {
          const fileExtension = file.file_path?.split('.').pop()?.toLowerCase();
          if (fileExtension === 'yaml' || fileExtension === 'yml') {
            fileContent = yaml.dump(file.content, { indent: 2 });
          } else {
            fileContent = JSON.stringify(file.content, null, 2);
          }
        } else {
          fileContent = file.content || getInitialContent(file.file_path);
        }

        setFormData({
          file_path: file.file_path || '',
          file_type: file.file_type || 'config',
          content: fileContent,
        });
      } else {
        // Creating new file with preset category
        const fileType = file.file_type || file.category || 'config';
        const defaultExtension = fileType === 'job' ? 'yaml' : 'json';
        const initialPath = `${fileType}/example.${defaultExtension}`;
        setFormData({
          file_path: initialPath,
          file_type: fileType,
          content: getInitialContent(initialPath),
        });
      }
    } else {
      const initialPath = 'config/example.json';
      setFormData({
        file_path: initialPath,
        file_type: 'config',
        content: getInitialContent(initialPath),
      });
    }
    setErrors({});
  }, [file, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value,
      };
      
      // 파일 경로가 변경되면 콘텐츠도 형식에 맞게 업데이트
      if (name === 'file_path' && !isEditing) {
        const currentFormat = getFileFormat(prev.file_path);
        const newFormat = getFileFormat(value);
        
        if (currentFormat !== newFormat) {
          newData.content = getInitialContent(value);
        }
      }
      
      // 파일 타입이 변경되면 경로와 콘텐츠도 업데이트
      if (name === 'file_type' && !isEditing) {
        const defaultExtension = value === 'job' ? 'yaml' : 'json';
        const newPath = `${value}/example.${defaultExtension}`;
        newData.file_path = newPath;
        newData.content = getInitialContent(newPath);
      }
      
      return newData;
    });
    
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
    
    if (!formData.file_path.trim()) {
      newErrors.file_path = 'File path is required';
    } else if (!/\.(json|yaml|yml)$/.test(formData.file_path)) {
      newErrors.file_path = 'File must be a JSON or YAML (e.g., config.json, job.yaml)';
    }
    
    if (!formData.file_type) {
      newErrors.file_type = 'File type is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else {
      const fileFormat = getFileFormat(formData.file_path);
      try {
        if (fileFormat === 'yaml') {
          yaml.load(formData.content);
        } else {
          JSON.parse(formData.content);
        }
      } catch (e) {
        newErrors.content = `Content must be valid ${fileFormat.toUpperCase()}: ${e.message}`;
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
      // 백엔드는 content를 문자열로 기대하므로 원본 문자열을 그대로 전송
      const fileData = {
        file_path: formData.file_path,
        file_type: formData.file_type,
        content: formData.content, // 원본 문자열을 그대로 전송
      };

      if (isEditing) {
        await updateFile(projectId, file.file_id, fileData);
      } else {
        await createFile(projectId, fileData);
      }
      onClose();
    } catch (error) {
      // 에러 발생 시 사용자에게 알림 (콘솔 로그 제거)
    }
  };

  const handleClose = () => {
    const initialPath = 'config/example.json';
    setFormData({
      file_path: initialPath,
      file_type: 'config',
      content: getInitialContent(initialPath),
    });
    setErrors({});
    onClose();
  };

  const formatContent = () => {
    const fileFormat = getFileFormat(formData.file_path);
    try {
      if (fileFormat === 'yaml') {
        const parsed = yaml.load(formData.content);
        const formatted = yaml.dump(parsed, { indent: 2 });
        setFormData(prev => ({
          ...prev,
          content: formatted,
        }));
      } else {
        const parsed = JSON.parse(formData.content);
        const formatted = JSON.stringify(parsed, null, 2);
        setFormData(prev => ({
          ...prev,
          content: formatted,
        }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        content: `Invalid ${fileFormat.toUpperCase()} format: ${error.message}`,
      }));
    }
  };

  const getContentLabel = () => {
    const fileFormat = getFileFormat(formData.file_path);
    return `Content (${fileFormat.toUpperCase()})`;
  };

  const getFormatButtonText = () => {
    const fileFormat = getFileFormat(formData.file_path);
    return `Format ${fileFormat.toUpperCase()}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        {isEditing ? 'Edit File' : 'Create New File'}
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                      <TextField
            name="file_path"
            label="File Path"
            value={formData.file_path}
            onChange={handleChange}
            error={Boolean(errors.file_path)}
            helperText={errors.file_path || 'e.g., config/my-config.json, job/benchmark.yaml'}
            fullWidth
            required
            disabled={isEditing}
            placeholder="config/my-config.json"
          />
          
          <FormControl fullWidth required disabled={isEditing}>
            <InputLabel>File Type</InputLabel>
            <Select
              name="file_type"
              value={formData.file_type}
              onChange={handleChange}
              error={Boolean(errors.file_type)}
              label="File Type"
            >
              <MenuItem value="config">Config</MenuItem>
              <MenuItem value="job">Job</MenuItem>
            </Select>
          </FormControl>
          
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <label htmlFor="content-editor">{getContentLabel()}</label>
              <Button
                size="small"
                onClick={formatContent}
                variant="outlined"
              >
                {getFormatButtonText()}
              </Button>
            </Box>
            <TextField
              id="content-editor"
              name="content"
              multiline
              rows={12}
              value={formData.content}
              onChange={handleChange}
              error={Boolean(errors.content)}
              helperText={errors.content}
              fullWidth
              required
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                },
              }}
            />
          </Box>
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

export default FileModal; 