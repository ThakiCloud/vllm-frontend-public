import { create } from 'zustand';
import { projectsApi, filesApi, modifiedFilesApi } from '../utils/api';

export const useProjectStore = create((set, get) => ({
  // State
  projects: [],
  currentProject: null,
  files: {
    config: [],
    job: [],
    vllm: [],
    modified: [],
  },
  loading: false,
  error: null,
  // Global sync states for sharing between pages
  projectSyncStates: {}, // { projectId: 'syncing' | 'synced' | 'failed' | 'pending' }

  // Actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Sync state management
  setProjectSyncState: (projectId, state) => set((store) => ({
    projectSyncStates: {
      ...store.projectSyncStates,
      [projectId]: state
    }
  })),
  
  clearProjectSyncState: (projectId) => set((store) => {
    const newStates = { ...store.projectSyncStates };
    delete newStates[projectId];
    return { projectSyncStates: newStates };
  }),

  getProjectSyncState: (projectId) => {
    const store = get();
    return store.projectSyncStates[projectId] || null;
  },

  // Project actions
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await projectsApi.list();
      set({ projects: response.data, loading: false });
      
      // 백그라운드에서 각 프로젝트의 sync 상태 검증
      get().validateProjectSyncStates(response.data);
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // 각 프로젝트의 sync 상태를 백그라운드에서 검증
  validateProjectSyncStates: async (projects) => {
    for (const project of projects) {
      // 이미 failed 상태인 프로젝트는 건너뛰기
      const currentSyncState = get().getProjectSyncState(project.project_id);
      if (currentSyncState === 'failed') {
        continue;
      }
      
      try {
        // 각 프로젝트에 대해 sync 시도 (실제로는 상태만 확인)
        const syncResponse = await projectsApi.sync(project.project_id);
        const syncedFilesCount = syncResponse.data?.synced_files || 0;
        
        if (syncedFilesCount === 0) {
          // 동기화된 파일이 없으면 failed로 설정
          get().setProjectSyncState(project.project_id, 'failed');
        } else {
          // 성공적으로 동기화된 경우, 기존 상태 유지 (pending -> synced로 자연스럽게)
          get().clearProjectSyncState(project.project_id);
        }
      } catch (error) {
        // sync 실패 시 failed 상태로 설정
        get().setProjectSyncState(project.project_id, 'failed');
      }
      
      // 서버 부하 방지를 위해 각 요청 간 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await projectsApi.get(id);
      set({ currentProject: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createProject: async (projectData) => {
    set({ loading: true, error: null });
    try {
      const response = await projectsApi.create(projectData);
      set((state) => ({
        projects: [...state.projects, response.data],
        loading: false,
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProject: async (id, projectData) => {
    set({ loading: true, error: null });
    try {
      // Global sync state: syncing
      get().setProjectSyncState(id, 'syncing');
      
      // 1. 프로젝트 정보 업데이트
      const response = await projectsApi.update(id, projectData);
      
      // 2. 업데이트 후 자동으로 sync 수행 (변경된 Git repo에서 최신 파일 가져오기)
      const syncResponse = await projectsApi.sync(id);
      
      // 백엔드에서 동기화된 파일 개수 확인
      const syncedFilesCount = syncResponse.data?.synced_files || 0;
      
      // 동기화된 파일이 없으면 실패로 처리 (프로젝트 정보 새로고침 전에 체크)
      if (syncedFilesCount === 0) {
        throw new Error('Repository sync failed: No files found in the repository. Please check if the repository URL is correct and accessible.');
      }
      
      // 3. 성공한 경우에만 프로젝트 목록과 현재 프로젝트 정보 새로고침
      await get().fetchProjects();
      if (get().currentProject?.project_id === id) {
        await get().fetchProject(id);
        
        // 4. 파일 목록도 새로고침 (Git repo 변경사항 반영)
        await get().fetchFiles(id, 'config');
        await get().fetchFiles(id, 'job');
        await get().fetchModifiedFiles(id);
      }
      // Global sync state: synced
      get().setProjectSyncState(id, 'synced');
      
      // 3초 후 상태 초기화
      setTimeout(() => {
        get().clearProjectSyncState(id);
      }, 3000);

      set({ loading: false });
      return response.data;
    } catch (error) {
      // 실패 시에는 프로젝트 정보를 새로고침하지 않음 (서버 상태가 바뀌는 것을 방지)
      
      // Global sync state: failed
      get().setProjectSyncState(id, 'failed');
      
      // failed 상태는 자동으로 지우지 않음 (사용자가 수동으로 재시도할 때까지 유지)
      
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null });
    try {
      await projectsApi.delete(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.project_id !== id),
        currentProject: state.currentProject?.project_id === id ? null : state.currentProject,
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  syncProject: async (id) => {
    set({ loading: true, error: null });
    try {
      // Global sync state: syncing
      get().setProjectSyncState(id, 'syncing');
      
      const response = await projectsApi.sync(id);
      
      // 백엔드에서 동기화된 파일 개수 확인 (updateProject와 동일한 검증)
      const syncedFilesCount = response.data?.synced_files || 0;
      
      // 동기화된 파일이 없으면 실패로 처리
      if (syncedFilesCount === 0) {
        throw new Error('Repository sync failed: No files found in the repository. Please check if the repository URL is correct and accessible.');
      }
      
      // 성공한 경우에만 프로젝트 정보 새로고침
      await get().fetchProjects();
      if (get().currentProject?.project_id === id) {
        await get().fetchProject(id);
        
        // 파일 목록도 새로고침
        await get().fetchFiles(id, 'config');
        await get().fetchFiles(id, 'job');
        await get().fetchModifiedFiles(id);
      }
      
      // Global sync state: synced
      get().setProjectSyncState(id, 'synced');
      
      // 3초 후 상태 초기화
      setTimeout(() => {
        get().clearProjectSyncState(id);
      }, 3000);
      
      set({ loading: false });
      return response.data;
    } catch (error) {
      // 실패 시에는 프로젝트 정보를 새로고침하지 않음 (서버 상태가 바뀌는 것을 방지)
      
      // Global sync state: failed
      get().setProjectSyncState(id, 'failed');
      
      // failed 상태는 자동으로 지우지 않음 (사용자가 수동으로 재시도할 때까지 유지)
      
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // File actions
  fetchFiles: async (projectId, fileType) => {
    set({ loading: true, error: null });
    try {
      const response = await filesApi.list(projectId, fileType);
      console.log(`fetchFiles(${projectId}, ${fileType}) response:`, response.data);
      
      // 백엔드에서 모든 파일을 반환하므로, source가 "original"인 파일들만 필터링
      const originalFiles = response.data.filter(file => file.source === 'original');
      console.log(`fetchFiles(${projectId}, ${fileType}) filtered original files:`, originalFiles);
      
      set((state) => ({
        files: {
          ...state.files,
          [fileType]: originalFiles,
        },
        loading: false,
      }));
    } catch (error) {
      console.error(`fetchFiles(${projectId}, ${fileType}) error:`, error);
      set({ error: error.message, loading: false });
    }
  },

  // VLLM files fetching (custom-values.yaml files)
  fetchVllmFiles: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const response = await filesApi.list(projectId, 'vllm');
      // vllm 프로젝트의 경우 custom-values*.yaml 파일들을 필터링
      const vllmFiles = response.data.filter(file => 
        file.source === 'original' && 
        file.file_path && 
        (file.file_path.includes('custom-values') && file.file_path.endsWith('.yaml'))
      );
      set((state) => ({
        files: {
          ...state.files,
          vllm: vllmFiles,
        },
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createFile: async (projectId, fileData) => {
    // createModifiedFile 함수를 사용하여 올바른 데이터 변환 적용
    return await get().createModifiedFile(projectId, fileData);
  },

  // Modified Files Actions (ModifiedFile 모델 기반)
  fetchModifiedFiles: async (projectId) => {
    try {
      set({ loading: true, error: null });
      // 모든 파일을 가져와서 modified files만 필터링
      const response = await filesApi.list(projectId);
      const modifiedFiles = response.data.filter(file => file.source === 'modified');
      set(state => ({
        files: {
          ...state.files,
          modified: modifiedFiles
        },
        loading: false
      }));
    } catch (error) {
      set({ error: 'Failed to fetch modified files', loading: false });
    }
  },

  createModifiedFile: async (projectId, fileData) => {
    try {
      set({ loading: true, error: null });
      
      // ModifiedFile 데이터 구조에 맞게 변환 - 모든 필수 필드 포함
      const modifiedFileData = {
        project_id: projectId,  // 필수 필드
        modified: true,         // 필수 필드 (기본값이지만 명시적으로 포함)
        file_type: fileData.file_type,
        file_path: fileData.file_path,
        content: fileData.content,
      };
      const response = await modifiedFilesApi.create(projectId, modifiedFileData);
      
      // 수정된 파일 목록 새로고침
      await get().fetchModifiedFiles(projectId);
      
      return response.data;
    } catch (error) {
      set({ error: 'Failed to create modified file', loading: false });
      throw error;
    }
  },

  updateModifiedFile: async (fileId, fileData) => {
    try {
      set({ loading: true, error: null });
      
      // ModifiedFile 전체 데이터 구조로 업데이트 (백엔드가 전체 ModifiedFile 객체를 받음)
      const updateData = {
        // file_id는 Optional이므로 fileId가 있을 때만 포함
        ...(fileId && { file_id: fileId }),
        project_id: fileData.project_id,
        modified: true,
        file_type: fileData.file_type,  // file_type 필수 필드 추가
        file_path: fileData.file_path,
        content: fileData.content, // 문자열 그대로 전송
      };
      const response = await modifiedFilesApi.update(fileId, updateData);
      
      // 수정된 파일 목록에서 해당 파일 업데이트
      set(state => ({
        files: {
          ...state.files,
          modified: state.files.modified.map(file => 
            file.file_id === fileId ? response.data : file
          )
        },
        loading: false
      }));
      
      return response.data;
    } catch (error) {
      set({ error: 'Failed to update modified file', loading: false });
      throw error;
    }
  },

  deleteModifiedFile: async (fileId) => {
    try {
      set({ loading: true, error: null });
      await modifiedFilesApi.delete(fileId);
      
      // 수정된 파일 목록에서 해당 파일 제거
      set(state => ({
        files: {
          ...state.files,
          modified: state.files.modified.filter(file => file.file_id !== fileId)
        },
        loading: false
      }));
    } catch (error) {
      set({ error: 'Failed to delete modified file', loading: false });
    }
  },

  resetProjectFiles: async (projectId) => {
    try {
      set({ loading: true, error: null });
      await modifiedFilesApi.deleteAll(projectId);
      
      // 수정된 파일 목록 비우기
      set(state => ({
        files: {
          ...state.files,
          modified: []
        },
        loading: false
      }));
    } catch (error) {
      set({ error: 'Failed to reset project files', loading: false });
    }
  },
})); 