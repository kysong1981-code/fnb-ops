# fnb-ops 배포 최종 체크리스트

## 📋 Part 13 - 배포 준비 완료 체크리스트

---

## 1️⃣ 환경 분리 (Environment Separation) ✅

### Step 1 완료 항목:
- [x] Production settings module (`settings_production.py`)
- [x] Environment templates (`.env.*.example`)
- [x] Vite configuration with env support
- [x] Logging configuration
- [x] Sentry integration ready

**확인 항목:**
- [ ] 모든 `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] 각 환경별 SECRET_KEY가 다른가?
- [ ] 데이터베이스 연결 정보가 환경변수로 관리되는가?

---

## 2️⃣ Docker 최적화 (Docker Optimization) ✅

### Step 2 완료 항목:
- [x] Multi-stage Backend Dockerfile (`Dockerfile.prod`)
- [x] Multi-stage Frontend Dockerfile (`Dockerfile.prod`)
- [x] `.dockerignore` files
- [x] Production `docker-compose.prod.yml`
- [x] Database initialization script

**확인 항목:**
- [ ] Docker 이미지 빌드 성공 했는가?
  ```bash
  docker build -f backend/Dockerfile.prod -t fnb-ops-backend:latest ./backend
  docker build -f frontend/Dockerfile.prod -t fnb-ops-frontend:latest ./frontend
  ```
- [ ] Docker Compose 시작 성공 했는가?
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```
- [ ] 헬스체크 통과 했는가?
  ```bash
  docker ps  # 모든 컨테이너가 healthy 상태인가?
  ```
- [ ] 이미지 크기가 합리적인가?
  ```bash
  docker images | grep fnb-ops
  ```

---

## 3️⃣ 로깅 & 모니터링 (Logging & Monitoring) ✅

### Step 3 완료 항목:
- [x] Health check endpoints (`/health/`, `/ready/`, `/alive/`)
- [x] Request logging middleware
- [x] Performance monitoring middleware
- [x] Security headers middleware
- [x] Sentry integration setup

**확인 항목:**
- [ ] 헬스체크 엔드포인트 응답 확인:
  ```bash
  curl http://localhost:8000/health/
  curl http://localhost:8000/ready/
  curl http://localhost:8000/alive/
  ```
- [ ] 로그 파일이 생성되는가?
  ```bash
  ls -la logs/
  ```
- [ ] 보안 헤더가 설정되어 있는가?
  ```bash
  curl -I http://localhost:8000/api/ | grep -i "X-"
  ```
- [ ] 느린 요청이 기록되는가?
  ```bash
  grep "slow_request" logs/django.log
  ```

---

## 4️⃣ PDF 생성 (PDF Generation) ✅

### Step 4 완료 항목:
- [x] PDF Generator utilities (`utils/pdf_generator.py`)
- [x] Daily Closing PDF template
- [x] Payslip PDF template
- [x] PDF download endpoint

**확인 항목:**
- [ ] PDF 생성 엔드포인트 작동하는가?
  ```bash
  curl http://localhost:8000/api/closing/closings/1/generate_pdf/ > test.pdf
  file test.pdf  # application/pdf 확인
  ```
- [ ] PDF 파일이 올바르게 생성되는가?
  - [ ] 헤더 정보 포함
  - [ ] 테이블 서식 정확함
  - [ ] 숫자 포맷 정확함

---

## 5️⃣ CI/CD 파이프라인 (CI/CD Pipeline) ✅

### Step 5 완료 항목:
- [x] GitHub Actions workflow (`ci-cd.yml`)
- [x] Security scanning workflow (`security.yml`)
- [x] Pre-commit hooks configuration
- [x] Pytest configuration with fixtures
- [x] Jest configuration

**확인 항목:**
- [ ] GitHub Actions 워크플로우 작동하는가?
  - [ ] 푸시 시 테스트 자동 실행
  - [ ] Docker 이미지 빌드 성공
  - [ ] 보안 스캔 완료
- [ ] Pre-commit 훅 설치됐는가?
  ```bash
  pre-commit install
  pre-commit run --all-files
  ```
- [ ] 테스트 실행 가능한가?
  ```bash
  # Backend
  cd backend && pytest

  # Frontend (구성 필요)
  cd frontend && npm test
  ```

---

## 6️⃣ 데이터베이스 최적화 (Database Optimization) ✅

### Step 6 완료 항목:
- [x] Connection pooling configuration
- [x] Database migration scripts
- [x] Backup automation scripts
- [x] Health checks

**확인 항목:**
- [ ] 데이터베이스 연결 풀이 작동하는가?
  ```python
  # settings_production.py에서:
  'CONN_MAX_AGE': 600  # 확인됨
  'CONN_HEALTH_CHECKS': True  # 확인됨
  ```
- [ ] 마이그레이션이 성공하는가?
  ```bash
  python manage.py migrate
  ```
- [ ] 백업 스크립트가 작동하는가?
  ```bash
  bash backend/scripts/backup_db.sh
  ```
- [ ] 복원이 가능한가?
  ```bash
  gunzip -c backups/fnb_ops_db_*.sql.gz | mysql -u root -p
  ```

---

## 7️⃣ 보안 강화 (Security Hardening) ✅

### Step 7 완료 항목:
- [x] Security headers
- [x] HTTPS/SSL configuration
- [x] CORS hardening
- [x] Rate limiting
- [x] CSRF protection

**확인 항목:**
- [ ] HTTPS 리다이렉트 작동하는가?
  ```python
  SECURE_SSL_REDIRECT = True  # 확인됨
  ```
- [ ] 보안 헤더 설정되었는가?
  ```bash
  curl -I https://yourdomain.com | grep -i "X-\|Strict\|Content-Security"
  ```
- [ ] CORS 설정이 정확한가?
  ```python
  CORS_ALLOWED_ORIGINS = [...]  # 확인됨
  ```
- [ ] Rate limiting 작동하는가?
  ```python
  'DEFAULT_THROTTLE_RATES': {
      'anon': '100/hour',
      'user': '1000/hour'
  }  # 확인됨
  ```

---

## 8️⃣ 배포 검증 (Deployment Verification) ✅

### Step 8 완료 항목:
- [x] DEPLOYMENT.md 가이드
- [x] DEPLOYMENT_CHECKLIST.md
- [x] 사전 배포 체크리스트
- [x] 배포 후 체크리스트

**최종 배포 전 확인:**

### 🔵 **사전 배포**
- [ ] 모든 테스트 통과
- [ ] 보안 스캔 완료
- [ ] 코드 리뷰 완료
- [ ] 데이터베이스 백업 완료
- [ ] 환경 변수 설정 완료
- [ ] SSL 인증서 설치 완료
- [ ] GitHub 시크릿 설정 완료

### 🟢 **배포 중**
- [ ] Docker 이미지 빌드 성공
- [ ] 컨테이너 시작 성공
- [ ] 데이터베이스 마이그레이션 완료
- [ ] 정적 파일 수집 완료
- [ ] 헬스체크 통과

### 🟡 **배포 후**
- [ ] 로그인 기능 확인
- [ ] API 문서 접속 확인
- [ ] 데이터 조회 확인
- [ ] 권한 제어 확인
- [ ] 로깅 작동 확인
- [ ] Sentry 에러 추적 확인
- [ ] 성능 모니터링 활성화

---

## 🎯 배포 명령어 (한번에 실행)

### 개발 환경 (Development)
```bash
cd /Users/song/fnb-ops
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd backend && python manage.py migrate
python manage.py runserver &
cd ../frontend && npm run dev
```

### 프로덕션 환경 (Production - Docker)
```bash
cd /Users/song/fnb-ops
# 1. 환경 변수 설정
export $(cat .env.production | xargs)

# 2. 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 3. 마이그레이션 및 설정
docker-compose -f docker-compose.prod.yml exec backend \
  bash backend/scripts/migrate.sh

# 4. 확인
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:8000/health/
```

---

## 📊 Part 13 완료 현황

| Step | 항목 | 상태 | 파일 |
|------|------|------|------|
| 1 | 환경 분리 | ✅ | settings_production.py, .env.* |
| 2 | Docker 최적화 | ✅ | Dockerfile.prod, docker-compose.prod.yml |
| 3 | 로깅 & 모니터링 | ✅ | health.py, middleware.py |
| 4 | PDF 생성 | ✅ | pdf_generator.py |
| 5 | CI/CD 파이프라인 | ✅ | .github/workflows/* |
| 6 | 데이터베이스 최적화 | ✅ | scripts/backup_db.sh |
| 7 | 보안 강화 | ✅ | middleware.py, settings_production.py |
| 8 | 배포 검증 | ✅ | DEPLOYMENT.md |

**🎉 Part 13 완료: 100% ✅**

---

## 📞 지원 및 리소스

- Django 문서: https://docs.djangoproject.com/
- Docker 문서: https://docs.docker.com/
- MySQL 성능: https://dev.mysql.com/doc/
- Sentry: https://docs.sentry.io/
- GitHub Actions: https://docs.github.com/en/actions

**마지막 업데이트**: 2026년 3월 7일
