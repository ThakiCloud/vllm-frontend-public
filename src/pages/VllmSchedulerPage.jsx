import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { vllmManagementApi_functions } from '../utils/api';

function VllmSchedulerPage() {
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [pollInterval, setPollInterval] = useState(30);
  const [maxWaitTime, setMaxWaitTime] = useState(3600);

  useEffect(() => {
    loadSchedulerStatus();
    // Refresh status every 10 seconds
    const interval = setInterval(loadSchedulerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadSchedulerStatus = async () => {
    try {
      setLoading(true);
      const response = await vllmManagementApi_functions.getSchedulerStatus();
      setSchedulerStatus(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load scheduler status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulerAction = async (action) => {
    try {
      setActionLoading(true);
      
      switch (action) {
        case 'start':
          await vllmManagementApi_functions.startScheduler();
          break;
        case 'stop':
          await vllmManagementApi_functions.stopScheduler();
          break;
        case 'pause':
          await vllmManagementApi_functions.pauseScheduler();
          break;
        case 'resume':
          await vllmManagementApi_functions.resumeScheduler();
          break;
        default:
          throw new Error('Unknown action');
      }
      
      await loadSchedulerStatus();
    } catch (err) {
      setError(`Failed to ${action} scheduler: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfigUpdate = async () => {
    try {
      setActionLoading(true);
      await vllmManagementApi_functions.updateSchedulerConfig({
        poll_interval: pollInterval,
        max_wait_time: maxWaitTime
      });
      setConfigOpen(false);
      await loadSchedulerStatus();
    } catch (err) {
      setError('Failed to update scheduler config: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'success';
      case 'paused': return 'warning';
      case 'stopped': return 'default';
      default: return 'default';
    }
  };

  const getActionButtons = () => {
    if (!schedulerStatus) return null;

    const status = schedulerStatus.status;
    const buttons = [];

    if (status === 'stopped') {
      buttons.push(
        <Button
          key="start"
          variant="contained"
          color="success"
          startIcon={<PlayIcon />}
          onClick={() => handleSchedulerAction('start')}
          disabled={actionLoading}
        >
          Start Scheduler
        </Button>
      );
    }

    if (status === 'running') {
      buttons.push(
        <Button
          key="pause"
          variant="outlined"
          color="warning"
          startIcon={<PauseIcon />}
          onClick={() => handleSchedulerAction('pause')}
          disabled={actionLoading}
          sx={{ mr: 1 }}
        >
          Pause
        </Button>
      );
      buttons.push(
        <Button
          key="stop"
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={() => handleSchedulerAction('stop')}
          disabled={actionLoading}
        >
          Stop
        </Button>
      );
    }

    if (status === 'paused') {
      buttons.push(
        <Button
          key="resume"
          variant="contained"
          color="primary"
          startIcon={<PlayIcon />}
          onClick={() => handleSchedulerAction('resume')}
          disabled={actionLoading}
          sx={{ mr: 1 }}
        >
          Resume
        </Button>
      );
      buttons.push(
        <Button
          key="stop"
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={() => handleSchedulerAction('stop')}
          disabled={actionLoading}
        >
          Stop
        </Button>
      );
    }

    return buttons;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Scheduler Management
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadSchedulerStatus}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setConfigOpen(!configOpen)}
          >
            Configure
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Scheduler Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scheduler Status
              </Typography>
              {schedulerStatus ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Chip
                      label={schedulerStatus.status}
                      color={getStatusColor(schedulerStatus.status)}
                      sx={{ mr: 2 }}
                    />
                    {actionLoading && <CircularProgress size={20} />}
                  </Box>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Scheduler ID:</strong> {schedulerStatus.scheduler_id}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Last Poll:</strong> {
                      schedulerStatus.last_poll_time 
                        ? new Date(schedulerStatus.last_poll_time).toLocaleString()
                        : 'Never'
                    }
                  </Typography>
                  
                  {schedulerStatus.next_poll_time && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Next Poll:</strong> {new Date(schedulerStatus.next_poll_time).toLocaleString()}
                    </Typography>
                  )}
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Poll Interval:</strong> {schedulerStatus.poll_interval}s
                  </Typography>

                  <Box sx={{ mt: 2 }}>
                    {getActionButtons()}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Scheduler status not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Scheduler Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              {schedulerStatus ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Active Deployments:</strong> {schedulerStatus.active_deployments || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Queue Size:</strong> {schedulerStatus.queue_size || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Total Processed:</strong> {schedulerStatus.total_processed || 0}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Created:</strong> {
                      schedulerStatus.created_at 
                        ? new Date(schedulerStatus.created_at).toLocaleString()
                        : 'Unknown'
                    }
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Last Updated:</strong> {
                      schedulerStatus.updated_at 
                        ? new Date(schedulerStatus.updated_at).toLocaleString()
                        : 'Unknown'
                    }
                  </Typography>

                  {schedulerStatus.last_error && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Last Error:</strong> {schedulerStatus.last_error}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Statistics not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Configuration Panel */}
        {configOpen && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Scheduler Configuration
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Poll Interval (seconds)"
                      value={pollInterval}
                      onChange={(e) => setPollInterval(parseInt(e.target.value) || 30)}
                      helperText="How often the scheduler checks for new queue items"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Wait Time (seconds)"
                      value={maxWaitTime}
                      onChange={(e) => setMaxWaitTime(parseInt(e.target.value) || 3600)}
                      helperText="Maximum time to wait for a deployment to complete"
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleConfigUpdate}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <CircularProgress size={20} /> : 'Update Configuration'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setConfigOpen(false)}
                  >
                    Cancel
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default VllmSchedulerPage;