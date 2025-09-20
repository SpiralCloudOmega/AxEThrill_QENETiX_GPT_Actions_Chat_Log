# Developer Quick Start Guide

## Essential Commands

### Development Workflow
```bash
# Start development
cd site
npm run prebuild    # Generate indexes
npm run dev         # Start dev server

# Test everything
npm run test:all    # All test suites
npm run health      # System health check
npm run perf        # Performance benchmark

# Build and deploy
npm run build       # Production build
npm run diagnose    # Final health check
```

### Monitoring Commands
```bash
# System health
npm run health          # Quick health check
npm run health:verbose  # Detailed health report

# Performance monitoring
npm run perf           # Full benchmark suite
npm run perf:quick     # Essential benchmarks only
npm run perf:history   # Performance trends

# Error diagnostics
npm run diagnose       # Comprehensive error check
```

### Development Utils
```bash
# Cache management
npm run cache:clear    # Clear all caches
npm run memory:optimize # Optimize memory usage

# Optimized builds
npm run prebuild:optimized  # Cached prebuild
```

## Key Files to Know

### Configuration
- `site/package.json` - Scripts and dependencies
- `site/public/ui/config.json` - Tag aliases and UI settings
- `.github/copilot-instructions.md` - AI agent guidance

### Monitoring Scripts
- `site/scripts/health-monitor.mjs` - System health checks
- `site/scripts/performance-monitor.mjs` - Performance benchmarks  
- `site/scripts/error-diagnostics.mjs` - Error detection

### Core Libraries
- `site/scripts/lib/error-handling.mjs` - Error handling utilities
- `site/scripts/lib/performance.mjs` - Performance optimization
- `site/scripts/lib/logging.mjs` - Structured logging

## Testing

### Test Files
- `site/scripts/tools/test.mjs` - Tools functionality
- `site/scripts/tests/ledger.test.mjs` - Token tracking
- `site/scripts/tests/ingest-edge.test.mjs` - Content processing
- `site/scripts/tests/mcp.test.mjs` - MCP server integration

### Running Tests
```bash
npm run tools:test      # Tools test only
npm run test:ledger     # Ledger test only  
npm run test:ingest-edge # Ingest test only
npm run test:mcp        # MCP test only
npm run test:all        # All tests
```

## Common Tasks

### Adding New Monitoring
1. Create script in `site/scripts/`
2. Add npm script in `package.json`
3. Follow error handling patterns
4. Add to health checks if needed

### Fixing Test Failures
1. Run `npm run diagnose` to identify issues
2. Check specific test with individual commands
3. Fix issues and re-run `npm run test:all`

### Performance Optimization
1. Run `npm run perf` to baseline
2. Make changes
3. Run `npm run perf` again to compare
4. Use `npm run perf:history` for trends

### Debugging Build Issues
1. Run `npm run health` for system status
2. Run `npm run diagnose` for detailed errors
3. Check generated files in `site/public/`
4. Verify with `npm run lint`

## Architecture Quick Reference

### Build Pipeline
1. `npm run prebuild` - Generate all indexes
2. `npm run build` - Next.js static build
3. `npm run postbuild` - Bundle analysis

### Monitoring Pipeline  
1. Health checks validate system state
2. Performance benchmarks track metrics
3. Error diagnostics catch issues
4. Reports saved to `site/public/`

### Data Flow
1. Logs in `logs/` organized by date
2. Memory capsules in `logs/memory/`
3. Indexes generated in `site/public/`
4. UI consumes static indexes

## Need Help?

- Check `docs/ENHANCEMENTS.md` for comprehensive documentation
- Run `npm run diagnose` for automated issue detection
- Look at existing scripts for patterns
- All monitoring commands provide detailed output