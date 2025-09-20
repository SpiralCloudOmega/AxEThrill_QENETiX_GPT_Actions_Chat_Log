# Development Guide

## Overview

The AxEThrill QENETiX Chat Log System is a local-first AI chat log management system built with Next.js 14 and Node.js. This guide covers development workflows, testing procedures, monitoring, and troubleshooting.

## Quick Start

```bash
# Setup
cd site
npm install

# Generate indexes and start development
npm run prebuild
npm run dev

# Run health checks
npm run health

# Run full test suite
npm run test:all
```

## Development Workflow

### Project Structure

```
site/
├── app/                    # Next.js 14 app router pages
├── components/            # React components
├── scripts/              # Node.js automation scripts
│   ├── tests/           # Test files
│   ├── tools/           # Reusable utilities
│   └── agents/          # AI agent scripts
├── public/              # Static assets and generated indexes
└── package.json         # Dependencies and scripts
```

### Core Scripts

#### Development Utilities
```bash
npm run dev-utils clean         # Clean build artifacts
npm run dev-utils dev-setup     # Setup development environment
npm run dev-utils quick-build   # Fast build without full prebuild
npm run dev-utils check-health  # Quick health check
npm run dev-utils watch-logs    # Watch logs directory for changes
npm run dev-utils stats         # Show project statistics
```

#### Build Pipeline
```bash
npm run prebuild              # Generate indexes (REQUIRED before build)
npm run build                 # Next.js build
npm run postbuild            # Generate bundle report
```

#### Testing
```bash
npm run test:all             # Run all tests
npm run test:ledger          # Test token ledger functionality
npm run test:ingest-edge     # Test markdown ingestion edge cases
npm run test:mcp            # Test MCP server functionality
npm run tools:test          # Test utility tools
```

#### Monitoring & Diagnostics
```bash
npm run health              # Run health checks
npm run health:verbose      # Detailed health report
npm run perf               # Full performance benchmark
npm run perf:quick         # Quick performance check
npm run perf:history       # Show benchmark history
npm run diagnose           # Error detection and diagnostics
```

### Essential Development Commands

#### Log Management
```bash
npm run route:logs          # Route incoming logs to dated folders
npm run watch:incoming      # Auto-route logs every 3 seconds
npm run save:chat          # Save chat conversation as log
```

#### AI Operations
```bash
npm run ai:ask             # Ask AI a question
npm run ai:chat            # Interactive AI chat
npm run ai:rag             # RAG-only mode
npm run ai:inbox           # Process inbox with AI
npm run ai:agents          # Run multi-agent orchestration
```

#### Search & Indexing
```bash
npm run rag:build          # Build RAG search index
npm run rag:extract        # Extract content for RAG
npm run learn              # Update learning system
```

## Testing Guide

### Test Categories

1. **Unit Tests**: Test individual functions and utilities
2. **Integration Tests**: Test script interactions and workflows
3. **Edge Case Tests**: Test markdown processing and error handling
4. **System Tests**: Test complete workflows and health checks

### Running Tests

```bash
# Run specific test categories
npm run test:ledger          # Token ledger and rate limiting
npm run test:ingest-edge     # Markdown ingestion edge cases
npm run test:mcp            # MCP server functionality
npm run tools:test          # Utility tool validation

# Run all tests
npm run test:all

# Continuous testing during development
npm run dev-utils watch-logs  # Watch for log changes
```

### Test Files

- `scripts/tests/ledger.test.mjs` - Token tracking and rate limiting
- `scripts/tests/ingest-edge.test.mjs` - Markdown processing edge cases
- `scripts/tests/mcp.test.mjs` - MCP server validation
- `scripts/tools/test.mjs` - Tool functionality tests

### Writing Tests

```javascript
// Test structure example
class TestRunner {
  async runTest(name, testFn) {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      return { success: true };
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// Usage
const runner = new TestRunner();
await runner.runTest('validate input', () => {
  // Test implementation
});
```

## Monitoring & Health Checks

### Health Monitoring

The system includes comprehensive health monitoring:

```bash
npm run health              # Basic health check
npm run health:verbose      # Detailed report with full context
```

Health checks include:
- Node.js version compatibility
- Dependency installation status
- Workspace structure validation
- Generated index file status
- Memory system integrity
- Build system status
- Git repository health

### Performance Monitoring

```bash
npm run perf               # Full benchmark suite
npm run perf:quick         # Quick performance check
npm run perf:history       # Historical performance data
```

Performance benchmarks:
- File I/O operations
- Directory listing
- JSON parsing
- Build operations
- Memory allocation
- Git operations

### Error Diagnostics

```bash
npm run diagnose           # Automated error detection
```

Diagnostic checks:
- JSON syntax validation
- Package integrity
- Workflow syntax
- File permissions
- Dependency vulnerabilities
- Configuration consistency

## Configuration

### Environment Variables

```bash
# AI Provider Configuration
AI_PROVIDER=gemini|openai|rag
AI_PROVIDER_FORCE=true
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key

# Build Configuration
GITHUB_ACTIONS=true        # Enables GitHub Pages basePath
NODE_ENV=production|development

# Rate Limiting
BATCH_GUARD_LIMIT=150      # Token limit in thousands
```

### Configuration Files

- `package.json` - Dependencies and scripts
- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript settings
- `public/ui/config.json` - UI configuration and tag aliases
- `.github/workflows/` - CI/CD workflows

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check system health first
npm run health

# Verify dependencies
npm install

# Clean and rebuild
npm run dev-utils clean
npm run prebuild
npm run build
```

#### Missing Indexes
```bash
# Regenerate all indexes
npm run prebuild

# Check specific indexes
ls -la public/*.json
```

#### Performance Issues
```bash
# Run performance benchmarks
npm run perf

# Check for slow operations
npm run perf:history
```

#### JSON Syntax Errors
```bash
# Automated diagnostics
npm run diagnose

# Manual validation
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

### Error Recovery

1. **Build Pipeline Errors**:
   ```bash
   npm run dev-utils clean
   npm run dev-utils dev-setup
   npm run prebuild
   ```

2. **Dependency Issues**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Corrupted Indexes**:
   ```bash
   rm public/*.json
   npm run prebuild
   ```

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* npm run <command>
NODE_DEBUG=* npm run <command>
```

### Log Analysis

```bash
# Watch logs in real-time
npm run dev-utils watch-logs

# Analyze log patterns
grep -r "ERROR" logs/
```

## Performance Optimization

### Build Performance

- Use `npm run dev-utils quick-build` for faster development builds
- Run `npm run prebuild` only when indexes need updating
- Use `npm run perf` to identify bottlenecks

### Memory Management

- Monitor memory usage with `npm run perf`
- Clean build artifacts regularly with `npm run dev-utils clean`
- Use streaming for large file operations

### Caching Strategies

- Leverage Next.js built-in caching
- Cache generated indexes when possible
- Use efficient file watching patterns

## Contributing

### Code Standards

- Use ES modules (`.mjs` files)
- Follow TypeScript strict mode
- Include error handling in all scripts
- Add tests for new functionality

### Commit Messages

```
type: description

- feat: new feature
- fix: bug fix
- docs: documentation
- test: test updates
- perf: performance improvement
```

### Pull Request Process

1. Run full test suite: `npm run test:all`
2. Check health: `npm run health`
3. Run diagnostics: `npm run diagnose`
4. Update documentation if needed

## Advanced Topics

### MCP Server Development

The Model Context Protocol server provides JSON-RPC 2.0 endpoints:

```bash
npm run mcp:serve          # Start MCP server
npm run test:mcp          # Test MCP functionality
```

### Agent Development

AI agents use structured orchestration:

```bash
npm run ai:agents         # Multi-agent orchestration
npm run ai:agent-zero     # Single agent execution
```

### RAG System

The Retrieval-Augmented Generation system uses TF-IDF indexing:

```bash
npm run rag:build         # Build search index
npm run rag:extract       # Extract content
npm run ai:rag            # RAG-only queries
```

## External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Model Context Protocol](https://spec.modelcontextprotocol.io/)