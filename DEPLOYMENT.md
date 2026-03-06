# fnb-ops 배포 가이드 (Deployment Guide)

## Part 13 통합 배포 시스템

이 문서는 fnb-ops 시스템을 개발, 스테이징, 프로덕션 환경에 배포하는 완벽한 가이드입니다.

---

## 📋 목차

1. [환경 설정](#환경-설정)
2. [데이터베이스 최적화](#데이터베이스-최적화)
3. [보안 강화](#보안-강화)
4. [배포 절차](#배포-절차)
5. [모니터링 및 헬스체크](#모니터링-및-헬스체크)
6. [트러블슈팅](#트러블슈팅)

---

## 환경 설정

### Step 1: 환경 변수 설정

#### 1.1 개발 환경 (Development)

```bash
cd /Users/song/fnb-ops
cp .env.example .env.development.local

# .env.development.local 수정
DJANGO_SETTINGS_MODULE=core.settings
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_HOST=127.0.0.1
FRONTEND_URL=http://localhost:5173
```

#### 1.2 스테이징 환경 (Staging)

```bash
cp .env.staging.example .env.staging

# 다음 값들 설정:
SECRET_KEY=<generate-strong-key>
DEBUG=False
ALLOWED_HOSTS=staging.yourdomain.com
DB_HOST=<staging-db-host>
DB_PASSWORD=<secure-password>
SENTRY_ENABLED=True
SENTRY_DSN=<sentry-dsn>
```

#### 1.3 프로덕션 환경 (Production)

```bash
cp .env.production.example .env.production

# 다음 값들 설정:
DJANGO_SETTINGS_MODULE=core.settings_production
SECRET_KEY=<very-strong-key>  # python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DB_HOST=<production-db-host>
DB_PASSWORD=<very-secure-password>
SECURE_SSL_REDIRECT=True
SENTRY_ENABLED=True
SENTRY_DSN=<sentry-dsn>
```

---

## 데이터베이스 최적화

### Step 6: 데이터베이스 성능 최적화

#### 6.1 Connection Pooling 설정

이미 `settings_production.py`에 구성됨:

```python
DATABASES = {
    'default': {
        'CONN_MAX_AGE': 600,  # 10분 연결 유지
        'CONN_HEALTH_CHECKS': True,  # 연결 상태 확인
    }
}
```

#### 6.2 데이터베이스 마이그레이션

```bash
# 개발 환경
cd backend
python manage.py migrate

# 프로덕션 환경 (Docker)
docker-compose -f docker-compose.prod.yml exec backend \
  python manage.py migrate

# 또는 스크립트 사용
bash backend/scripts/migrate.sh
```

#### 6.3 데이터베이스 백업

```bash
# 수동 백업
bash backend/scripts/backup_db.sh

# 자동 백업 (Cron Job)
0 2 * * * /path/to/backend/scripts/backup_db.sh

# Docker에서 백업
docker-compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u root -p$DB_PASSWORD $DB_NAME | gzip > backup.sql.gz
```

#### 6.4 데이터베이스 복원

```bash
# 백업에서 복원
gunzip -c backup.sql.gz | mysql -u root -p $DB_NAME
```

#### 6.5 성능 최적화

```sql
-- MySQL에서 실행
-- 인덱스 확인
SHOW INDEX FROM [table_name];

-- 테이블 최적화
OPTIMIZE TABLE [table_name];

-- 슬로우 쿼리 로그 활성화
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

---

## 보안 강화

### Step 7: 보안 강화 설정

#### 7.1 이미 구성된 보안 기능

✅ **HTTPS/SSL**
```python
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

✅ **보안 헤더**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

✅ **CORS 설정**
```python
CORS_ALLOWED_ORIGINS = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
]
```

✅ **Rate Limiting**
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    }
}
```

#### 7.2 추가 보안 체크리스트

- [ ] SSL 인증서 설치 (Let's Encrypt 권장)
- [ ] Firewall 규칙 설정
- [ ] 자동 HTTPS 리다이렉트 확인
- [ ] CSRF 토큰 검증 활성화
- [ ] 강력한 암호 정책 적용
- [ ] 2FA (Two-Factor Authentication) 구현 (향후)
- [ ] WAF (Web Application Firewall) 설정 (선택사항)

---

## 배포 절차

### Step 8: 배포 검증 및 체크리스트

#### 8.1 사전 배포 체크리스트

**데이터베이스**
- [ ] 데이터베이스 백업 완료
- [ ] 마이그레이션 스크립트 테스트됨
- [ ] 연결 풀 설정 확인

**보안**
- [ ] SECRET_KEY 생성 및 저장
- [ ] SSL 인증서 설치 완료
- [ ] 환경 변수 설정 완료
- [ ] GitHub 시크릿 설정 완료

**배포**
- [ ] Docker 이미지 빌드 테스트
- [ ] docker-compose.prod.yml 검증
- [ ] 헬스체크 엔드포인트 확인
- [ ] CI/CD 파이프라인 작동 확인

**모니터링**
- [ ] Sentry 프로젝트 생성
- [ ] 로깅 디렉토리 생성 및 권한 설정
- [ ] 로그 로테이션 설정

#### 8.2 배포 단계별 절차

##### 개발 환경 배포 (Development)

```bash
# 1. 환경 설정
cd /Users/song/fnb-ops
source .env.development.local

# 2. 의존성 설치
pip install -r requirements.txt
npm install --prefix frontend

# 3. 마이그레이션
python manage.py migrate

# 4. 정적 파일 수집
python manage.py collectstatic --noinput

# 5. 개발 서버 시작
# Terminal 1: Backend
cd backend && python manage.py runserver

# Terminal 2: Frontend
cd frontend && npm run dev
```

##### 스테이징/프로덕션 배포 (Docker)

```bash
# 1. 환경 변수 로드
export $(cat .env.staging)

# 2. Docker 이미지 빌드
docker-compose -f docker-compose.prod.yml build

# 3. 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 4. 마이그레이션 실행
docker-compose -f docker-compose.prod.yml exec backend \
  python manage.py migrate

# 5. 정적 파일 수집
docker-compose -f docker-compose.prod.yml exec backend \
  python manage.py collectstatic --noinput

# 6. 헬스체크 확인
curl http://localhost:8000/health/
curl http://localhost:8000/ready/
curl http://localhost:8000/alive/
```

#### 8.3 배포 후 체크리스트

**기능 검증**
- [ ] 로그인 페이지 접속 가능
- [ ] API 문서 접근 가능 (/api/docs/)
- [ ] 데이터베이스 연결 정상
- [ ] 정적 파일 로드 정상

**성능 검증**
- [ ] 응답 시간 확인
- [ ] 데이터베이스 쿼리 성능 확인
- [ ] 메모리/CPU 사용률 정상

**보안 검증**
- [ ] HTTPS 작동 확인
- [ ] 보안 헤더 확인 (https://securityheaders.com)
- [ ] 로그인/로그아웃 기능 정상
- [ ] 권한 제어 작동 확인

**모니터링 확인**
- [ ] 로그 파일 생성됨
- [ ] Sentry 에러 추적 작동
- [ ] 헬스체크 응답 정상

---

## 모니터링 및 헬스체크

### 헬스체크 엔드포인트

```bash
# Basic Health Check
curl http://localhost:8000/health/
# Response: {"status": "healthy", "service": "fnb-ops-backend"}

# Readiness Check (Database)
curl http://localhost:8000/ready/
# Response: {"status": "ready", "service": "fnb-ops-backend", "database": "connected"}

# Liveness Check
curl http://localhost:8000/alive/
# Response: {"status": "alive", "service": "fnb-ops-backend"}
```

### 로깅 확인

```bash
# Docker 로그
docker-compose -f docker-compose.prod.yml logs -f backend

# 로그 파일
tail -f logs/django.log
tail -f logs/requests.log
tail -f logs/errors.log
```

---

## 트러블슈팅

### 일반적인 문제 해결

**Database Connection 실패**
```bash
# MySQL 연결 확인
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# Docker에서 MySQL 확인
docker-compose -f docker-compose.prod.yml exec mysql \
  mysqladmin -u root -p$DB_PASSWORD ping
```

**정적 파일 404 오류**
```bash
# 정적 파일 수집 재실행
python manage.py collectstatic --noinput --clear
```

**마이그레이션 충돌**
```bash
# 마이그레이션 상태 확인
python manage.py showmigrations

# 마이그레이션 롤백 (주의!)
python manage.py migrate [app] [migration_number]
```

**성능 저하**
```bash
# 슬로우 쿼리 확인
mysql -e "SHOW PROCESSLIST;"

# 데이터베이스 최적화
python manage.py dbshell < optimize.sql
```

---

## 참고 자료

- [Django 배포 가이드](https://docs.djangoproject.com/en/4.2/howto/deployment/)
- [Docker 설명서](https://docs.docker.com/)
- [MySQL 성능 튜닝](https://dev.mysql.com/doc/)
- [Sentry 문서](https://docs.sentry.io/)

---

**마지막 업데이트**: 2026년 3월 7일
**버전**: Part 13 (Deployment & Optimization)
