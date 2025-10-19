# RIV MVP: China-Accessible File Sharing App

## 🏗️ Architecture Overview

A lightweight, test-driven architecture for experimenting with China-accessible file sharing approaches.

### Core Requirements

#### 1. **Multi-Provider Testing Framework**
- **Purpose**: Test different hosting/CDN providers for China accessibility
- **Approach**: Modular architecture where we can swap providers without code changes
- **Providers to test**: 
  - Vercel (global edge)
  - Netlify (global edge)
  - Cloudflare Pages
  - Alibaba Cloud (China-optimized)
  - Tencent Cloud (China-optimized)

#### 2. **Progressive Testing Strategy**
```
Phase 1: Basic Connectivity Test
├── Simple "Hello World" page
├── Test URL accessibility from China
└── Measure response times

Phase 2: Static File Serving
├── Serve static files (images, PDFs)
├── Test download speeds from China
└── Compare CDN performance

Phase 3: Dynamic File Upload/Download
├── File upload functionality
├── File storage testing
└── Authentication testing

Phase 4: Full File Sharing
├── User accounts
├── File sharing links
└── Real-world usage testing
```

#### 3. **Technical Architecture**

**Frontend Stack:**
- **Framework**: Next.js 14 (App Router) - for static generation and edge deployment
- **Styling**: Tailwind CSS - lightweight, no external dependencies
- **State**: Zustand - minimal state management
- **Testing**: Vitest + Testing Library

**Backend/Storage Options:**
- **Option A**: Serverless functions (Vercel/Netlify)
- **Option B**: Edge functions (Cloudflare Workers)
- **Option C**: Traditional VPS (DigitalOcean/Linode)
- **Option D**: China-based hosting (Alibaba Cloud)

**Database/Storage Testing:**
- **Option A**: Supabase (PostgreSQL + Storage)
- **Option B**: PlanetScale (MySQL)
- **Option C**: MongoDB Atlas
- **Option D**: China-based: Alibaba Cloud RDS + OSS

**Authentication Testing:**
- **Option A**: Supabase Auth (email/password)
- **Option B**: Clerk (email/password)
- **Option C**: Custom JWT implementation
- **Option D**: China-based: Alibaba Cloud RAM

#### 4. **Testing Infrastructure**

**Automated Testing:**
- **Connectivity Tests**: Ping different endpoints from various regions
- **Performance Tests**: Measure load times from China vs. other regions
- **File Upload/Download Tests**: Test different file sizes and types
- **Authentication Tests**: Test login flows and session management

**Manual Testing:**
- **China VPN Testing**: Use VPN to test from China perspective
- **Real User Testing**: Deploy to different providers and test access
- **Performance Monitoring**: Track response times and success rates

#### 5. **MVP Development Phases**

**Phase 1: Hello World Test**
```
├── Deploy simple Next.js app to multiple providers
├── Test URL accessibility from China
├── Measure response times
└── Document which providers work best
```

**Phase 2: Static File Serving**
```
├── Add file upload (client-side only)
├── Test file serving from different CDNs
├── Measure download speeds
└── Test different file types and sizes
```

**Phase 3: Database Integration**
```
├── Test different database providers
├── Test file storage solutions
├── Measure database response times from China
└── Test data persistence and retrieval
```

**Phase 4: Authentication**
```
├── Test different auth providers
├── Test SMS authentication (if available)
├── Test email authentication
└── Test session management
```

#### 6. **Repository Structure**
```
riv-mvp/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Next.js pages
│   ├── lib/                # Utility functions
│   ├── providers/          # Different provider implementations
│   └── types/              # TypeScript types
├── tests/
│   ├── connectivity/       # Connectivity tests
│   ├── performance/        # Performance tests
│   └── integration/        # Integration tests
├── scripts/
│   ├── deploy/            # Deployment scripts
│   └── test/              # Testing scripts
├── docs/
│   ├── architecture.md    # Architecture decisions
│   ├── test-results.md    # Test results and findings
│   └── deployment.md      # Deployment guides
└── config/
    ├── providers/         # Provider configurations
    └── environments/       # Environment configs
```

#### 7. **Key Testing Metrics**
- **Accessibility**: Can the URL be accessed from China?
- **Response Time**: How fast is the initial page load?
- **File Upload Speed**: How fast can files be uploaded?
- **File Download Speed**: How fast can files be downloaded?
- **Authentication Success Rate**: How reliable is user authentication?
- **Database Response Time**: How fast are database operations?

#### 8. **Success Criteria**
- **Phase 1**: URL accessible from China within 3 seconds
- **Phase 2**: File upload/download works reliably from China
- **Phase 3**: Database operations complete within 5 seconds
- **Phase 4**: Authentication works consistently from China

## 🎯 Goals

This architecture allows you to:
1. **Test incrementally** - start with simple connectivity
2. **Swap providers easily** - modular design for A/B testing
3. **Measure performance** - built-in testing and monitoring
4. **Scale gradually** - from static to dynamic to full-featured
5. **Document findings** - track what works and what doesn't

## 📋 Next Steps

1. **Phase 1 Implementation**: Create Hello World Next.js app
2. **Multi-Provider Deployment**: Deploy to Vercel, Netlify, Cloudflare
3. **China Accessibility Testing**: Test URL access from China
4. **Performance Measurement**: Document response times and success rates
5. **Provider Comparison**: Create comparison matrix of results

## 🔗 Related Documents

- [Architecture Decisions](architecture.md)
- [Test Results](test-results.md)
- [Deployment Guide](deployment.md)

