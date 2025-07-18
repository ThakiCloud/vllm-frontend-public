import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import Layout from './components/Layout';
import DashboardPage from './DashboardPage';
import DetailPage from './DetailPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import FileEditPage from './pages/FileEditPage';
import DeployerListPage from './pages/DeployerListPage';
import DeployerDetailPage from './pages/DeployerDetailPage';
import ModelServingPage from './pages/ModelServingPage';
import './App.css';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            {/* Benchmark Results Routes */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/results/:pk" element={<DetailPage />} />
            
            {/* Project Manager Routes */}
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/projects/:projectId/files/:fileId/edit" element={<FileEditPage />} />
            
            {/* Deployer Routes */}
            <Route path="/deployer" element={<DeployerListPage />} />
            <Route path="/deployer/:jobName" element={<DeployerDetailPage />} />
            <Route path="/deployer/:jobName/terminal" element={<DeployerDetailPage terminal={true} />} />
            
            {/* Model Serving Routes */}
            <Route path="/models" element={<ModelServingPage />} />
            
            {/* Settings Route (placeholder) */}
            <Route path="/settings" element={
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h2>Settings</h2>
                <p>Settings page coming soon...</p>
              </div>
            } />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App; 