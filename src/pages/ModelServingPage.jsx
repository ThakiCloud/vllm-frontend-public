import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Skeleton
} from '@mui/material';
import { Memory as ModelIcon, Speed as SpeedIcon, Schedule as TimeIcon } from '@mui/icons-material';
import { vllmApiGateway_functions } from '../utils/api';

function ModelServingPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vllmApiGateway_functions.getModelList();
      setModels(response.data.data || []);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError(err.response?.data?.message || err.message || '모델 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatModelName = (modelId) => {
    // 긴 모델 경로에서 마지막 부분만 추출
    const parts = modelId.split('/');
    return parts[parts.length - 1];
  };

  const formatCreatedTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString('ko-KR');
  };

  const formatModelPath = (modelId) => {
    // 전체 경로 표시
    return modelId;
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Model Serving
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          VLLM에서 현재 서빙 중인 모델 목록
        </Typography>
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} md={4} key={item}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="40%" height={24} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Model Serving
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Model Serving
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        VLLM에서 현재 서빙 중인 모델 목록 ({models.length}개)
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ModelIcon color="primary" />
                <Typography variant="h6">{models.length}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                활성 모델
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <SpeedIcon color="success" />
                <Typography variant="h6">
                  {models.reduce((sum, model) => sum + (model.max_model_len || 0), 0).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                총 컨텍스트 길이
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <TimeIcon color="info" />
                <Typography variant="h6">VLLM</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                서빙 엔진
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Models Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>모델명</strong></TableCell>
                <TableCell><strong>경로</strong></TableCell>
                <TableCell><strong>소유자</strong></TableCell>
                <TableCell><strong>최대 컨텍스트</strong></TableCell>
                <TableCell><strong>생성 시간</strong></TableCell>
                <TableCell><strong>상태</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      서빙 중인 모델이 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                models.map((model, index) => (
                  <TableRow key={model.id || index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatModelName(model.id)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {formatModelPath(model.id)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={model.owned_by || 'vllm'} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {model.max_model_len ? model.max_model_len.toLocaleString() : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatCreatedTime(model.created)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label="활성" size="small" color="success" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default ModelServingPage; 