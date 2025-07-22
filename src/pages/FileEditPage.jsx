import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Breadcrumbs,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';
import { filesApi } from '../utils/api';
import { useProjectStore } from '../store/projectStore';

const FileEditPage = () => {
  const { projectId, fileId } = useParams();
  const navigate = useNavigate();
  
  const [fileData, setFileData] = useState(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    currentProject,
    fetchProject,
    fetchModifiedFiles,
    createModifiedFile,
    updateModifiedFile,
    clearError,
  } = useProjectStore();

  useEffect(() => {
    if (projectId && !currentProject) {
      fetchProject(projectId);
    }
  }, [projectId, currentProject, fetchProject]);

  useEffect(() => {
    const loadFile = async () => {
      if (!projectId || !fileId) return;

      try {
        setIsLoading(true);
        setError(null);

        // 파일 ID로 검색 (original 및 modified 파일 모두 검색)
        const response = await filesApi.get(projectId, fileId);
        
        if (!response.data) {
          throw new Error('File not found');
        }

        const { file_type, file } = response.data;
        const isModified = file_type === 'modified';
        
        setFileData({ ...file, is_modified: isModified });

        // 파일 내용 설정
        let fileContent = '';
        if (typeof file.content === 'object') {
          // JSON 객체인 경우
          const fileExtension = file.file_path?.split('.').pop()?.toLowerCase();
          if (fileExtension === 'yaml' || fileExtension === 'yml') {
            fileContent = yaml.dump(file.content, { indent: 2 });
          } else {
            fileContent = JSON.stringify(file.content, null, 2);
          }
        } else {
          fileContent = file.content || '';
        }

        setContent(fileContent);
        setOriginalContent(fileContent);
        setHasChanges(false);
      } catch (error) {
        setError(error.message || 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [projectId, fileId]);

  const handleContentChange = (value) => {
    setContent(value || '');
    setHasChanges(value !== originalContent);
  };

  const formatContent = () => {
    if (!fileData?.file_path) return;

    try {
      const fileExtension = fileData.file_path.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'yaml' || fileExtension === 'yml') {
        // YAML 포맷팅
        const parsed = yaml.load(content);
        const formatted = yaml.dump(parsed, { indent: 2 });
        setContent(formatted);
        setHasChanges(formatted !== originalContent);
      } else {
        // JSON 포맷팅
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        setContent(formatted);
        setHasChanges(formatted !== originalContent);
      }
    } catch (error) {
      const fileExtension = fileData.file_path.split('.').pop()?.toLowerCase();
      const fileType = (fileExtension === 'yaml' || fileExtension === 'yml') ? 'YAML' : 'JSON';
      setError(`Invalid ${fileType} format: ${error.message}`);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (fileData.is_modified) {
        // 이미 수정된 파일인 경우 - 기존 modified file 업데이트
        const updatePayload = {
          project_id: projectId,
          file_path: fileData.file_path,
          content: content,
          modified: true,
          file_type: fileData.file_type
        };
        await updateModifiedFile(fileId, updatePayload);
      } else {
        // 원본 파일인 경우 - 새로운 modified file 생성
        const createPayload = {
          // file_id는 백엔드에서 자동 생성되므로 전달하지 않음
          project_id: projectId,
          file_path: fileData.file_path,
          content: content,
          modified: true,
          file_type: fileData.file_type // 원본 파일의 file_type 사용 (config 또는 job)
        };
        await createModifiedFile(projectId, createPayload);
      }

      setOriginalContent(content);
      setHasChanges(false);
      
      // Modified files 목록 새로고침
      await fetchModifiedFiles(projectId);
      
      navigate(`/projects/${projectId}`);
    } catch (error) {
      const fileExtension = fileData?.file_path?.split('.').pop()?.toLowerCase();
      const fileType = (fileExtension === 'yaml' || fileExtension === 'yml') ? 'YAML' : 'JSON';
      setError(`Failed to save file.. Please check ${fileType} format: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = () => {
    setContent(originalContent);
    setHasChanges(false);
    setError(null);
  };

  const getFileExtension = () => {
    return fileData?.file_path?.split('.').pop()?.toLowerCase() || 'json';
  };

  const getEditorLanguage = () => {
    const extension = getFileExtension();
    if (extension === 'yaml' || extension === 'yml') return 'yaml';
    return 'json';
  };

  const getFormatButtonText = () => {
    const extension = getFileExtension();
    if (extension === 'yaml' || extension === 'yml') return 'Format YAML';
    return 'Format JSON';
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!fileData) {
    return (
      <Box p={3}>
        <Alert severity="error">File not found</Alert>
      </Box>
    );
  }
  
  return (
    <Box p={3}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Button
          component={Link}
          to="/projects"
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Projects
        </Button>
        <Button
          component={Link}
          to={`/projects/${projectId}`}
          size="small"
        >
          {currentProject?.project?.name || 'Project'}
        </Button>
        <Typography color="text.primary">
          Edit {fileData.file_path?.split('/').pop() || 'File'}
          {fileData.is_modified && ' (Modified)'}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {fileData.file_path?.split('/').pop() || 'Untitled File'}
            {fileData.is_modified && (
              <Typography component="span" color="warning.main" sx={{ ml: 1 }}>
                (Modified)
              </Typography>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            📁 {fileData.file_path}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          Back to Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Editor Controls */}
      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="outlined"
          onClick={formatContent}
        >
          {getFormatButtonText()}
        </Button>

        <Tooltip title={hasChanges ? "Restore to original content" : "No changes to restore"}>
          <span>
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={handleRestore}
              disabled={!hasChanges}
            >
              Restore
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={hasChanges ? "Save changes" : "No changes to save"}>
          <span>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Editor */}
      <Paper elevation={1}>
        <Editor
          height="600px"
          language={getEditorLanguage()}
          value={content}
          onChange={handleContentChange}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            automaticLayout: true,
          }}
        />
      </Paper>
    </Box>
  );
};

export default FileEditPage; 