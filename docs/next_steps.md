# Next Steps - Email OTP Authentication Implementation

## Prerequisites

1. **Tencent Cloud SES Setup**
   - Go to [Tencent Cloud SES Console](https://console.tencentcloud.com/ses/domain)
   - Set up your domain for email sending

2. **Domain Configuration**
   - Configure your domain at [Google Domains](https://admin.google.com/u/1/ac/domains/manage)
   - Ensure proper DNS records for email authentication

## Implementation Plan

### Objective
Implement email-only OTP authentication system using Tencent Cloud SES with proper secret management and basic login/logout flow.

### Summary
Create a streamlined email OTP authentication system that allows users to login with email verification codes, view HelloWorld component when authenticated, and logout securely.

### Assumptions
- Tencent Cloud account is available with SES service access
- Domain is available for email sending configuration
- Redis will be used for OTP storage (can be local or cloud)
- Secrets will be managed via Tencent Cloud Secrets Manager
- Simple session management using JWT tokens stored in localStorage
- No user registration - any valid email can receive OTP

### Change Budget
- **Max Files**: 8
- **Max Total LOC**: 400
- **Max Dependency Additions**: 3

## Decision Log

#### Secret Management
**Question**: How to manage sensitive credentials like SMTP passwords and JWT secrets?
**Choice**: Tencent Cloud Secrets Manager for production, environment variables for development with proper .env handling
**Alternatives Rejected**: Hardcoded secrets, Plain environment variables, External secret management services

#### OTP Storage
**Question**: Where to store temporary OTP codes?
**Choice**: Redis for fast access and automatic expiration, with fallback to in-memory storage for development
**Alternatives Rejected**: Database storage only, File-based storage, External OTP service

#### Session Management
**Question**: How to manage user sessions after login?
**Choice**: JWT tokens stored in localStorage with server-side validation
**Alternatives Rejected**: Server-side sessions only, Cookie-based sessions, External session service

#### Email Provider
**Question**: Which email service to use for OTP delivery?
**Choice**: Tencent Cloud SES only - provides good China coverage and international delivery
**Alternatives Rejected**: SendGrid (potential China delivery issues), AWS SES (China limitations), Multiple providers

## File Changes

### Core Dependencies

#### package.json
**Status**: Modify
**Reason**: Add dependencies for Tencent Cloud SES integration, Redis client, and JWT handling
**Dependencies to Add**:
- `nodemailer` - Email sending library
- `redis` - Redis client for OTP storage
- `jsonwebtoken` - JWT token handling
- `tencentcloud-sdk-nodejs` - Tencent Cloud SDK

### Core Modules

#### Secret Management
**File**: `src/lib/secrets.ts`
**Status**: Create
**Purpose**: Environment-aware secret retrieval from Tencent Cloud Secrets Manager or environment variables

#### Email Service
**File**: `src/lib/email.ts`
**Status**: Create
**Purpose**: Email sending service using Tencent Cloud SES with development/production handling

#### Authentication
**File**: `src/lib/auth.ts`
**Status**: Create
**Purpose**: OTP storage, verification, and JWT session management

### API Endpoints

#### Send OTP
**File**: `src/app/api/auth/send-otp/route.ts`
**Status**: Create
**Purpose**: POST endpoint for sending OTP email to user's email address

#### Verify OTP
**File**: `src/app/api/auth/verify-otp/route.ts`
**Status**: Create
**Purpose**: POST endpoint for verifying OTP and creating user session

#### Session Validation
**File**: `src/app/api/auth/validate/route.ts`
**Status**: Create
**Purpose**: GET endpoint for validating JWT tokens and returning user information

### Client Components

#### Login Form
**File**: `src/components/LoginForm.tsx`
**Status**: Create
**Purpose**: Email OTP login form component

#### Home Page Integration
**File**: `src/app/page.tsx`
**Status**: Modify
**Purpose**: Show HelloWorld component when authenticated, LoginForm when not authenticated

## Testing Strategy

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies (SES, Redis, Secrets Manager)
- Test error scenarios and edge cases

### Integration Tests
- Test API endpoints with real dependencies
- Test client-server communication
- Test authentication flow end-to-end

### E2E Tests
- Test complete user journey
- Test in both development and production environments
- Test error scenarios and recovery

## Environment Configuration

### Development
- Use environment variables from `.env.local`
- Mock email service for testing
- Use local Redis or in-memory storage

### Production
- Use Tencent Cloud Secrets Manager
- Real email delivery via Tencent SES
- Production Redis cluster

## Success Criteria

- Users can enter their email address to request an OTP
- OTP is sent via email using Tencent Cloud SES
- Users can verify OTP to login successfully
- Authenticated users see HelloWorld component and user email
- Users can logout and return to login form
- OTP codes expire after 5 minutes
- Session tokens are properly managed with JWT
- All secrets are managed via environment variables or Secrets Manager
- Application works in both development and production environments

## Open Questions

- Should we implement rate limiting for OTP requests to prevent spam?
- Do we need to add email validation beyond basic format checking?
- Should we implement refresh token rotation for enhanced security?
- Do we need to add logging for authentication events?
- Should we implement session timeout warnings for users?

## Rollback Plan

If any step fails:
1. Revert the commit (`git revert <commit-hash>`)
2. Identify the issue (check tests, logs, environment)
3. Fix the issue (update code, environment, or dependencies)
4. Re-commit with the fix
5. Continue from the failed step

---

**Total Estimated Time**: 2-3 days for full implementation
**Commit Frequency**: 1-2 commits per hour during active development
**Testing**: Each commit must pass all tests before proceeding