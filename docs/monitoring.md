# Monitoring and Diagnostics Guide

## Overview

The AxEThrill QENETiX system includes comprehensive monitoring, performance benchmarking, and automated diagnostics to ensure system health and optimal performance.

## Health Monitoring

### Quick Health Check

```bash
npm run health
```

Example output:
```
🔍 Running health checks...

✅ node_version              12ms
✅ dependencies              45ms
✅ workspace_structure       8ms
✅ logs_content             23ms
✅ generated_indexes         15ms
✅ memory_system            31ms
✅ build_system             67ms
✅ git_repository           89ms

📊 Health Summary:
   Overall: HEALTHY
   Passed: 8/8
   Duration: 290ms
```

### Detailed Health Report

```bash
npm run health:verbose
```

Provides comprehensive system information including:
- Node.js version and compatibility
- Dependency installation status
- Directory structure validation
- Log file counts and organization
- Generated index file status and age
- Memory capsule counts
- Build artifact analysis
- Git repository status

### Health Check Categories

#### Critical Checks (System Failure if Failed)
- **Node.js Version**: Ensures Node.js v18+ compatibility
- **Dependencies**: Validates node_modules installation
- **Workspace Structure**: Confirms required directories exist

#### Warning Checks (Degraded Performance if Failed)
- **Logs Content**: Analyzes log file organization
- **Generated Indexes**: Checks index freshness and size
- **Memory System**: Validates memory capsule integrity
- **Build System**: Examines build artifacts
- **Git Repository**: Verifies version control status

### Health Report Storage

Reports are saved to `site/public/health/detailed-report.json`:

```json
{
  "timestamp": "2025-01-20T10:30:45.123Z",
  "overallHealth": "healthy",
  "summary": {
    "total": 8,
    "passed": 8,
    "warnings": 0,
    "critical_failures": 0
  },
  "duration_ms": 290,
  "checks": {
    "node_version": {
      "success": true,
      "duration": 12,
      "critical": true,
      "message": "Node.js v20.10.0",
      "details": {
        "minimum_required": "v18.0.0",
        "supported": true
      }
    }
  }
}
```

## Performance Monitoring

### Full Benchmark Suite

```bash
npm run perf
```

Runs comprehensive performance benchmarks:

```
🚀 Performance Benchmark Suite

💻 System Information:
   Node.js: v20.10.0
   Platform: linux x64
   Memory: 45MB heap used
   Uptime: 127s

🏃 Benchmarking file_io_write (3 iterations)...
🏃 Benchmarking directory_listing (3 iterations)...
🏃 Benchmarking json_parse (3 iterations)...

📊 Benchmark Summary:
   file_io_write             12.5ms avg (±2.1)
   directory_listing         8.3ms avg (±1.5)
   json_parse               3.2ms avg (±0.8)
```

### Quick Performance Check

```bash
npm run perf:quick
```

Runs essential file operation benchmarks only.

### Performance History

```bash
npm run perf:history
```

Shows recent benchmark trends:

```
📈 Recent Benchmark History:

1/20/2025, 10:30:45 AM - file_io_write: 12.5ms avg
1/20/2025, 10:25:30 AM - file_io_write: 13.1ms avg
1/20/2025, 10:20:15 AM - file_io_write: 11.8ms avg
```

### Benchmark Categories

#### File Operations
- **File I/O Write**: 10KB file creation/deletion
- **Directory Listing**: Recursive directory scanning
- **JSON Parsing**: Large JSON object processing

#### Build Operations
- **Prebuild Simulation**: Index generation timing
- **Index Reading**: Generated file loading performance

#### Memory Operations
- **Memory Allocation**: Array creation benchmarks
- **String Manipulation**: Large string processing

#### Git Operations
- **Git Status**: Working directory status check
- **Git Log**: Recent commit history retrieval

### Performance Reports

Results saved to `site/public/performance/`:
- `report.json` - Latest comprehensive report
- `benchmarks.jsonl` - Historical benchmark log (JSONL format)

```json
{
  "timestamp": "2025-01-20T10:30:45.123Z",
  "system": {
    "node_version": "v20.10.0",
    "platform": "linux",
    "arch": "x64",
    "memory": {
      "rss": 47234048,
      "heapTotal": 20971520,
      "heapUsed": 15234567
    }
  },
  "recent_benchmarks": [
    {
      "label": "file_io_write",
      "iterations": 3,
      "statistics": {
        "average": 12.5,
        "minimum": 10.2,
        "maximum": 15.8,
        "stddev": 2.1
      }
    }
  ]
}
```

### Performance Analysis

The system automatically identifies:

#### Slow Operations (>1000ms)
Operations taking longer than 1 second are flagged for optimization.

#### Inconsistent Performance (High Variance)
Operations with >30% variance indicate system instability or resource contention.

## Error Diagnostics

### Automated Error Detection

```bash
npm run diagnose
```

Comprehensive automated diagnostics:

```
🔍 Running Error Diagnostics

🔍 Checking JSON syntax...
   ✅ package.json
   ✅ tsconfig.json
   ✅ public/ui/config.json

📦 Checking package integrity...
   ✅ Package structure valid

⚙️ Checking GitHub workflows...
   ✅ continuous-agents.yml
   ✅ ci.yml
   ✅ deploy-pages.yml

📊 Diagnostics Summary:
   Errors: 0
   Warnings: 2
   Suggested fixes: 1

⚠️  Warnings:
   workflow_style: Unquoted wildcard may cause issues (.github/workflows/ci.yml:25)
      💡 Quote wildcard patterns: "*" instead of *
```

### Diagnostic Categories

#### JSON Syntax Validation
- **package.json**: Dependency and script validation
- **tsconfig.json**: TypeScript configuration
- **Configuration files**: UI and system config validation

#### Package Integrity
- **Required fields**: name, version, scripts validation
- **Script references**: Validates script file existence
- **Dependency sync**: package.json vs package-lock.json timing

#### Workflow Validation
- **YAML syntax**: GitHub Actions workflow validation
- **Template expressions**: ${{ }} syntax checking
- **Indentation**: Consistent spacing validation

#### Security Analysis
- **Dependency vulnerabilities**: npm audit integration
- **File permissions**: Script executability check
- **Configuration exposure**: Sensitive data detection

### Error Report Structure

Saved to `site/public/diagnostics/error-report.json`:

```json
{
  "timestamp": "2025-01-20T10:30:45.123Z",
  "summary": {
    "errors": 0,
    "warnings": 2,
    "suggested_fixes": 1
  },
  "errors": [],
  "warnings": [
    {
      "category": "workflow_style",
      "message": "Unquoted wildcard may cause issues",
      "file": ".github/workflows/ci.yml",
      "suggestion": "Quote wildcard patterns: \"*\" instead of *",
      "timestamp": "2025-01-20T10:30:45.123Z"
    }
  ],
  "suggested_fixes": [
    {
      "description": "Fix workflow wildcard quoting",
      "action": "Add quotes around * patterns in YAML files",
      "risk": "low",
      "timestamp": "2025-01-20T10:30:45.123Z"
    }
  ]
}
```

### Exit Codes

All monitoring tools use consistent exit codes:

- **0**: No issues found
- **1**: Critical errors detected (system unusable)
- **2**: Warnings detected (degraded performance)

## Integration with CI/CD

### GitHub Actions Integration

Health checks are integrated into CI workflows:

```yaml
- name: Run Health Checks
  run: npm run health
  
- name: Run Diagnostics
  run: npm run diagnose
  
- name: Performance Baseline
  run: npm run perf:quick
```

### Automated Monitoring

The system can be configured for automated monitoring:

```bash
# Cron job example (every hour)
0 * * * * cd /path/to/project && npm run health >> logs/health.log 2>&1
```

### Alert Integration

Exit codes enable integration with monitoring systems:

```bash
#!/bin/bash
# Monitoring script example
npm run health
HEALTH_STATUS=$?

if [ $HEALTH_STATUS -eq 1 ]; then
    echo "CRITICAL: System health check failed"
    # Send alert
elif [ $HEALTH_STATUS -eq 2 ]; then
    echo "WARNING: System health degraded"
    # Send warning
fi
```

## Monitoring Dashboard

### Generated Reports

All monitoring data is available as JSON endpoints:

- `/health/detailed-report.json` - Latest health status
- `/performance/report.json` - Performance metrics
- `/diagnostics/error-report.json` - Error analysis

### Custom Monitoring

Build custom monitoring dashboards using the JSON APIs:

```javascript
// Example: Fetch health status
const response = await fetch('/health/detailed-report.json');
const health = await response.json();

console.log(`System health: ${health.overallHealth}`);
console.log(`Checks passed: ${health.summary.passed}/${health.summary.total}`);
```

## Troubleshooting Monitoring Issues

### Health Check Failures

```bash
# Check Node.js version
node --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify workspace structure
ls -la logs/ site/ docs/
```

### Performance Degradation

```bash
# Check system resources
npm run perf

# Analyze historical trends
npm run perf:history

# Clean build artifacts
npm run dev-utils clean
```

### Diagnostic Tool Issues

```bash
# Verify script permissions
chmod +x site/scripts/*.mjs

# Check JSON syntax manually
node -e "JSON.parse(require('fs').readFileSync('site/package.json', 'utf8'))"

# Validate GitHub workflows
npx @github/workflows validate .github/workflows/
```

## Best Practices

### Regular Monitoring

- Run `npm run health` before major deployments
- Monitor performance with `npm run perf` weekly
- Use `npm run diagnose` after system changes

### Automated Integration

- Include health checks in CI/CD pipelines
- Set up automated performance baselines
- Configure alerts for critical failures

### Report Analysis

- Review performance trends over time
- Address warnings before they become errors
- Monitor system resource usage patterns

### Maintenance

- Clean up old performance logs periodically
- Update monitoring thresholds as system evolves
- Document any custom monitoring integrations