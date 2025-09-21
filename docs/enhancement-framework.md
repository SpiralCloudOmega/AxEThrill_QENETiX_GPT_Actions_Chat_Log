# AxEThrill QENETiX Enhancement Framework Documentation

## Overview

This comprehensive enhancement framework provides enterprise-grade capabilities for the AxEThrill QENETiX Chat Log System, ensuring reliability, performance, and maintainability across environment refreshes.

## 🏗️ Architecture

### Core Components

1. **Session Recovery System** (`session-recovery.mjs`)
2. **Health Monitoring Suite** (`health-monitor.mjs`)
3. **Performance Optimization** (`performance-optimizer.mjs`)
4. **Error Diagnostics** (`error-diagnostics.mjs`)
5. **Development Utilities** (`dev-utils.mjs`)
6. **Comprehensive Testing** (`tests/`)
7. **Enhanced CI/CD Pipeline** (`.github/workflows/`)

## 🚀 Quick Start

### Initial Setup

```bash
cd site
npm run dev:setup          # Initialize development environment
npm run health:check       # Verify system health
npm run performance:optimize # Optimize for performance
```

### Daily Development Workflow

```bash
npm run dev:clean          # Clean build artifacts
npm run health:check       # Check system health
npm run dev                # Start development server
npm run dev:watch          # Auto-route incoming logs (separate terminal)
```

### Pre-deployment Validation

```bash
npm run diagnostics        # Run error diagnostics
npm run performance:benchmark # Run performance tests
npm run build              # Build with optimizations
```

## 📋 Component Details

### Session Recovery System

**Purpose**: Ensures work persistence across environment refreshes and maintains chat history.

**Key Features**:

- Automatic session state saving
- Environment refresh detection
- Chat history preservation
- Work state recovery

**Usage**:

```bash
# Test session recovery
node scripts/session-recovery.mjs --test

# Manual session save
node scripts/session-recovery.mjs --save

# Restore from backup
node scripts/session-recovery.mjs --restore
```

**Configuration**:

```json
{
  "sessionRecovery": {
    "enabled": true,
    "saveInterval": 300000,
    "maxBackups": 10,
    "chatHistoryPath": "logs/session/chat-history.json"
  }
}
```

### Health Monitoring Suite

**Purpose**: Comprehensive system health checks and monitoring.

**Monitored Components**:

- Node.js version compatibility
- Dependencies integrity
- Workspace structure
- Generated indexes
- Memory system
- Build artifacts
- Git repository status
- File permissions
- Disk space and memory usage

**Usage**:

```bash
# Quick health check
npm run health:check

# Detailed health report
npm run health:verbose

# Programmatic access
import { HealthMonitor } from './scripts/health-monitor.mjs';
const monitor = new HealthMonitor();
const report = await monitor.runAllChecks();
```

**Health Status Levels**:

- `healthy` - All systems operational
- `warning` - Minor issues detected
- `degraded` - Performance issues
- `critical` - Critical failures requiring attention

### Performance Optimization Framework

**Purpose**: Intelligent caching, build optimization, and automated performance tuning.

**Features**:

- Intelligent file-based caching with TTL
- Incremental build optimization
- Memory management and garbage collection
- Asset optimization and precompression
- Performance monitoring and alerting

**Usage**:

```bash
# Full optimization
npm run performance:optimize

# Cache management
npm run performance:cache        # Show cache status
npm run performance:cache clear  # Clear cache

# Configuration
npm run performance:config                    # Show config
npm run performance:config caching.enabled=false # Update config
```

**Optimization Features**:

1. **Intelligent Caching**:
   - File-based cache with SHA-256 keys
   - Automatic cache cleanup by size and age
   - Configurable TTL and size limits

2. **Build Optimization**:
   - Incremental builds based on file hashes
   - Parallel processing where possible
   - Asset optimization (JSON compression, etc.)
   - Pre-compression setup

3. **Memory Management**:
   - Automatic garbage collection
   - Memory usage monitoring
   - Stream processing for large files
   - Configurable memory limits

### Error Diagnostics

**Purpose**: Automated error detection and fix suggestions.

**Diagnostic Areas**:

- JSON syntax validation
- Package integrity checks
- GitHub workflow syntax
- File permissions
- Dependency security audit
- Configuration consistency

**Usage**:

```bash
# Run full diagnostics
npm run diagnostics

# Programmatic access
import { ErrorDiagnostics } from './scripts/error-diagnostics.mjs';
const diagnostics = new ErrorDiagnostics();
await diagnostics.runDiagnostics();
```

**Output Categories**:

- **Errors**: Critical issues requiring immediate attention
- **Warnings**: Issues that should be addressed
- **Suggestions**: Recommended fixes with risk levels

### Development Utilities

**Purpose**: Streamlined development workflow automation.

**Available Commands**:

```bash
npm run dev:setup     # Set up development environment
npm run dev:clean     # Clean build artifacts
npm run dev:watch     # Watch and auto-route logs
npm run dev:stats     # Show repository statistics
npm run health:check  # Quick health check
```

**Features**:

- Environment setup automation
- Build artifact management
- Live log routing
- System statistics
- Health monitoring integration

## 🧪 Testing Framework

### Test Suites

1. **MCP Server Tests** (`mcp.test.mjs`)
   - JSON-RPC protocol compliance
   - Authentication and rate limiting
   - Error handling and logging

2. **Ledger Tests** (`ledger.test.mjs`)
   - Token usage tracking
   - Budget management
   - Historical analysis

3. **Ingestion Tests** (`ingest-edge.test.mjs`)
   - Markdown parsing edge cases
   - File routing logic
   - Error recovery

### Running Tests

```bash
npm run test:mcp        # MCP server tests
npm run tools:test      # All tools tests
npm run test:integration # Integration tests (when available)
```

## 🔄 CI/CD Integration

### Enhanced GitHub Actions Pipeline

The CI/CD pipeline includes:

1. **Health Check Stage**:
   - System validation
   - Environment setup verification
   - Performance baseline establishment

2. **Build and Test Matrix**:
   - Parallel test execution (unit, integration, mcp, tools)
   - Performance optimization
   - Comprehensive artifact collection

3. **Performance Analysis**:
   - Full benchmark suite
   - Regression detection
   - Performance reporting

4. **Security Audit**:
   - Dependency vulnerability scanning
   - Security best practices validation

5. **Final Integration**:
   - Deployment readiness verification
   - Comprehensive reporting
   - Artifact preservation

### Workflow Files

- `ci.yml` - Main CI pipeline with comprehensive testing
- `continuous-agents.yml` - Automated AI agent processing
- `deploy-pages.yml` - GitHub Pages deployment
- `monthly-agents.yml` - Monthly maintenance
- `nightly-maintenance.yml` - Nightly optimizations
- `tools-test.yml` - Focused tools testing

## 📊 Monitoring and Alerting

### Performance Metrics

Tracked metrics include:

- Build times and optimization effectiveness
- Memory usage patterns
- Cache hit rates and effectiveness
- File I/O performance
- Git operation performance
- JSON parsing speed

### Health Indicators

Key health indicators:

- System resource utilization
- Dependency freshness
- Build artifact integrity
- Configuration consistency
- Security vulnerability status

### Alerting Thresholds

Default alert thresholds:

- Memory usage > 80%
- Disk usage > 90%
- Build time > 5 minutes
- Cache size > 100MB
- Performance regression > 50%

## 🛠️ Troubleshooting Guide

### Common Issues

#### Environment Refresh Recovery

**Issue**: Work lost after environment refresh
**Solution**:

```bash
node scripts/session-recovery.mjs --restore
npm run dev:setup
```

#### Performance Degradation

**Issue**: Slow build times or high memory usage
**Solution**:

```bash
npm run performance:optimize
npm run performance:cache clear
npm run diagnostics
```

#### Build Failures

**Issue**: Build process fails unexpectedly
**Solution**:

```bash
npm run dev:clean
npm run health:check
npm run diagnostics
npm run dev:setup
npm run build
```

#### Dependency Issues

**Issue**: Package installation or version conflicts
**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
npm audit fix
npm run diagnostics
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=* npm run health:check
DEBUG=performance* npm run performance:benchmark
```

## 🔧 Configuration

### Global Configuration Files

1. **`public/performance-config.json`** - Performance optimization settings
2. **`public/ui/config.json`** - UI and tag configuration
3. **`package.json`** - Scripts and dependencies
4. **`next.config.js`** - Next.js build configuration

### Environment Variables

```bash
# AI Provider Configuration
AI_PROVIDER=gemini              # gemini|openai|rag
AI_PROVIDER_FORCE=true          # Force specific provider
GEMINI_API_KEY=your_key_here    # Gemini API key
OPENAI_API_KEY=your_key_here    # OpenAI API key

# Build Configuration
NODE_ENV=production             # Environment mode
GITHUB_ACTIONS=true             # CI environment detection
NEXT_TELEMETRY_DISABLED=1       # Disable Next.js telemetry

# Performance Tuning
BATCH_GUARD_LIMIT=150           # Token batch limit (thousands)
```

## 📈 Performance Optimization

### Best Practices

1. **Caching Strategy**:
   - Enable intelligent caching for repeated operations
   - Regular cache cleanup to prevent disk bloat
   - Monitor cache hit rates

2. **Build Optimization**:
   - Use incremental builds when possible
   - Enable asset optimization
   - Monitor build artifact sizes

3. **Memory Management**:
   - Enable automatic garbage collection
   - Use stream processing for large files
   - Monitor memory usage patterns

4. **Monitoring**:
   - Regular health checks
   - Performance benchmarking
   - Proactive error detection

### Performance Tuning

```bash
# Optimize for development
npm run performance:config build.incrementalBuilds=true
npm run performance:config memory.autoGC=true

# Optimize for production
npm run performance:config build.assetOptimization=true
npm run performance:config build.precompression=true

# Monitor performance
npm run performance:benchmark
npm run performance:history
```

## 🔐 Security

### Security Features

1. **Dependency Scanning**: Automated vulnerability detection
2. **File Permission Validation**: Ensures proper access controls
3. **Configuration Validation**: Prevents security misconfigurations
4. **Input Sanitization**: Protects against injection attacks

### Security Checklist

- [ ] Regular dependency updates (`npm audit fix`)
- [ ] Proper file permissions on scripts
- [ ] Secure API key management
- [ ] Regular security scans
- [ ] Configuration validation

## 📚 API Reference

### Health Monitor API

```javascript
import { HealthMonitor } from './scripts/health-monitor.mjs';

const monitor = new HealthMonitor();

// Run all checks
const report = await monitor.runAllChecks(verbose = false);

// Run specific check
const result = await monitor.runCheck('node_version');

// Add custom check
monitor.addCheck('custom_check', async () => {
  return { message: 'Custom check result', details: {} };
}, critical = false);
```

### Performance Optimizer API

```javascript
import { PerformanceOptimizer } from './scripts/performance-optimizer.mjs';

const optimizer = new PerformanceOptimizer();
await optimizer.initialize();

// Run optimization
const result = await optimizer.optimizeBuild();

// Cache operations
const cacheKey = await optimizer.getCacheKey('operation', inputs);
const cached = await optimizer.getCachedResult(cacheKey);
await optimizer.setCachedResult(cacheKey, result);

// Generate report
const report = await optimizer.generateOptimizationReport();
```

## 🚀 Advanced Usage

### Custom Health Checks

```javascript
// Add custom health check
monitor.addCheck('database_connection', async () => {
  // Custom logic
  return {
    message: 'Database connection healthy',
    details: { response_time: '50ms', connections: 5 }
  };
}, true); // Mark as critical
```

### Custom Performance Optimizations

```javascript
// Custom optimization
await optimizer.benchmarkOperation('custom_operation', async () => {
  // Your operation here
}, iterations = 5);
```

### Integration with External Systems

```javascript
// Integration example
const healthStatus = await monitor.runAllChecks();
if (healthStatus.status !== 'healthy') {
  // Send alert to external monitoring system
  await sendAlert(healthStatus);
}
```

## 📞 Support

### Getting Help

1. **Documentation**: Check this comprehensive guide
2. **Health Check**: Run `npm run health:check` for system status
3. **Diagnostics**: Run `npm run diagnostics` for detailed error analysis
4. **Logs**: Check `logs/session/` for session recovery information

### Reporting Issues

When reporting issues, include:

- Output from `npm run health:check`
- Output from `npm run diagnostics`
- System information (`node --version`, `npm --version`)
- Steps to reproduce the issue

---

*This documentation is automatically maintained as part of the AxEThrill QENETiX Enhancement Framework.*
