# VLLM 성능 평가 대시보드

VLLM 모델의 성능 평가 결과를 시각적으로 탐색하고 분석할 수 있는 웹 대시보드입니다. 이 대시보드를 통해 모델 릴리스에 따른 성능 변화를 직관적으로 파악하고, 품질 관련 의사결정을 신속하게 내릴 수 있습니다.

## ✨ 주요 기능

- **📈 대시보드 메인 뷰**: 전체 평가 실행 횟수, 성공/실패율 등 핵심 KPI와 주요 메트릭의 시계열 변화를 보여주는 트렌드 차트를 제공합니다.
- **🗂️ 인터랙티브 데이터 테이블**: 모델 태그, 실행 시간, 점수 등 주요 컬럼을 기준으로 정렬, 필터링, 페이지네이션 기능을 통해 평가 실행 목록을 효율적으로 탐색할 수 있습니다.
- **📄 상세 결과 뷰**: 특정 평가 실행(`run_id`)에 대한 모든 상세 메트릭(`deepeval`, `evalchemy` 등)을 그룹화하여 명확하게 확인할 수 있습니다.
- **📱 반응형 UI**: 데스크탑, 태블릿, 모바일 등 다양한 화면 크기에서 최적화된 레이아웃을 제공합니다.

## 🛠️ 기술 스택

- **Frontend**: **React (Vite)**, React Router, Recoil/Zustand
- **UI/UX**: **Material-UI / Ant Design**, Recharts
- **Container**: **Docker**, Nginx
- **CI/CD**: **GitHub Actions**
- **Deployment**: **Kubernetes**, Kustomize

## 🏗️ 아키텍처

본 프로젝트는 **단일 페이지 애플리케이션(SPA)**으로, 모던 웹 기술 스택을 기반으로 설계되었습니다.

- **Client-Side**: 컴포넌트 기반 아키텍처(CBA)를 채택하고, React Router DOM으로 라우팅을, Recoil/Zustand로 상태를 관리합니다.
- **Build & Deployment**: Vite로 소스 코드를 빌드하고, Docker를 사용하여 Nginx 위에서 동작하는 컨테이너 이미지를 생성합니다. GitHub Actions를 통해 이 과정이 자동화됩니다.
- **Backend-Interaction**: 백엔드 서버와 RESTful API로 통신하여 평가 데이터를 가져옵니다.

### 데이터 플로우

```
1. Developer pushes code to GitHub
       ↓
2. GitHub Actions (CI)
   - Lint & Test
   - Build React App
   - Build Docker Image (with Nginx)
   - Push Image to GHCR
       ↓
3. (Optional: CD Trigger - ArgoCD/Flux)
       ↓
4. Kubernetes Cluster
   - Pulls new image from GHCR
   - Performs Rolling Update on Deployment
       ↓
5. User accesses the new version via Browser
```

## 🚀 시작하기

### 사전 요구사항

- Node.js (v18 이상)
- npm
- Docker (선택 사항)

### 설치 및 실행

1.  **의존성 설치**:
    ```bash
    npm install
    ```

2.  **개발 서버 실행**:
    ```bash
    npm run dev
    ```
    이제 브라우저에서 `http://localhost:5173`으로 접속할 수 있습니다.

3.  **프로덕션 빌드**:
    ```bash
    npm run build
    ```

### Docker로 실행하기

1.  **Docker 이미지 빌드**:
    ```bash
    docker build -t vllm-frontend-public .
    ```

2.  **Docker 컨테이너 실행**:
    ```bash
    docker run -p 8080:80 vllm-frontend-public
    ```
    이제 브라우저에서 `http://localhost:8080`으로 접속할 수 있습니다.

## ⚙️ CI/CD

`.github/workflows`에 정의된 GitHub Actions 워크플로우를 통해 CI/CD 파이프라인이 구축되어 있습니다.

- **CI (Continuous Integration)**: `main` 또는 `develop` 브랜치에 코드가 Push 되거나 Pull Request가 생성되면, 아래 작업이 자동으로 실행됩니다.
    1.  **Lint & Test**: 코드 스타일을 검사하고 단위 테스트를 실행합니다.
    2.  **Build & Push Image**: Docker 이미지를 빌드하고 GHCR(GitHub Container Registry)에 푸시합니다.
    3.  **Scan Image**: Trivy를 사용하여 이미지의 보안 취약점을 검사합니다.

- **CD (Continuous Deployment)**: (선택 사항) ArgoCD와 같은 GitOps 도구를 사용하여 GHCR에 새로운 이미지가 푸시되면 자동으로 Kubernetes 클러스터에 배포할 수 있습니다.

## 🚢 Kubernetes 배포

`k8s/` 디렉토리에 Kubernetes 배포를 위한 매니페스트 파일이 포함되어 있습니다.

- **Deployment**: 애플리케이션의 복제본 수, 롤링 업데이트 전략, liveness/readiness probe 등을 정의합니다.
- **Service**: 클러스터 내부에서 애플리케이션에 접근할 수 있는 안정적인 엔드포인트를 생성합니다.
- **Ingress**: 외부 트래픽을 서비스로 라우팅하고 도메인을 연결합니다.

`kustomize`를 사용하여 개발, 스테이징, 프로덕션 환경별로 다른 설정을 적용할 수 있습니다. 