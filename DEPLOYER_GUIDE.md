# Benchmark Deployer 사용 가이드

이 가이드는 VLLM Frontend에 새로 추가된 **Benchmark Deployer** 기능의 사용 방법을 설명합니다.

## 개요

Benchmark Deployer는 Kubernetes 클러스터에 벤치마크 작업을 배포하고 관리할 수 있는 웹 인터페이스입니다. 이 기능을 통해 다음과 같은 작업을 수행할 수 있습니다:

- **YAML 배포**: Kubernetes Job, Deployment, Service 등을 YAML로 배포
- **실시간 로그 조회**: 배포된 작업의 로그를 실시간으로 확인
- **터미널 접속**: 실행 중인 Pod에 WebSocket 기반 터미널로 직접 접속
- **상태 모니터링**: 배포된 작업들의 상태를 실시간으로 모니터링

## 접근 방법

1. 웹 브라우저에서 VLLM Frontend에 접속
2. 좌측 사이드바에서 **"Benchmark Deployer"** 메뉴 클릭
3. `/deployer` 페이지가 로드됩니다

## 주요 기능

### 1. 새 배포 생성

#### 기본 사용법
1. Deployer 목록 페이지에서 **"새 배포"** 버튼 클릭
2. 네임스페이스 선택 (기본값: `default`)
3. YAML 내용 입력 또는 기본 템플릿 수정
4. **"배포"** 버튼 클릭

#### 기본 YAML 템플릿
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: my-benchmark-job
  labels:
    app: benchmark
spec:
  template:
    spec:
      containers:
      - name: benchmark-container
        image: busybox
        command: ['sh', '-c']
        args: ['echo "Hello World"; sleep 300']
      restartPolicy: Never
  backoffLimit: 3
```

### 2. 배포 목록 조회

- **활성 배포 목록**: 현재 클러스터에 배포된 모든 작업들을 테이블 형태로 표시
- **상태 표시**: 각 배포의 상태를 색상으로 구분하여 표시
  - 🔵 **Running**: 실행 중
  - 🟢 **Completed**: 성공 완료
  - 🔴 **Failed**: 실패
  - 🟡 **Pending**: 대기 중
  - ⚪ **Deleted**: 삭제됨

### 3. 상세 정보 및 관리

#### 상세 페이지 접근
- 배포 목록에서 **"상세 보기"** 아이콘 클릭
- 또는 직접 `/deployer/{job-name}` URL 접속

#### 제공되는 기능
1. **작업 상태**: 상세한 상태 정보, Pod 수, 생성 시간 등
2. **터미널 접속**: 실시간 WebSocket 터미널
3. **로그 조회**: 실시간 로그 스트리밍 및 다운로드
4. **세션 관리**: 활성 터미널 세션 관리

### 4. 터미널 기능 🔥

#### 터미널 연결
1. 상세 페이지에서 **"터미널"** 탭 선택
2. **"터미널 연결"** 버튼 클릭
3. 자동으로 Job의 첫 번째 Pod에 연결
4. 실시간 명령어 입력 및 실행

#### 터미널 사용법
- **명령어 입력**: 하단 입력창에 명령어 입력 후 Enter
- **실행 예시**:
  ```bash
  ls -la
  pwd
  ps aux
  top
  vi test.txt
  python3 -c "print('Hello from container!')"
  ```

#### 고급 기능
- **여러 세션**: 동일한 Job에 여러 터미널 세션 동시 연결 가능
- **세션 관리**: "세션 관리" 탭에서 모든 활성 세션 확인 및 제어
- **자동 정리**: 비활성 세션은 30분 후 자동 제거

### 5. 로그 조회

#### 기본 사용법
1. 상세 페이지에서 **"로그"** 탭 선택
2. 로그 라인 수 조정 (기본: 100줄)
3. **"새로고침"** 버튼으로 최신 로그 조회
4. **"다운로드"** 버튼으로 로그 파일 저장

#### 실시간 모니터링
- 로그는 자동으로 업데이트되지 않으므로 새로고침 필요
- 장기 실행 작업의 경우 주기적으로 새로고침 권장

## 사용 시나리오

### 시나리오 1: 간단한 테스트 Job 실행
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: test-python-job
spec:
  template:
    spec:
      containers:
      - name: python-container
        image: python:3.9
        command: ['python', '-c']
        args: ['import time; print("Starting..."); time.sleep(60); print("Done!")']
      restartPolicy: Never
```

### 시나리오 2: GPU 벤치마크 Job
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: gpu-benchmark
spec:
  template:
    spec:
      containers:
      - name: benchmark
        image: nvidia/cuda:11.8-runtime-ubuntu20.04
        command: ['nvidia-smi']
        resources:
          limits:
            nvidia.com/gpu: 1
      restartPolicy: Never
```

### 시나리오 3: 장기 실행 서비스
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: long-running-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: long-running
  template:
    metadata:
      labels:
        app: long-running
    spec:
      containers:
      - name: service
        image: nginx
        ports:
        - containerPort: 80
```

## 문제 해결

### 일반적인 문제들

#### 1. 배포 실패
- **원인**: YAML 문법 오류, 리소스 부족, 권한 문제
- **해결**: YAML 검증, 클러스터 리소스 확인, RBAC 권한 확인

#### 2. 터미널 연결 실패
- **원인**: Pod 준비되지 않음, 네트워크 문제, WebSocket 차단
- **해결**: Pod 상태 확인, 방화벽 설정 확인, 브라우저 콘솔 로그 확인

#### 3. 로그 조회 안됨
- **원인**: Pod 미생성, 권한 부족, Job 미실행
- **해결**: Job 상태 확인, 네임스페이스 확인, RBAC 권한 확인

### 디버깅 팁

1. **브라우저 개발자 도구** 활용
   - Network 탭에서 API 호출 상태 확인
   - Console 탭에서 JavaScript 오류 확인

2. **백엔드 로그** 확인
   - Benchmark Deployer 서비스 로그 확인
   - Kubernetes 이벤트 확인

3. **권한 확인**
   ```bash
   kubectl auth can-i create jobs
   kubectl auth can-i get pods
   kubectl auth can-i get logs
   ```

## 보안 고려사항

### 접근 제어
- Job Pod에만 터미널 접근 가능
- 네임스페이스별 격리
- RBAC 기반 권한 관리

### 안전한 사용법
- 프로덕션 네임스페이스에 테스트 Job 배포 금지
- 민감한 정보가 포함된 YAML 주의
- 터미널 세션 사용 후 정리

## API 엔드포인트

프로그래밍 방식으로 접근하려면 다음 API를 사용하세요:

- `POST /deploy/deploy` - YAML 배포
- `GET /deploy/deployments` - 배포 목록 조회
- `GET /deploy/jobs/{job_name}/status` - Job 상태 조회
- `GET /deploy/jobs/{job_name}/logs` - Job 로그 조회
- `POST /deploy/jobs/{job_name}/terminal` - 터미널 세션 생성
- `WS /deploy/terminal/{session_id}` - WebSocket 터미널 연결

## 추가 리소스

- [Kubernetes Job 가이드](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [YAML 문법 참조](https://yaml.org/spec/1.2/spec.html)
- [kubectl 명령어 참조](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

**주의**: 이 기능은 관리자 권한이 필요하며, 클러스터 리소스에 직접적인 영향을 줄 수 있습니다. 신중하게 사용해주세요. 