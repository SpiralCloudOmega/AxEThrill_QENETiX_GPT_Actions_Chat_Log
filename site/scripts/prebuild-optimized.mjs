#!/usr/bin/env node
// Optimized prebuild script with intelligent caching
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { buildPipeline, memoryOptimizer, withMemoryOptimization } from './lib/performance.mjs';
import { errorLogger, safeFileOps, handleError } from './lib/error-handling.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

class OptimizedPrebuild {
  constructor() {
    this.logger = errorLogger;
    this.fileOps = safeFileOps;
    this.totalStartTime = performance.now();
    this.buildResults = [];
    this.stats = {
      processed: 0,
      cached: 0,
      errors: 0,
      totalTime: 0
    };
  }

  async run() {
    console.log('🚀 Starting optimized prebuild process...\n');
    
    try {
      memoryOptimizer.checkpoint('prebuild_start');
      
      await this.ensureDirectories();
      await this.buildLogsIndex();
      await this.buildRSSFeed();
      await this.buildCommitGraph();
      await this.buildHealthStatus();
      await this.buildBundleReport();
      await this.updateMemoryIndex();
      
      memoryOptimizer.checkpoint('prebuild_end');
      this.printSummary();
      
    } catch (error) {
      this.stats.errors++;
      this.logger.log(handleError(error, { operation: 'prebuild' }));
      console.error('❌ Prebuild failed:', error.message);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(siteDir, 'public'),
      path.join(siteDir, 'public', 'tags'),
      path.join(siteDir, 'public', 'health'),
      path.join(siteDir, 'public', 'performance'),
      path.join(siteDir, 'public', 'diagnostics')
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async buildLogsIndex() {
    const sourceFiles = [
      path.join(repoRoot, 'logs')
    ];
    const targetFile = path.join(siteDir, 'public', 'logs-index.json');
    const cacheKey = 'logs-index-build';

    const result = await buildPipeline.buildWithCache(
      sourceFiles,
      targetFile,
      () => withMemoryOptimization(() => this.generateLogsIndex(), 'logs_index'),
      cacheKey
    );

    this.updateStats(result);
  }

  async generateLogsIndex() {
    console.log('   📝 Scanning log files...');
    
    const logsDir = path.join(repoRoot, 'logs');
    const logs = [];
    const tags = new Set();

    if (!fs.existsSync(logsDir)) {
      console.log('   ⚠️  No logs directory found');
      return this.saveLogsIndex([], []);
    }

    await this.scanLogsDirectory(logsDir, logs, tags);
    
    // Sort logs by date (newest first)
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`   ✅ Found ${logs.length} logs with ${tags.size} unique tags`);
    
    return this.saveLogsIndex(logs, Array.from(tags).sort());
  }

  async scanLogsDirectory(dir, logs, tags, basePath = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(basePath, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        // Skip certain directories
        if (!['node_modules', '.git', '.cache'].includes(item)) {
          await this.scanLogsDirectory(fullPath, logs, tags, relativePath);
        }
      } else if (item.endsWith('.md')) {
        try {
          const logData = await this.parseLogFile(fullPath, relativePath);
          if (logData) {
            logs.push(logData);
            logData.tags.forEach(tag => tags.add(tag));
          }
        } catch (error) {
          console.warn(`   ⚠️  Failed to parse ${relativePath}: ${error.message}`);
        }
      }
    }
  }

  async parseLogFile(filePath, relativePath) {
    const content = await this.fileOps.readFile(filePath);
    const stats = fs.statSync(filePath);
    
    // Parse frontmatter and extract metadata
    const { title, tags, date } = this.parseHeader(content);
    
    return {
      path: relativePath,
      title: title || this.extractTitleFromContent(content) || path.basename(filePath, '.md'),
      tags: this.normalizeTags(tags || []),
      date: date || stats.mtime.toISOString(),
      size: stats.size,
      modified: stats.mtime.toISOString(),
      slug: this.generateSlug(title || path.basename(filePath, '.md'))
    };
  }

  parseHeader(content) {
    const frontmatterMatch = content.match(/^---\r?\n(.*?)\r?\n---/s);
    if (!frontmatterMatch) return {};

    const frontmatter = frontmatterMatch[1];
    const data = {};

    // Simple YAML-like parsing
    frontmatter.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        
        if (key === 'tags' && value) {
          data[key] = value.split(',').map(tag => tag.trim()).filter(Boolean);
        } else if (value) {
          data[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
        }
      }
    });

    return data;
  }

  extractTitleFromContent(content) {
    // Remove frontmatter
    const withoutFrontmatter = content.replace(/^---\r?\n.*?\r?\n---\r?\n?/s, '');
    
    // Look for first heading
    const headingMatch = withoutFrontmatter.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Look for first non-empty line
    const lines = withoutFrontmatter.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.slice(0, 100) + (trimmed.length > 100 ? '...' : '');
      }
    }

    return null;
  }

  normalizeTags(tags) {
    return tags
      .map(tag => tag.toLowerCase().trim().replace(/[^\w\s-]/g, ''))
      .filter(Boolean)
      .slice(0, 10); // Limit to 10 tags
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  async saveLogsIndex(logs, tags) {
    const index = {
      timestamp: new Date().toISOString(),
      logs,
      tags,
      count: logs.length,
      tagCount: tags.length
    };

    const indexFile = path.join(siteDir, 'public', 'logs-index.json');
    await this.fileOps.writeFile(indexFile, JSON.stringify(index, null, 2));
    
    // Also save tag-specific indexes
    await this.saveTagIndexes(logs, tags);
    
    return index;
  }

  async saveTagIndexes(logs, tags) {
    const tagsDir = path.join(siteDir, 'public', 'tags');
    
    for (const tag of tags) {
      const tagLogs = logs.filter(log => log.tags.includes(tag));
      const tagIndex = {
        tag,
        count: tagLogs.length,
        logs: tagLogs
      };
      
      const tagDir = path.join(tagsDir, tag);
      fs.mkdirSync(tagDir, { recursive: true });
      
      const tagFile = path.join(tagDir, 'index.json');
      await this.fileOps.writeFile(tagFile, JSON.stringify(tagIndex, null, 2));
    }
  }

  async buildRSSFeed() {
    const sourceFiles = [path.join(siteDir, 'public', 'logs-index.json')];
    const targetFile = path.join(siteDir, 'public', 'feed.xml');
    const cacheKey = 'rss-feed-build';

    const result = await buildPipeline.buildWithCache(
      sourceFiles,
      targetFile,
      () => this.generateRSSFeed(),
      cacheKey
    );

    this.updateStats(result);
  }

  async generateRSSFeed() {
    console.log('   📡 Generating RSS feed...');
    
    const indexFile = path.join(siteDir, 'public', 'logs-index.json');
    if (!fs.existsSync(indexFile)) {
      console.log('   ⚠️  No logs index found, skipping RSS');
      return;
    }

    const index = await this.fileOps.parseJSON(indexFile);
    const recentLogs = index.logs.slice(0, 20); // Latest 20 entries

    const rss = this.generateRSSContent(recentLogs);
    await this.fileOps.writeFile(path.join(siteDir, 'public', 'feed.xml'), rss);
    
    console.log(`   ✅ RSS feed generated with ${recentLogs.length} entries`);
  }

  generateRSSContent(logs) {
    const baseUrl = process.env.GITHUB_ACTIONS 
      ? `https://${process.env.GITHUB_REPOSITORY?.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY?.split('/')[1]}`
      : 'http://localhost:3000';

    const items = logs.map(log => `
    <item>
      <title><![CDATA[${log.title}]]></title>
      <link>${baseUrl}/logs/${log.path.replace('.md', '')}</link>
      <guid>${baseUrl}/logs/${log.path.replace('.md', '')}</guid>
      <pubDate>${new Date(log.date).toUTCString()}</pubDate>
      <description><![CDATA[Tags: ${log.tags.join(', ')}]]></description>
    </item>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AxEThrill QENETiX Chat Log</title>
    <description>AI chat logs and conversations</description>
    <link>${baseUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
  }

  async buildCommitGraph() {
    const sourceFiles = [path.join(repoRoot, '.git')];
    const targetFile = path.join(siteDir, 'public', 'commits.json');
    const cacheKey = 'commit-graph-build';

    const result = await buildPipeline.buildWithCache(
      sourceFiles,
      targetFile,
      () => this.generateCommitGraph(),
      cacheKey
    );

    this.updateStats(result);
  }

  async generateCommitGraph() {
    console.log('   📊 Generating commit graph...');
    
    try {
      const { execSync } = await import('node:child_process');
      
      // Get recent commits
      const gitLog = execSync('git log --oneline -50 --format="%H|%s|%ad|%an" --date=iso', {
        cwd: repoRoot,
        encoding: 'utf8'
      });

      const commits = gitLog.trim().split('\n').map(line => {
        const [hash, message, date, author] = line.split('|');
        return { hash, message, date, author };
      });

      const commitData = {
        timestamp: new Date().toISOString(),
        commits,
        count: commits.length
      };

      await this.fileOps.writeFile(
        path.join(siteDir, 'public', 'commits.json'),
        JSON.stringify(commitData, null, 2)
      );

      console.log(`   ✅ Commit graph generated with ${commits.length} commits`);
      
    } catch (error) {
      console.log('   ⚠️  Git not available, skipping commit graph');
    }
  }

  async buildHealthStatus() {
    const targetFile = path.join(siteDir, 'public', 'health.json');
    
    // Always rebuild health status (no caching)
    const result = await buildPipeline.buildWithCache(
      [],
      targetFile,
      () => this.generateHealthStatus(),
      null // No caching for health status
    );

    this.updateStats(result);
  }

  async generateHealthStatus() {
    console.log('   🏥 Generating health status...');
    
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      node_version: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      build_info: {
        cache_stats: buildPipeline.getBuildStats(),
        memory_stats: memoryOptimizer.getMemoryReport()
      }
    };

    await this.fileOps.writeFile(
      path.join(siteDir, 'public', 'health.json'),
      JSON.stringify(health, null, 2)
    );

    console.log('   ✅ Health status generated');
  }

  async buildBundleReport() {
    const sourceFiles = [path.join(siteDir, 'package.json')];
    const targetFile = path.join(siteDir, 'public', 'bundle-report.json');
    const cacheKey = 'bundle-report-build';

    const result = await buildPipeline.buildWithCache(
      sourceFiles,
      targetFile,
      () => this.generateBundleReport(),
      cacheKey
    );

    this.updateStats(result);
  }

  async generateBundleReport() {
    console.log('   📦 Generating bundle report...');
    
    const packageFile = path.join(siteDir, 'package.json');
    const pkg = await this.fileOps.parseJSON(packageFile);
    
    const report = {
      timestamp: new Date().toISOString(),
      dependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
      scripts: Object.keys(pkg.scripts || {}).length,
      version: pkg.version || '1.0.0'
    };

    await this.fileOps.writeFile(
      path.join(siteDir, 'public', 'bundle-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('   ✅ Bundle report generated');
  }

  async updateMemoryIndex() {
    const memoryDir = path.join(repoRoot, 'logs', 'memory');
    const targetFile = path.join(siteDir, 'public', 'memory-index.json');
    
    if (!fs.existsSync(memoryDir)) {
      console.log('   ⚠️  No memory directory found, skipping memory index');
      return;
    }

    const sourceFiles = [memoryDir];
    const cacheKey = 'memory-index-build';

    const result = await buildPipeline.buildWithCache(
      sourceFiles,
      targetFile,
      () => this.generateMemoryIndex(),
      cacheKey
    );

    this.updateStats(result);
  }

  async generateMemoryIndex() {
    console.log('   🧠 Generating memory index...');
    
    const memoryDir = path.join(repoRoot, 'logs', 'memory');
    const memories = [];

    await this.scanMemoryDirectory(memoryDir, memories);
    
    const index = {
      timestamp: new Date().toISOString(),
      memories,
      count: memories.length
    };

    await this.fileOps.writeFile(
      path.join(siteDir, 'public', 'memory-index.json'),
      JSON.stringify(index, null, 2)
    );

    console.log(`   ✅ Memory index generated with ${memories.length} entries`);
  }

  async scanMemoryDirectory(dir, memories, basePath = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(basePath, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        await this.scanMemoryDirectory(fullPath, memories, relativePath);
      } else if (item.endsWith('.json') && !['index.json', 'rate-limits.json'].includes(item)) {
        try {
          const memory = await this.fileOps.parseJSON(fullPath);
          memories.push({
            path: relativePath,
            id: memory.id || item.replace('.json', ''),
            title: memory.title || 'Untitled',
            timestamp: memory.ts || memory.timestamp,
            tags: memory.tags || [],
            size: fs.statSync(fullPath).size
          });
        } catch (error) {
          console.warn(`   ⚠️  Failed to parse memory ${relativePath}: ${error.message}`);
        }
      }
    }
  }

  updateStats(result) {
    this.stats.processed++;
    if (result.cached) {
      this.stats.cached++;
    }
    this.stats.totalTime += result.duration;
    this.buildResults.push(result);
  }

  printSummary() {
    const totalTime = performance.now() - this.totalStartTime;
    const cacheHitRate = this.stats.processed > 0 
      ? Math.round((this.stats.cached / this.stats.processed) * 100)
      : 0;

    console.log('\n📊 Prebuild Summary:');
    console.log(`   Total time: ${Math.round(totalTime)}ms`);
    console.log(`   Operations: ${this.stats.processed}`);
    console.log(`   Cache hits: ${this.stats.cached} (${cacheHitRate}%)`);
    console.log(`   Errors: ${this.stats.errors}`);
    
    const buildStats = buildPipeline.getBuildStats();
    console.log(`   Time saved: ${buildStats.timeSaved}ms`);
    
    const memoryReport = memoryOptimizer.getMemoryReport();
    console.log(`   Memory used: ${memoryReport.formatted.current}`);
    
    if (this.stats.errors === 0) {
      console.log('\n✅ Prebuild completed successfully!');
    } else {
      console.log('\n⚠️  Prebuild completed with errors');
    }
  }
}

// Run the optimized prebuild
if (import.meta.url === `file://${process.argv[1]}`) {
  const prebuild = new OptimizedPrebuild();
  prebuild.run().catch(error => {
    console.error('❌ Prebuild failed:', error.message);
    process.exit(1);
  });
}