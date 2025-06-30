# 🚀 VLLM Benchmark Manager

> Modern React frontend for managing GitHub repository benchmark configuration files

![React](https://img.shields.io/badge/React-18.x-blue?logo=react)
![Material-UI](https://img.shields.io/badge/Material--UI-5.x-blue?logo=mui)
![Create React App](https://img.shields.io/badge/Create%20React%20App-5.x-09D3AC?logo=createreactapp)
![Monaco Editor](https://img.shields.io/badge/Monaco-Editor-blue?logo=microsoft)

## ✨ Features

### 📊 Triple Dashboard System
- **Benchmark Results Dashboard**: View and analyze model benchmark results with Material-UI components
- **Project Manager**: Manage GitHub repository benchmark configurations with modern UI
- **Benchmark Deployer**: Deploy and manage Kubernetes benchmark jobs with real-time terminal access

### 🔗 GitHub Integration
- **Repository Sync**: Automatic synchronization with GitHub repositories
- **File Management**: Edit and manage config/job files directly with Monaco Editor
- **Real-time Updates**: Auto-sync with configurable polling intervals

### 📝 Advanced File Editor
- **Monaco Editor**: VSCode-like editing experience with syntax highlighting
- **JSON Validation**: Real-time JSON syntax validation and formatting
- **File Comparison**: Side-by-side comparison of original vs modified content
- **Custom Files**: Create custom configuration files based on originals

### 🚀 Kubernetes Integration
- **YAML Deployment**: Deploy Kubernetes Jobs, Deployments, Services via web UI
- **Real-time Terminal**: WebSocket-based terminal access to running pods
- **Log Streaming**: Real-time log viewing and download capabilities
- **Session Management**: Multi-session terminal support with automatic cleanup

### 🎨 Modern UI/UX
- **Material Design**: Clean and intuitive Material-UI v5 components
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Unified Theme**: Consistent design across all pages
- **Real-time Status**: Live sync status indicators and progress feedback

## 🏗️ Architecture

```
src/
├── components/           # Reusable UI components
│   ├── Layout.jsx       # Main layout with Material-UI sidebar
│   ├── ProjectModal.jsx # Project creation/edit modal
│   ├── FileModal.jsx    # File creation/edit modal
│   └── BenchmarkResults.jsx # Benchmark results display
├── pages/               # Page components  
│   ├── ProjectListPage.jsx    # Project listing with Material-UI cards
│   ├── ProjectDetailPage.jsx  # Project details with tabs
│   ├── FileEditPage.jsx       # Monaco editor for file editing
│   ├── DeployerListPage.jsx   # Kubernetes deployment listing
│   └── DeployerDetailPage.jsx # Deployment details with terminal
├── store/               # State management
│   └── projectStore.js  # Zustand store for project data
├── utils/               # Utilities
│   └── api.js          # Separated API clients
├── DashboardPage.jsx    # Material-UI benchmark results dashboard
├── DetailPage.jsx       # Material-UI result details page
└── App.jsx             # Main app with Material-UI theme
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Backend APIs:
  - Benchmark Results API on `http://localhost:8000` (for benchmark data)
  - Project Management API on `http://localhost:8001` (for GitHub integration)
  - Benchmark Deployer API on `http://localhost:8002` (for Kubernetes deployment)
- Kubernetes cluster access (for deployment features)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd vllm-benchmark-manager

# Install dependencies
npm install

# Copy environment file and configure
cp env.sample .env
# Edit .env file with your API URLs

# Start development server
npm start
```

### Development
```bash
# Start development server (http://localhost:3000)
npm start

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## 📋 API Integration

The frontend uses **separated API clients** for different purposes:

### Benchmark Results API (기존)
```javascript
// Uses relative paths or configured base URL
GET /standardized_output        # List benchmark results
GET /standardized_output/{pk}   # Get specific result
GET /raw_input/{pk}            # Get raw JSON data
```

### Project Management API (신규)
```javascript
// Uses http://localhost:8001 or configured URL
GET    /projects/              # List all projects
POST   /projects/              # Create new project
GET    /projects/{id}/         # Get project details
PUT    /projects/{id}/         # Update project
DELETE /projects/{id}/         # Delete project
POST   /projects/{id}/sync/    # Sync with GitHub

GET    /projects/{id}/files/?category={config|job}  # List files
GET    /projects/{id}/files/{file_id}/              # Get file content
POST   /projects/{id}/files/                        # Create custom file
PUT    /projects/{id}/files/{file_id}/              # Update file
DELETE /projects/{id}/files/{file_id}/              # Delete file
```

### Benchmark Deployer API (신규)
```javascript
// Uses http://localhost:8002 or configured URL
POST   /deploy                 # Deploy YAML to Kubernetes
POST   /delete                 # Delete Kubernetes resources  
GET    /deployments            # List active deployments
GET    /health                 # Service health check

GET    /jobs/{name}/status     # Get job status
GET    /jobs/{name}/logs       # Get job logs
POST   /jobs/{name}/terminal   # Create terminal session
WS     /terminal/{session_id}  # WebSocket terminal connection
GET    /terminal/sessions      # List terminal sessions
DELETE /terminal/{session_id}  # Stop terminal session
```

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in the root directory:
```env
# Benchmark Results API (기존 벤치마크 결과용)
VITE_BENCHMARK_API_BASE_URL=

# Project Management API (신규 프로젝트 관리용)  
VITE_PROJECT_API_BASE_URL=http://localhost:8000

# Application Settings
VITE_APP_TITLE=VLLM Benchmark Manager
```

### API Configuration
The API clients are separated in `src/utils/api.js`:
- **benchmarkApi**: For existing benchmark results (relative paths)
- **projectApi**: For new project management features (separate server)

## 📱 Usage

### Benchmark Results (기존 기능 - Material-UI로 업그레이드)
1. **Dashboard View**: Material-UI cards showing summary statistics
2. **Advanced Filtering**: Material-UI select components for filtering
3. **Results Table**: Material-UI table with chips and enhanced styling
4. **Detail View**: Improved layout with breadcrumbs and better organization

### Project Management (신규 기능)
1. **Create Project**: Material-UI modal with form validation
2. **Sync Repository**: Real-time status indicators
3. **File Management**: Tabs for config/job files with Material-UI cards
4. **Monaco Editor**: Full-featured code editor with JSON support

### Benchmark Deployer (신규 기능)
1. **YAML Deployment**: Deploy Kubernetes resources with web-based YAML editor
2. **Real-time Terminal**: WebSocket-based terminal access to running pods
3. **Log Management**: View, stream, and download container logs
4. **Session Control**: Manage multiple terminal sessions with auto-cleanup

## 🎯 Key Improvements

### UI/UX Unification
- **Material-UI v5**: All components now use consistent Material Design
- **Responsive Layout**: Mobile-first design with proper breakpoints
- **Theme Integration**: Unified color scheme and typography
- **Loading States**: Consistent loading indicators and error handling

### API Separation
- **Backward Compatibility**: Existing benchmark API unchanged
- **New Features**: Separate API for project management
- **Environment Config**: Easy configuration via environment variables
- **Error Handling**: Improved error handling for both APIs

### Performance
- **Create React App**: Standard React build process
- **Code Splitting**: Automatic code splitting for better performance
- **Optimized Builds**: Production-ready builds with minification

## 🔧 Development

### Tech Stack
- **Frontend Framework**: React 18 with Create React App
- **Routing**: React Router v6
- **State Management**: Zustand
- **UI Library**: Material-UI v5
- **Code Editor**: Monaco Editor (VSCode editor)
- **Build Tool**: Create React App (Webpack)
- **HTTP Client**: Axios with separated clients

### Code Organization
- **Component Hierarchy**: Clear separation between pages and components
- **API Clients**: Separated by functionality (benchmark vs project)
- **State Management**: Zustand stores for different domains
- **Styling**: Material-UI sx prop and theme system

## 🐳 Deployment

### Docker Support
```dockerfile
# Multi-stage build with Create React App
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build Output
- **Build Directory**: `build/` (Create React App standard)
- **Static Assets**: Properly optimized and minified
- **Service Worker**: Built-in PWA support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [VLLM Backend API](../backend) - Backend API for benchmark management
- [VLLM Evaluation Pipeline](../evaluation) - Benchmark execution pipeline 