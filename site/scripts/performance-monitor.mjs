#!/usr/bin/env node
// Performance monitoring and benchmarking utilities
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

class PerformanceProfiler {
  constructor() {
    this.metrics = new Map();
    this.baselines = new Map();
    this.sessions = [];
  }

  startTiming(label) {
    const start = performance.now();
    this.metrics.set(label, { start, end: null, duration: null });
    return start;
  }

  endTiming(label) {
    const metric = this.metrics.get(label);
    if (!metric) throw new Error(`No timing started for: ${label}`);
    
    metric.end = performance.now();
    metric.duration = metric.end - metric.start;
    
    return metric.duration;
  }

  recordMetric(label, value, unit = 'ms') {
    this.metrics.set(label, { value, unit, timestamp: Date.now() });
  }

  async benchmarkOperation(label, operation, iterations = 3) {
    const results = [];
    
    console.log(`🏃 Benchmarking ${label} (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const duration = performance.now() - start;
      results.push(duration);
      
      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avg = results.reduce((sum, val) => sum + val, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const stddev = Math.sqrt(
      results.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / results.length
    );
    
    const benchmark = {
      label,
      iterations,
      results,
      statistics: {
        average: Math.round(avg * 100) / 100,
        minimum: Math.round(min * 100) / 100,
        maximum: Math.round(max * 100) / 100,
        stddev: Math.round(stddev * 100) / 100
      }
    };
    
    this.recordBenchmark(benchmark);
    return benchmark;
  }

  recordBenchmark(benchmark) {
    const timestamp = new Date().toISOString();
    const session = { timestamp, ...benchmark };
    this.sessions.push(session);
    
    // Save to file for historical tracking
    const perfDir = path.join(siteDir, 'public', 'performance');
    fs.mkdirSync(perfDir, { recursive: true });
    
    const perfFile = path.join(perfDir, 'benchmarks.jsonl');
    fs.appendFileSync(perfFile, JSON.stringify(session) + '\n');
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      metrics: Object.fromEntries(this.metrics),
      recent_benchmarks: this.sessions.slice(-10)
    };

    const reportsDir = path.join(siteDir, 'public', 'performance');
    fs.mkdirSync(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, 'report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    return report;
  }
}

// Define benchmark operations
async function benchmarkFileOperations(profiler) {
  const testDir = path.join(siteDir, '.temp-benchmark');
  
  // Setup
  fs.mkdirSync(testDir, { recursive: true });
  
  try {
    // File I/O benchmark
    await profiler.benchmarkOperation('file_io_write', async () => {
      const testFile = path.join(testDir, `test-${Date.now()}.txt`);
      const content = 'x'.repeat(10000); // 10KB
      fs.writeFileSync(testFile, content);
      fs.unlinkSync(testFile);
    });

    // Directory listing benchmark
    await profiler.benchmarkOperation('directory_listing', async () => {
      const files = fs.readdirSync(repoRoot, { recursive: true });
      return files.length;
    });

    // JSON parsing benchmark
    const largeJson = { data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })) };
    const jsonString = JSON.stringify(largeJson);
    
    await profiler.benchmarkOperation('json_parse', async () => {
      JSON.parse(jsonString);
    });

  } finally {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function benchmarkBuildOperations(profiler) {
  const publicDir = path.join(siteDir, 'public');
  
  // Prebuild benchmark (if logs exist)
  const logsExist = fs.existsSync(path.join(repoRoot, 'logs'));
  if (logsExist) {
    await profiler.benchmarkOperation('prebuild_simulation', async () => {
      // Simulate parts of prebuild without actually running it
      const logsIndex = path.join(publicDir, 'logs-index.json');
      if (fs.existsSync(logsIndex)) {
        const index = JSON.parse(fs.readFileSync(logsIndex, 'utf8'));
        // Simulate processing
        return index.length || 0;
      }
      return 0;
    }, 1); // Single iteration for build operations
  }

  // Index file reading benchmark
  const indexes = ['logs-index.json', 'rag-index.json', 'health.json'];
  
  for (const indexFile of indexes) {
    const indexPath = path.join(publicDir, indexFile);
    if (fs.existsSync(indexPath)) {
      await profiler.benchmarkOperation(`read_${indexFile}`, async () => {
        const content = fs.readFileSync(indexPath, 'utf8');
        JSON.parse(content);
      });
    }
  }
}

async function benchmarkMemoryOperations(profiler) {
  // Memory allocation benchmark
  await profiler.benchmarkOperation('memory_allocation', async () => {
    const arrays = [];
    for (let i = 0; i < 1000; i++) {
      arrays.push(new Array(1000).fill(i));
    }
    return arrays.length;
  });

  // String manipulation benchmark
  await profiler.benchmarkOperation('string_manipulation', async () => {
    let result = '';
    for (let i = 0; i < 10000; i++) {
      result += `line-${i}\n`;
    }
    return result.length;
  });
}

async function benchmarkGitOperations(profiler) {
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) return;

  try {
    await profiler.benchmarkOperation('git_status', async () => {
      execSync('git status --porcelain', { 
        cwd: repoRoot, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
    }, 1); // Single iteration for git operations

    await profiler.benchmarkOperation('git_log', async () => {
      execSync('git log --oneline -10', { 
        cwd: repoRoot, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
    }, 1);

  } catch (error) {
    console.warn('⚠️  Git benchmarks failed:', error.message);
  }
}

async function runFullBenchmarkSuite() {
  console.log('🚀 Performance Benchmark Suite\n');
  
  const profiler = new PerformanceProfiler();
  
  // System info
  const memUsage = process.memoryUsage();
  console.log('💻 System Information:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform} ${process.arch}`);
  console.log(`   Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap used`);
  console.log(`   Uptime: ${Math.round(process.uptime())}s\n`);

  // Run benchmark categories
  try {
    await benchmarkFileOperations(profiler);
    await benchmarkBuildOperations(profiler);
    await benchmarkMemoryOperations(profiler);
    await benchmarkGitOperations(profiler);
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }

  // Generate report
  const report = profiler.generateReport();
  
  // Display summary
  console.log('\n📊 Benchmark Summary:');
  
  for (const session of profiler.sessions) {
    const stats = session.statistics;
    console.log(`   ${session.label.padEnd(25)} ${stats.average.toString().padStart(8)}ms avg (±${stats.stddev.toFixed(1)})`);
  }
  
  console.log(`\n📁 Report saved: ${path.relative(repoRoot, path.join(siteDir, 'public', 'performance', 'report.json'))}`);
  console.log(`📈 Benchmarks logged: ${path.relative(repoRoot, path.join(siteDir, 'public', 'performance', 'benchmarks.jsonl'))}\n`);

  // Performance analysis
  const slowOps = profiler.sessions.filter(s => s.statistics.average > 1000);
  if (slowOps.length > 0) {
    console.log('⚠️  Slow Operations (>1000ms):');
    slowOps.forEach(op => {
      console.log(`   ${op.label}: ${op.statistics.average}ms`);
    });
    console.log();
  }

  const inconsistentOps = profiler.sessions.filter(s => s.statistics.stddev > s.statistics.average * 0.3);
  if (inconsistentOps.length > 0) {
    console.log('📈 Inconsistent Performance (high variance):');
    inconsistentOps.forEach(op => {
      console.log(`   ${op.label}: ${op.statistics.average}ms ±${op.statistics.stddev.toFixed(1)} (${((op.statistics.stddev / op.statistics.average) * 100).toFixed(1)}% variance)`);
    });
    console.log();
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'benchmark';
  
  switch (command) {
    case 'benchmark':
    case 'bench':
      await runFullBenchmarkSuite();
      break;
      
    case 'quick':
      console.log('🏃 Quick Performance Check\n');
      const profiler = new PerformanceProfiler();
      await benchmarkFileOperations(profiler);
      profiler.generateReport();
      break;
      
    case 'history':
      const perfFile = path.join(siteDir, 'public', 'performance', 'benchmarks.jsonl');
      if (fs.existsSync(perfFile)) {
        const lines = fs.readFileSync(perfFile, 'utf8').trim().split('\n');
        const recent = lines.slice(-10).map(line => JSON.parse(line));
        
        console.log('📈 Recent Benchmark History:\n');
        recent.forEach(benchmark => {
          const date = new Date(benchmark.timestamp).toLocaleString();
          console.log(`${date} - ${benchmark.label}: ${benchmark.statistics.average}ms avg`);
        });
      } else {
        console.log('No benchmark history found. Run benchmarks first.');
      }
      break;
      
    default:
      console.log('Usage: performance-monitor.mjs [benchmark|quick|history]');
      console.log('');
      console.log('Commands:');
      console.log('  benchmark  Run full benchmark suite (default)');
      console.log('  quick      Run quick performance check');
      console.log('  history    Show recent benchmark history');
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Performance monitoring failed:', error.message);
    process.exit(1);
  });
}