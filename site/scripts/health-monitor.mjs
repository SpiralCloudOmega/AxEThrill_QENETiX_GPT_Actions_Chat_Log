#!/usr/bin/env node
// Enhanced system monitoring and health checks
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

class HealthMonitor {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
    this.startTime = Date.now();
  }

  addCheck(name, checkFn, critical = false) {
    this.checks.set(name, { fn: checkFn, critical });
    return this;
  }

  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) throw new Error(`Unknown check: ${name}`);

    const start = Date.now();
    try {
      const result = await check.fn();
      const duration = Date.now() - start;
      this.results.set(name, {
        success: true,
        duration,
        critical: check.critical,
        ...result
      });
      return this.results.get(name);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.set(name, {
        success: false,
        duration,
        critical: check.critical,
        error: error.message
      });
      return this.results.get(name);
    }
  }

  async runAll() {
    console.log('🔍 Running health checks...\n');
    
    for (const [name] of this.checks) {
      const result = await this.runCheck(name);
      const status = result.success ? '✅' : (result.critical ? '🔴' : '⚠️');
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${name.padEnd(25)} ${duration.padStart(6)}`);
      
      if (result.message) {
        console.log(`   ${result.message}`);
      }
      
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
      
      console.log();
    }

    return this.generateReport();
  }

  generateReport() {
    const totalChecks = this.checks.size;
    const passed = Array.from(this.results.values()).filter(r => r.success).length;
    const criticalFailed = Array.from(this.results.values()).filter(r => !r.success && r.critical).length;
    const warnings = Array.from(this.results.values()).filter(r => !r.success && !r.critical).length;
    
    const overallHealth = criticalFailed === 0 ? (warnings === 0 ? 'healthy' : 'degraded') : 'unhealthy';
    const totalDuration = Date.now() - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      overallHealth,
      summary: {
        total: totalChecks,
        passed,
        warnings,
        critical_failures: criticalFailed
      },
      duration_ms: totalDuration,
      checks: Object.fromEntries(this.results)
    };

    // Write report to file
    const reportsDir = path.join(siteDir, 'public', 'health');
    fs.mkdirSync(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, 'detailed-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`📊 Health Summary:`);
    console.log(`   Overall: ${overallHealth.toUpperCase()}`);
    console.log(`   Passed: ${passed}/${totalChecks}`);
    if (warnings > 0) console.log(`   Warnings: ${warnings}`);
    if (criticalFailed > 0) console.log(`   Critical failures: ${criticalFailed}`);
    console.log(`   Duration: ${totalDuration}ms`);
    console.log(`   Report saved: ${path.relative(repoRoot, reportFile)}\n`);

    return report;
  }
}

// Define health checks
const monitor = new HealthMonitor()
  .addCheck('node_version', () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    return {
      message: `Node.js ${version}`,
      details: { minimum_required: 'v18.0.0', supported: major >= 18 }
    };
  }, true)

  .addCheck('dependencies', () => {
    const packagePath = path.join(siteDir, 'package.json');
    const nodeModulesPath = path.join(siteDir, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      throw new Error('node_modules not found - run npm install');
    }
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    
    return {
      message: `${deps + devDeps} packages installed`,
      details: { dependencies: deps, dev_dependencies: devDeps }
    };
  }, true)

  .addCheck('workspace_structure', () => {
    const requiredDirs = [
      'logs',
      'site/app',
      'site/components', 
      'site/scripts',
      'site/public'
    ];
    
    const missing = requiredDirs.filter(dir => 
      !fs.existsSync(path.join(repoRoot, dir))
    );
    
    if (missing.length > 0) {
      throw new Error(`Missing directories: ${missing.join(', ')}`);
    }
    
    return {
      message: 'All required directories present',
      details: { checked_directories: requiredDirs.length }
    };
  }, true)

  .addCheck('logs_content', () => {
    const logsDir = path.join(repoRoot, 'logs');
    
    const countMarkdownFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      
      let count = 0;
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          count += countMarkdownFiles(fullPath);
        } else if (item.endsWith('.md')) {
          count++;
        }
      }
      return count;
    };
    
    const logCount = countMarkdownFiles(logsDir);
    const incomingCount = countMarkdownFiles(path.join(logsDir, 'incoming'));
    
    return {
      message: `${logCount} total logs found`,
      details: { 
        total_logs: logCount,
        incoming_logs: incomingCount,
        processed_logs: logCount - incomingCount
      }
    };
  })

  .addCheck('generated_indexes', () => {
    const indexes = [
      { file: 'logs-index.json', name: 'Logs Index' },
      { file: 'health.json', name: 'Health Status' },
      { file: 'rag-index.json', name: 'RAG Index' },
      { file: 'feed.xml', name: 'RSS Feed' }
    ];
    
    const results = indexes.map(idx => {
      const filePath = path.join(siteDir, 'public', idx.file);
      const exists = fs.existsSync(filePath);
      let size = 0;
      let age = null;
      
      if (exists) {
        const stats = fs.statSync(filePath);
        size = stats.size;
        age = Date.now() - stats.mtime.getTime();
      }
      
      return { ...idx, exists, size, age_ms: age };
    });
    
    const existing = results.filter(r => r.exists);
    const stale = existing.filter(r => r.age_ms > 24 * 60 * 60 * 1000); // 24 hours
    
    return {
      message: `${existing.length}/${indexes.length} indexes present`,
      details: {
        existing_indexes: existing.map(r => r.name),
        stale_indexes: stale.map(r => `${r.name} (${Math.round(r.age_ms / (60 * 60 * 1000))}h old)`),
        total_size_bytes: existing.reduce((sum, r) => sum + r.size, 0)
      }
    };
  })

  .addCheck('memory_system', () => {
    const memoryDir = path.join(repoRoot, 'logs', 'memory');
    
    if (!fs.existsSync(memoryDir)) {
      return {
        message: 'Memory system not initialized',
        details: { memory_items: 0 }
      };
    }
    
    const countJsonFiles = (dir) => {
      let count = 0;
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
          count += countJsonFiles(fullPath);
        } else if (item.endsWith('.json') && !['index.json', 'rate-limits.json'].includes(item)) {
          count++;
        }
      }
      return count;
    };
    
    const memoryCount = countJsonFiles(memoryDir);
    const mcpLogsPath = path.join(memoryDir, 'mcp', 'index.json');
    let mcpRequests = 0;
    
    if (fs.existsSync(mcpLogsPath)) {
      try {
        const mcpIndex = JSON.parse(fs.readFileSync(mcpLogsPath, 'utf8'));
        mcpRequests = Array.isArray(mcpIndex) ? mcpIndex.length : 0;
      } catch (e) {
        // MCP index corrupted
      }
    }
    
    return {
      message: `${memoryCount} memory capsules`,
      details: {
        memory_capsules: memoryCount,
        mcp_requests: mcpRequests
      }
    };
  })

  .addCheck('build_system', () => {
    const outDir = path.join(siteDir, 'out');
    const nextDir = path.join(siteDir, '.next');
    
    const hasBuilt = fs.existsSync(outDir);
    const hasDev = fs.existsSync(nextDir);
    
    let buildSize = 0;
    if (hasBuilt) {
      const getDirectorySize = (dir) => {
        let size = 0;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            size += getDirectorySize(fullPath);
          } else {
            size += stats.size;
          }
        }
        return size;
      };
      buildSize = getDirectorySize(outDir);
    }
    
    return {
      message: hasBuilt ? 'Build artifacts present' : 'No build artifacts found',
      details: {
        production_build: hasBuilt,
        development_cache: hasDev,
        build_size_bytes: buildSize,
        build_size_mb: Math.round(buildSize / (1024 * 1024) * 100) / 100
      }
    };
  })

  .addCheck('git_repository', () => {
    const gitDir = path.join(repoRoot, '.git');
    
    if (!fs.existsSync(gitDir)) {
      throw new Error('Not a git repository');
    }
    
    try {
      const branch = execSync('git branch --show-current', { 
        cwd: repoRoot, 
        encoding: 'utf8' 
      }).trim();
      
      const commit = execSync('git rev-parse HEAD', { 
        cwd: repoRoot, 
        encoding: 'utf8' 
      }).trim();
      
      const status = execSync('git status --porcelain', { 
        cwd: repoRoot, 
        encoding: 'utf8' 
      }).trim();
      
      const uncommittedChanges = status.split('\n').filter(line => line.trim()).length;
      
      return {
        message: `On branch ${branch}`,
        details: {
          current_branch: branch,
          commit_hash: commit.slice(0, 12),
          uncommitted_changes: uncommittedChanges,
          clean_working_tree: uncommittedChanges === 0
        }
      };
    } catch (error) {
      throw new Error(`Git operations failed: ${error.message}`);
    }
  });

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  console.log('🏥 System Health Monitor\n');
  
  const report = await monitor.runAll();
  
  if (verbose) {
    console.log('📋 Full Report:');
    console.log(JSON.stringify(report, null, 2));
  }
  
  // Exit with appropriate code
  if (report.overallHealth === 'unhealthy') {
    process.exit(1);
  } else if (report.overallHealth === 'degraded') {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  });
}