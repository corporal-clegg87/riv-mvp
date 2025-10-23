# Auth Implementation Plan - Step by Step

## Overview
Implement stateless JWT authentication with email OTP using Tencent Cloud SES, with proper dev/prod environment handling.

## Prerequisites
- [ ] Tencent Cloud account with SES enabled
- [ ] Domain verified in Tencent SES
- [ ] Local development environment ready

---

## Phase 1: Environment Setup (3 commits)

### Step 1.1: Environment Configuration
**Commit:** `feat: add environment configuration for dev/prod`

**Files to create:**
- `.env.local.example` - Template for development
- `src/lib/config.ts` - Environment detection
- `.gitignore` - Ensure .env.local is ignored

**Test:** Environment variables load correctly in development

### Step 1.2: Dependencies Installation
**Commit:** `feat: add auth dependencies`

**Dependencies to add:**
```json
{
  "nodemailer": "^6.9.0",
  "redis": "^4.6.0", 
  "jsonwebtoken": "^9.0.0",
  "tencentcloud-sdk-nodejs": "^4.0.0",
  "@types/nodemailer": "^6.4.0",
  "@types/jsonwebtoken": "^9.0.0",
  "@types/redis": "^4.0.0"
}
```

**Test:** `npm install` completes without errors

### Step 1.3: Development Services Setup
**Commit:** `feat: add development services configuration`

**Files to create:**
- `docker-compose.dev.yml` - Local Redis and MailHog
- `scripts/dev-setup.sh` - Development environment setup
- `README.md` - Update with development instructions

**Test:** `docker-compose -f docker-compose.dev.yml up -d` starts services

---

## Phase 2: Core Auth Infrastructure (4 commits)

### Step 2.1: Secrets Management
**Commit:** `feat: implement secrets management with dev/prod support`

**Files to create:**
- `src/lib/secrets.ts` - Environment-aware secret retrieval
- `src/lib/config.ts` - Environment configuration

**Test:** Secrets load from environment in dev, Secrets Manager in prod

### Step 2.2: Email Service
**Commit:** `feat: implement email service with Tencent SES`

**Files to create:**
- `src/lib/email.ts` - Email sending with dev/prod handling
- `src/lib/email-dev.ts` - Development email mocking

**Test:** Email sends in development (console log), production (real SES)

### Step 2.3: OTP Storage
**Commit:** `feat: implement OTP storage with Redis fallback`

**Files to create:**
- `src/lib/otp.ts` - OTP generation and storage
- `src/lib/redis.ts` - Redis connection with fallback

**Test:** OTP stores/retrieves correctly, fallback to memory works

CONTINUE HERE ### Step 2.4: JWT Session Management
**Commit:** `feat: implement JWT session management`

**Files to create:**
- `src/lib/auth.ts` - JWT token creation/validation
- `src/lib/session.ts` - Session management utilities

**Test:** JWT tokens generate/validate correctly

---

## Phase 3: API Endpoints (4 commits)

### Step 3.1: Send OTP Endpoint
**Commit:** `feat: add send OTP API endpoint`

**Files to create:**
- `src/app/api/auth/send-otp/route.ts` - POST endpoint
- `tests/api/send-otp.test.ts` - Unit tests

**Test:** POST /api/auth/send-otp returns success, email sent

### Step 3.2: Verify OTP Endpoint
**Commit:** `feat: add verify OTP API endpoint`

**Files to create:**
- `src/app/api/auth/verify-otp/route.ts` - POST endpoint
- `tests/api/verify-otp.test.ts` - Unit tests

**Test:** POST /api/auth/verify-otp returns JWT tokens on valid OTP

### Step 3.3: Session Validation Endpoint
**Commit:** `feat: add session validation API endpoint`

**Files to create:**
- `src/app/api/auth/validate/route.ts` - GET endpoint
- `tests/api/validate.test.ts` - Unit tests

**Test:** GET /api/auth/validate returns user info for valid token

### Step 3.4: Token Refresh Endpoint
**Commit:** `feat: add token refresh API endpoint`

**Files to create:**
- `src/app/api/auth/refresh/route.ts` - POST endpoint
- `tests/api/refresh.test.ts` - Unit tests

**Test:** POST /api/auth/refresh returns new tokens for valid refresh token

---

## Phase 4: Client-Side Implementation (3 commits)

### Step 4.1: Login Form Component
**Commit:** `feat: add login form component`

**Files to create:**
- `src/components/LoginForm.tsx` - Email OTP login form
- `src/components/OTPForm.tsx` - OTP verification form
- `src/hooks/useAuth.ts` - Authentication hook

**Test:** Login form renders, handles email input, sends OTP request

### Step 4.2: Authentication Context
**Commit:** `feat: add authentication context and provider`

**Files to create:**
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/hooks/useAuth.ts` - Updated with context integration
- `src/lib/auth-client.ts` - Client-side auth utilities

**Test:** Auth state persists across page refreshes

### Step 4.3: Protected Route Logic
**Commit:** `feat: add protected route logic`

**Files to create:**
- `src/middleware.ts` - Next.js middleware for route protection
- `src/lib/auth-guard.ts` - Client-side route protection
- `src/components/AuthGuard.tsx` - Protected component wrapper

**Test:** Unauthenticated users redirected to login, authenticated users see content

---

## Phase 5: Integration & Testing (3 commits)

### Step 5.1: Home Page Integration
**Commit:** `feat: integrate auth with home page`

**Files to modify:**
- `src/app/page.tsx` - Add auth state handling
- `src/components/HelloWorld.tsx` - Show only when authenticated

**Test:** Home page shows login form when not authenticated, HelloWorld when authenticated

### Step 5.2: Logout Functionality
**Commit:** `feat: add logout functionality`

**Files to create:**
- `src/components/LogoutButton.tsx` - Logout button component
- `src/lib/logout.ts` - Logout utilities

**Test:** Logout clears tokens and redirects to login

### Step 5.3: Error Handling & Edge Cases
**Commit:** `feat: add comprehensive error handling`

**Files to create:**
- `src/lib/error-handler.ts` - Centralized error handling
- `src/components/ErrorBoundary.tsx` - React error boundary
- `src/lib/rate-limiter.ts` - Basic rate limiting

**Test:** All error scenarios handled gracefully

---

## Phase 6: Production Readiness (2 commits)

### Step 6.1: Production Configuration
**Commit:** `feat: add production configuration and secrets management`

**Files to create:**
- `src/lib/secrets-manager.ts` - Tencent Cloud Secrets Manager integration
- `scripts/deploy-setup.sh` - Production deployment script
- `docs/deployment.md` - Deployment documentation

**Test:** Secrets load from Tencent Cloud in production environment

### Step 6.2: Monitoring & Logging
**Commit:** `feat: add monitoring and logging`

**Files to create:**
- `src/lib/logger.ts` - Structured logging
- `src/lib/monitoring.ts` - Auth metrics and monitoring
- `src/middleware/monitoring.ts` - Request monitoring middleware

**Test:** Logs are structured, sensitive data not logged

---

## Testing Strategy

### Unit Tests (Each commit)
- Test individual functions in isolation
- Mock external dependencies (SES, Redis, Secrets Manager)
- Test error scenarios and edge cases

### Integration Tests (Phase 3-4)
- Test API endpoints with real dependencies
- Test client-server communication
- Test authentication flow end-to-end

### E2E Tests (Phase 5-6)
- Test complete user journey
- Test in both development and production environments
- Test error scenarios and recovery

---

## Development Workflow

### Before Each Commit:
1. **Write tests first** (TDD approach)
2. **Implement feature** (smallest possible change)
3. **Run tests** (`npm test`)
4. **Test manually** (start dev server, test in browser)
5. **Commit with descriptive message**

### Testing Commands:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/api/send-otp.test.ts

# Start development environment
npm run dev:setup
npm run dev
```

### Environment Setup:
```bash
# Development
cp .env.local.example .env.local
# Edit .env.local with your credentials
docker-compose -f docker-compose.dev.yml up -d
npm run dev

# Production
# Configure Tencent Cloud Secrets Manager
# Set production environment variables
# Deploy to your platform
```

---

## Success Criteria

### Phase 1-2: Infrastructure ✅
- [ ] Environment variables load correctly
- [ ] Dependencies install without conflicts
- [ ] Development services start successfully
- [ ] Secrets management works in both environments

### Phase 3: API Endpoints ✅
- [ ] All 4 auth endpoints return correct responses
- [ ] OTP flow works end-to-end
- [ ] JWT tokens generate and validate correctly
- [ ] Error handling works for all scenarios

### Phase 4-5: Client Integration ✅
- [ ] Login form works smoothly
- [ ] Authentication state persists across refreshes
- [ ] Protected routes redirect correctly
- [ ] Logout clears all auth state

### Phase 6: Production Ready ✅
- [ ] Production secrets load from Tencent Cloud
- [ ] Email delivery works in production
- [ ] Monitoring and logging functional
- [ ] Performance acceptable under load

---

## Rollback Plan

If any step fails:
1. **Revert the commit** (`git revert <commit-hash>`)
2. **Identify the issue** (check tests, logs, environment)
3. **Fix the issue** (update code, environment, or dependencies)
4. **Re-commit** with the fix
5. **Continue** from the failed step

---

**Total Estimated Time:** 2-3 days for full implementation
**Commit Frequency:** 1-2 commits per hour during active development
**Testing:** Each commit must pass all tests before proceeding
