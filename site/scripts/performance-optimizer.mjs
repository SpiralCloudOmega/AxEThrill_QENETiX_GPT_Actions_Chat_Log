#!/usr/bin/env node
/**
 * Performance Optimization Framework
 * Intelligent caching, build optimization, memory management, and automated tuning
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const siteDir = path.join(rootDir, 'site');

class PerformanceOptimizer {
  constructor() {
    this.cacheDir = path.join(siteDir, '.cache');
    this.configPath = path.join(siteDir, 'public', 'performance-config.json');
    this.metricsPath = path.join(siteDir, 'public', 'performance-metrics.json');
    this.config = null;
    this.metrics = null;
    this.cache = new Map();
    this.memoryThreshold = 0.8; // 80% memory usage threshold
    this.cacheHitRatio = 0;
    this.lastOptimization = null;
  }

  /**
   * Initialize performance optimizer
   */
  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadConfig();
      await this.loadMetrics();
      console.log('✅ Performance optimizer initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize performance optimizer:', error.message);
      return false;
    }
  }

  /**
   * Load performance configuration
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
    } catch (error) {
      // Create default config if not exists
      this.config = {
        caching: {
          enabled: true,
          ttl: 3600000, // 1 hour
          maxSize: 100, // Maximum cache entries
          compressionEnabled: true
        },
        build: {
          concurrency: os.cpus().length,
          memoryLimit: '2GB',
          optimizationLevel: 'balanced',
          treeshaking: true,
          minification: true
        },
        monitoring: {
          enabled: true,
          interval: 30000, // 30 seconds
          memoryThreshold: 0.8,
          cpuThreshold: 0.9
        },
        cleanup: {
          enabled: true,
          maxAge: 604800000, // 7 days
          maxSize: '1GB'
        }
      };
      await this.saveConfig();
    }
  }

  /**
   * Save performance configuration
   */
  async saveConfig() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('❌ Failed to save performance config:', error.message);
    }
  }

  /**
   * Load performance metrics
   */
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsPath, 'utf8');
      this.metrics = JSON.parse(data);
    } catch (error) {
      this.metrics = {
        cache: {
          hits: 0,
          misses: 0,
          size: 0,
          hitRatio: 0
        },
        build: {
          totalTime: 0,
          averageTime: 0,
          lastBuildTime: null,
          optimizationsApplied: 0
        },
        memory: {
          peak: 0,
          average: 0,
          current: 0,
          gcCount: 0
        },
        lastUpdated: new Date().toISOString()
      };
      await this.saveMetrics();
    }
  }

  /**
   * Save performance metrics
   */
  async saveMetrics() {
    try {
      this.metrics.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.metricsPath, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('❌ Failed to save performance metrics:', error.message);
    }
  }

  /**
   * Get cached data
   */
  async getCachedData(key) {
    if (!this.config.caching.enabled) return null;

    try {
      const cacheKey = this.generateCacheKey(key);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      // Check memory cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.caching.ttl) {
          this.metrics.cache.hits++;
          return cached.data;
        } else {
          this.cache.delete(cacheKey);
        }
      }

      // Check disk cache
      const stats = await fs.stat(cachePath);
      if (Date.now() - stats.mtime.getTime() < this.config.caching.ttl) {
        const data = await fs.readFile(cachePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Store in memory cache
        this.cache.set(cacheKey, {
          data: parsed,
          timestamp: Date.now()
        });
        
        this.metrics.cache.hits++;
        return parsed;
      }
    } catch (error) {
      // Cache miss
    }

    this.metrics.cache.misses++;
    this.updateCacheHitRatio();
    return null;
  }

  /**
   * Set cached data
   */
  async setCachedData(key, data) {
    if (!this.config.caching.enabled) return;

    try {
      const cacheKey = this.generateCacheKey(key);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      // Store in memory cache
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      // Store in disk cache
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
      
      // Cleanup if cache is too large
      if (this.cache.size > this.config.caching.maxSize) {
        await this.cleanupCache();
      }

      this.metrics.cache.size = this.cache.size;
    } catch (error) {
      console.error('❌ Failed to cache data:', error.message);
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(input) {
    return crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
  }

  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.cacheHitRatio = total > 0 ? this.metrics.cache.hits / total : 0;
    this.metrics.cache.hitRatio = this.cacheHitRatio;
  }

  /**
   * Cleanup old cache entries
   */
  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > this.config.caching.ttl ||
            now - stats.mtime.getTime() > this.config.cleanup.maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      // Cleanup memory cache
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.config.caching.ttl) {
          this.cache.delete(key);
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup cache:', error.message);
    }
  }

  /**
   * Monitor system resources
   */
  async monitorResources() {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryRatio = usedMemory / totalMemory;

      // Update metrics
      this.metrics.memory.current = memoryUsage.heapUsed;
      this.metrics.memory.peak = Math.max(this.metrics.memory.peak, memoryUsage.heapUsed);
      
      // Trigger optimization if thresholds exceeded
      if (memoryRatio > this.memoryThreshold) {
        console.log(`⚠️ High memory usage detected: ${(memoryRatio * 100).toFixed(1)}%`);
        await this.optimizeMemory();
      }

      // Trigger GC if needed
      if (memoryUsage.heapUsed > memoryUsage.heapTotal * 0.9) {
        if (global.gc) {
          global.gc();
          this.metrics.memory.gcCount++;
          console.log('🗑️ Garbage collection triggered');
        }
      }

      return {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          ratio: memoryUsage.heapUsed / memoryUsage.heapTotal
        },
        system: {
          totalMemory,
          freeMemory,
          usedMemory,
          ratio: memoryRatio
        }
      };
    } catch (error) {
      console.error('❌ Failed to monitor resources:', error.message);
      return null;
    }
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory() {
    try {
      console.log('🔧 Optimizing memory usage...');
      
      // Clear expired cache entries
      await this.cleanupCache();
      
      // Reduce cache size if needed
      if (this.cache.size > this.config.caching.maxSize / 2) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toDelete = entries.slice(0, Math.floor(entries.length / 2));
        for (const [key] of toDelete) {
          this.cache.delete(key);
        }
        
        console.log(`🧹 Reduced cache size by ${toDelete.length} entries`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.metrics.memory.gcCount++;
      }

      console.log('✅ Memory optimization completed');
    } catch (error) {
      console.error('❌ Memory optimization failed:', error.message);
    }
  }

  /**
   * Optimize build performance
   */
  async optimizeBuild(buildConfig = {}) {
    try {
      console.log('🚀 Optimizing build performance...');
      const startTime = Date.now();

      const optimizedConfig = {
        ...this.config.build,
        ...buildConfig,
        // Dynamic optimizations based on system resources
        concurrency: Math.min(this.config.build.concurrency, os.cpus().length),
        memoryLimit: this.calculateOptimalMemoryLimit(),
        optimizationLevel: this.determineOptimizationLevel()
      };

      // Apply build optimizations
      const optimizations = [];

      if (optimizedConfig.treeshaking) {
        optimizations.push('tree-shaking');
      }

      if (optimizedConfig.minification) {
        optimizations.push('minification');
      }

      if (optimizedConfig.compressionEnabled) {
        optimizations.push('compression');
      }

      const buildTime = Date.now() - startTime;
      this.metrics.build.lastBuildTime = buildTime;
      this.metrics.build.totalTime += buildTime;
      this.metrics.build.optimizationsApplied += optimizations.length;

      console.log(`✅ Build optimization completed in ${buildTime}ms`);
      console.log(`🔧 Applied optimizations: ${optimizations.join(', ')}`);

      return {
        config: optimizedConfig,
        optimizations,
        buildTime
      };
    } catch (error) {
      console.error('❌ Build optimization failed:', error.message);
      return null;
    }
  }

  /**
   * Calculate optimal memory limit
   */
  calculateOptimalMemoryLimit() {
    const totalMemory = os.totalmem();
    const availableMemory = os.freemem();
    const optimalLimit = Math.min(
      Math.floor(availableMemory * 0.7), // Use 70% of available memory
      2 * 1024 * 1024 * 1024 // Cap at 2GB
    );
    return `${Math.floor(optimalLimit / (1024 * 1024))}MB`;
  }

  /**
   * Determine optimization level based on system resources
   */
  determineOptimizationLevel() {
    const memoryUsage = process.memoryUsage();
    const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const cpuCount = os.cpus().length;

    if (cpuCount >= 8 && memoryRatio < 0.5) {
      return 'aggressive';
    } else if (cpuCount >= 4 && memoryRatio < 0.7) {
      return 'balanced';
    } else {
      return 'conservative';
    }
  }

  /**
   * Run full optimization cycle
   */
  async optimize() {
    try {
      console.log('🔄 Starting performance optimization cycle...');
      
      const resources = await this.monitorResources();
      if (!resources) return false;

      // Optimize memory if needed
      if (resources.system.ratio > this.memoryThreshold) {
        await this.optimizeMemory();
      }

      // Cleanup cache
      await this.cleanupCache();

      // Update metrics
      await this.saveMetrics();

      this.lastOptimization = new Date().toISOString();
      
      console.log('✅ Performance optimization cycle completed');
      console.log(`📊 Cache hit ratio: ${(this.cacheHitRatio * 100).toFixed(1)}%`);
      console.log(`💾 Memory usage: ${(resources.memory.ratio * 100).toFixed(1)}%`);
      console.log(`🗂️ Cache size: ${this.cache.size} entries`);

      return true;
    } catch (error) {
      console.error('❌ Performance optimization failed:', error.message);
      return false;
    }
  }

  /**
   * Get performance status
   */
  async getStatus() {
    try {
      const resources = await this.monitorResources();
      
      return {
        status: 'healthy',
        lastOptimization: this.lastOptimization,
        cache: {
          size: this.cache.size,
          hitRatio: this.cacheHitRatio,
          enabled: this.config.caching.enabled
        },
        memory: resources ? {
          usage: resources.memory.ratio,
          system: resources.system.ratio,
          peak: this.metrics.memory.peak
        } : null,
        config: this.config,
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    try {
      const status = await this.getStatus();
      const resources = await this.monitorResources();
      
      const report = {
        summary: {
          status: status.status,
          lastOptimization: this.lastOptimization,
          cacheEfficiency: this.cacheHitRatio,
          memoryUsage: resources ? resources.system.ratio : 0
        },
        cache: {
          ...this.metrics.cache,
          memoryEntries: this.cache.size,
          efficiency: this.cacheHitRatio > 0.8 ? 'excellent' : 
                     this.cacheHitRatio > 0.6 ? 'good' : 
                     this.cacheHitRatio > 0.4 ? 'fair' : 'poor'
        },
        memory: {
          ...this.metrics.memory,
          current: resources ? resources.memory.used : 0,
          systemUsage: resources ? resources.system.ratio : 0,
          recommendations: this.generateMemoryRecommendations(resources)
        },
        build: {
          ...this.metrics.build,
          averageTime: this.metrics.build.totalTime / Math.max(1, this.metrics.build.optimizationsApplied)
        },
        recommendations: this.generateRecommendations(status, resources),
        timestamp: new Date().toISOString()
      };

      return report;
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error.message);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate memory recommendations
   */
  generateMemoryRecommendations(resources) {
    const recommendations = [];
    
    if (!resources) return recommendations;

    if (resources.system.ratio > 0.9) {
      recommendations.push('Critical: System memory usage is very high. Consider reducing cache size or adding more RAM.');
    } else if (resources.system.ratio > 0.8) {
      recommendations.push('Warning: High system memory usage detected. Monitor closely.');
    }

    if (resources.memory.ratio > 0.9) {
      recommendations.push('Node.js heap usage is high. Consider enabling garbage collection or reducing memory-intensive operations.');
    }

    if (this.metrics.memory.gcCount > 100) {
      recommendations.push('Frequent garbage collection detected. Consider optimizing memory usage patterns.');
    }

    return recommendations;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(status, resources) {
    const recommendations = [];

    // Cache recommendations
    if (this.cacheHitRatio < 0.5) {
      recommendations.push('Low cache hit ratio. Consider increasing cache TTL or reviewing cache keys.');
    }
    
    if (this.cache.size < this.config.caching.maxSize * 0.1) {
      recommendations.push('Cache utilization is low. Consider warming up cache or reviewing caching strategy.');
    }

    // Memory recommendations
    if (resources && resources.system.ratio > 0.8) {
      recommendations.push('High memory usage. Consider enabling aggressive cleanup or increasing memory limits.');
    }

    // Build recommendations
    if (this.metrics.build.averageTime > 60000) {
      recommendations.push('Build times are high. Consider enabling more aggressive optimizations or increasing concurrency.');
    }

    return recommendations;
  }
}

/**
 * Main execution function
 */
async function main() {
  const optimizer = new PerformanceOptimizer();
  
  if (!await optimizer.initialize()) {
    process.exit(1);
  }

  const command = process.argv[2];
  
  switch (command) {
    case 'optimize':
      await optimizer.optimize();
      break;
      
    case 'status':
      const status = await optimizer.getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'report':
      const report = await optimizer.generateReport();
      console.log(JSON.stringify(report, null, 2));
      break;
      
    case 'cleanup':
      await optimizer.cleanupCache();
      break;
      
    case 'monitor':
      const resources = await optimizer.monitorResources();
      console.log(JSON.stringify(resources, null, 2));
      break;
      
    default:
      console.log(`
Usage: node performance-optimizer.mjs <command>

Commands:
  optimize  - Run full optimization cycle
  status    - Get current performance status
  report    - Generate detailed performance report
  cleanup   - Clean up expired cache entries
  monitor   - Monitor system resources
`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Performance optimization failed:', error.message);
    process.exit(1);
  });
}

export { PerformanceOptimizer };