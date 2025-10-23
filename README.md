# RIV MVP

A China-accessible file sharing application built with Next.js.

## Development Setup

### Prerequisites
- Node.js 18+ and npm 8+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd riv-mvp
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Start development services:**
   ```bash
   chmod +x scripts/dev-setup.sh
   ./scripts/dev-setup.sh
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

### Development Services

The development environment includes:
- **Redis** (localhost:6379) - For OTP storage and session management
- **MailHog** (localhost:8025) - For email testing and development

### Useful Commands

```bash
# Start development services
./scripts/dev-setup.sh

# Stop development services
docker-compose -f docker-compose.dev.yml down

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check
```

### Environment Variables

See `.env.local.example` for all required environment variables.
Key variables for development:
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `REDIS_URL` - Set to `redis://localhost:6379` for local development
- `TENCENT_SES_*` - Your Tencent Cloud SES credentials

## Authentication System

### Architecture Overview

The authentication system uses a stateless JWT-based approach with email OTP verification:

1. **User requests OTP** → System generates 6-digit code and stores in Redis
2. **User submits OTP** → System validates code and issues JWT tokens
3. **Session management** → Access and refresh tokens for secure API access
4. **Token validation** → Middleware validates tokens on protected routes

### Security Features

- **JWT Tokens**: Stateless authentication with configurable expiration
- **OTP Storage**: Redis-backed temporary storage with automatic cleanup
- **Email Security**: Tencent Cloud SES for China-accessible email delivery
- **Environment Isolation**: Separate dev/prod configurations
- **Secret Management**: Environment-based secret handling with validation

### Data Protection

- **No Password Storage**: Email-only authentication eliminates password risks
- **Temporary OTPs**: Codes expire automatically (5-10 minutes)
- **Secure Tokens**: JWT secrets are environment-specific and validated
- **China Compliance**: Uses Tencent Cloud services for regional accessibility

### Development vs Production

| Component | Development | Production |
|-----------|-------------|------------|
| Email | MailHog (localhost:8025) | Tencent Cloud SES |
| Storage | Redis (localhost:6379) | Redis Cloud/Managed |
| Secrets | Environment variables | Tencent Cloud Secrets Manager |
| Monitoring | Console logs | Structured logging + metrics |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

[Add contact information]
