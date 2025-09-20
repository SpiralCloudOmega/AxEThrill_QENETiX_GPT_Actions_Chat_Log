#!/usr/bin/env node
// Performance optimization utilities and caching system
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

// Memory-efficient cache with TTL and size limits
export class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0
    };
  }

  generateKey(input) {
    if (typeof input === 'string') return input;
    return crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
  }

  set(key, value, customTtl = null) {
    const cacheKey = this.generateKey(key);
    const ttl = customTtl || this.ttl;
    
    // Clear existing timer if present
    if (this.timers.has(cacheKey)) {
      clearTimeout(this.timers.get(cacheKey));
    }

    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      this.evictOldest();
    }

    // Store value with metadata
    const entry = {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      size: this.estimateSize(value)
    };

    this.cache.set(cacheKey, entry);
    this.stats.totalSize += entry.size;

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(cacheKey);
      }, ttl);
      this.timers.set(cacheKey, timer);
    }

    return this;
  }

  get(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  has(key) {
    return this.cache.has(this.generateKey(key));
  }

  delete(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.cache.delete(cacheKey);
      
      if (this.timers.has(cacheKey)) {
        clearTimeout(this.timers.get(cacheKey));
        this.timers.delete(cacheKey);
      }
      return true;
    }
    return false;
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalSize: 0 };
  }

  evictOldest() {
    if (this.cache.size === 0) return;

    // Find least recently accessed item
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      const lastAccess = entry.lastAccess || entry.timestamp;
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  estimateSize(value) {
    if (typeof value === 'string') return value.length * 2; // Rough UTF-16 estimate
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (value === null || value === undefined) return 0;
    
    // For objects, rough JSON size estimate
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default estimate for non-serializable objects
    }
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: `${Math.round(this.stats.totalSize / 1024)}KB`
    };
  }
}

// File-based persistent cache
export class FileCache {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(siteDir, '.cache');
    this.ensureCacheDir();
    this.indexFile = path.join(this.cacheDir, 'index.json');
    this.index = this.loadIndex();
  }

  ensureCacheDir() {
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        return JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Failed to load cache index:', error.message);
    }
    return {};
  }

  saveIndex() {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2));
    } catch (error) {
      console.warn('Failed to save cache index:', error.message);
    }
  }

  generateCacheKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  set(key, value, ttl = 3600000) { // 1 hour default
    const cacheKey = this.generateCacheKey(key);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    const entry = {
      key,
      value,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    };

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(entry));
      this.index[cacheKey] = {
        key,
        file: cacheFile,
        timestamp: entry.timestamp,
        expires: entry.expires
      };
      this.saveIndex();
      return true;
    } catch (error) {
      console.warn('Failed to cache to file:', error.message);
      return false;
    }
  }

  get(key) {
    const cacheKey = this.generateCacheKey(key);
    const indexEntry = this.index[cacheKey];
    
    if (!indexEntry) return undefined;
    
    // Check expiration
    if (Date.now() > indexEntry.expires) {
      this.delete(key);
      return undefined;
    }

    try {
      const content = fs.readFileSync(indexEntry.file, 'utf8');
      const entry = JSON.parse(content);
      return entry.value;
    } catch (error) {
      console.warn('Failed to read cache file:', error.message);
      this.delete(key);
      return undefined;
    }
  }

  has(key) {
    const cacheKey = this.generateCacheKey(key);
    const indexEntry = this.index[cacheKey];
    
    if (!indexEntry) return false;
    
    // Check expiration
    if (Date.now() > indexEntry.expires) {
      this.delete(key);
      return false;
    }
    
    return fs.existsSync(indexEntry.file);
  }

  delete(key) {
    const cacheKey = this.generateCacheKey(key);
    const indexEntry = this.index[cacheKey];
    
    if (indexEntry) {
      try {
        if (fs.existsSync(indexEntry.file)) {
          fs.unlinkSync(indexEntry.file);
        }
      } catch (error) {
        console.warn('Failed to delete cache file:', error.message);
      }
      
      delete this.index[cacheKey];
      this.saveIndex();
      return true;
    }
    return false;
  }

  clear() {
    try {
      // Delete all cache files
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'index.json') {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      
      this.index = {};
      this.saveIndex();
    } catch (error) {
      console.warn('Failed to clear cache:', error.message);
    }
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [cacheKey, entry] of Object.entries(this.index)) {
      if (now > entry.expires) {
        keysToDelete.push(entry.key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key);
    }
    
    return keysToDelete.length;
  }

  getStats() {
    const files = Object.keys(this.index).length;
    let totalSize = 0;
    
    try {
      for (const entry of Object.values(this.index)) {
        if (fs.existsSync(entry.file)) {
          totalSize += fs.statSync(entry.file).size;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate cache size:', error.message);
    }
    
    return {
      files,
      totalSize,
      cacheDir: this.cacheDir,
      sizeFormatted: `${Math.round(totalSize / 1024)}KB`
    };
  }
}

// Lazy loading utility for large objects/arrays
export class LazyLoader {
  constructor(loadFunction, options = {}) {
    this.loadFunction = loadFunction;
    this.batchSize = options.batchSize || 100;
    this.cache = new SmartCache({ maxSize: options.cacheSize || 1000 });
    this.isLoaded = false;
    this.isLoading = false;
    this.data = null;
    this.loadPromise = null;
  }

  async load() {
    if (this.isLoaded) return this.data;
    if (this.isLoading) return this.loadPromise;

    this.isLoading = true;
    this.loadPromise = this.loadFunction();
    
    try {
      this.data = await this.loadPromise;
      this.isLoaded = true;
      return this.data;
    } catch (error) {
      this.isLoading = false;
      throw error;
    }
  }

  async getBatch(start, size = null) {
    const batchSize = size || this.batchSize;
    const cacheKey = `batch_${start}_${batchSize}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Load data if needed
    await this.load();
    
    if (Array.isArray(this.data)) {
      const batch = this.data.slice(start, start + batchSize);
      this.cache.set(cacheKey, batch);
      return batch;
    }
    
    return this.data;
  }

  async getItem(index) {
    const cacheKey = `item_${index}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Load data if needed
    await this.load();
    
    if (Array.isArray(this.data) && index < this.data.length) {
      const item = this.data[index];
      this.cache.set(cacheKey, item);
      return item;
    }
    
    return undefined;
  }

  getLength() {
    if (this.isLoaded && Array.isArray(this.data)) {
      return this.data.length;
    }
    return 0;
  }

  invalidate() {
    this.isLoaded = false;
    this.isLoading = false;
    this.data = null;
    this.loadPromise = null;
    this.cache.clear();
  }
}

// Optimized build pipeline with caching
export class OptimizedBuildPipeline {
  constructor() {
    this.cache = new FileCache(path.join(siteDir, '.build-cache'));
    this.fileHashes = new Map();
    this.buildStats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalBuilds: 0,
      timesSaved: 0
    };
  }

  async getFileHash(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256')
        .update(content)
        .update(stats.mtime.toString())
        .digest('hex');
      
      this.fileHashes.set(filePath, hash);
      return hash;
    } catch (error) {
      console.warn(`Failed to hash file ${filePath}:`, error.message);
      return null;
    }
  }

  async shouldRebuild(sourceFiles, targetFile, cacheKey = null) {
    if (!fs.existsSync(targetFile)) return true;
    
    const targetStats = fs.statSync(targetFile);
    
    // Check if any source file is newer than target
    for (const sourceFile of sourceFiles) {
      if (fs.existsSync(sourceFile)) {
        const sourceStats = fs.statSync(sourceFile);
        if (sourceStats.mtime > targetStats.mtime) {
          return true;
        }
      }
    }

    // Check cache if key provided
    if (cacheKey) {
      const cachedHash = this.cache.get(cacheKey);
      if (cachedHash) {
        // Calculate current hash
        const currentHash = await this.calculateSourceHash(sourceFiles);
        return cachedHash !== currentHash;
      }
    }

    return false;
  }

  async calculateSourceHash(sourceFiles) {
    const hashes = [];
    for (const file of sourceFiles) {
      const hash = await this.getFileHash(file);
      if (hash) hashes.push(hash);
    }
    return crypto.createHash('sha256').update(hashes.join('')).digest('hex');
  }

  async buildWithCache(sourceFiles, targetFile, buildFunction, cacheKey = null) {
    const startTime = performance.now();
    this.buildStats.totalBuilds++;
    
    const shouldRebuild = await this.shouldRebuild(sourceFiles, targetFile, cacheKey);
    
    if (!shouldRebuild) {
      this.buildStats.cacheHits++;
      const endTime = performance.now();
      console.log(`✅ Cache hit for ${path.basename(targetFile)} (${Math.round(endTime - startTime)}ms)`);
      return { cached: true, duration: endTime - startTime };
    }

    // Rebuild required
    this.buildStats.cacheMisses++;
    console.log(`🔨 Building ${path.basename(targetFile)}...`);
    
    try {
      const result = await buildFunction();
      
      // Cache the source hash if cache key provided
      if (cacheKey) {
        const sourceHash = await this.calculateSourceHash(sourceFiles);
        this.cache.set(cacheKey, sourceHash, 24 * 60 * 60 * 1000); // 24 hours
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.buildStats.timesSaved += duration;
      
      console.log(`✅ Built ${path.basename(targetFile)} (${Math.round(duration)}ms)`);
      return { cached: false, duration, result };
      
    } catch (error) {
      console.error(`❌ Build failed for ${path.basename(targetFile)}:`, error.message);
      throw error;
    }
  }

  getBuildStats() {
    const totalTime = this.buildStats.timesSaved;
    const avgBuildTime = this.buildStats.cacheMisses > 0 
      ? totalTime / this.buildStats.cacheMisses 
      : 0;
    
    const timeSaved = this.buildStats.cacheHits * avgBuildTime;
    
    return {
      ...this.buildStats,
      avgBuildTime: Math.round(avgBuildTime),
      timeSaved: Math.round(timeSaved),
      cacheHitRate: this.buildStats.totalBuilds > 0 
        ? Math.round((this.buildStats.cacheHits / this.buildStats.totalBuilds) * 100)
        : 0
    };
  }

  clearCache() {
    this.cache.clear();
    this.fileHashes.clear();
    this.buildStats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalBuilds: 0,
      timesSaved: 0
    };
  }
}

// Memory usage monitoring and optimization
export class MemoryOptimizer {
  constructor() {
    this.baselineMemory = process.memoryUsage();
    this.checkpoints = [];
    this.gcCount = 0;
  }

  checkpoint(name) {
    const memory = process.memoryUsage();
    const checkpoint = {
      name,
      timestamp: Date.now(),
      memory,
      delta: {
        rss: memory.rss - this.baselineMemory.rss,
        heapTotal: memory.heapTotal - this.baselineMemory.heapTotal,
        heapUsed: memory.heapUsed - this.baselineMemory.heapUsed,
        external: memory.external - this.baselineMemory.external
      }
    };
    
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  forceGC() {
    if (global.gc) {
      global.gc();
      this.gcCount++;
      return true;
    }
    return false;
  }

  optimizeMemory() {
    const beforeGC = process.memoryUsage();
    const gcResult = this.forceGC();
    const afterGC = process.memoryUsage();
    
    return {
      gcTriggered: gcResult,
      before: beforeGC,
      after: afterGC,
      freed: gcResult ? beforeGC.heapUsed - afterGC.heapUsed : 0
    };
  }

  getMemoryReport() {
    const current = process.memoryUsage();
    const peak = this.checkpoints.length > 0 
      ? Math.max(...this.checkpoints.map(cp => cp.memory.heapUsed))
      : current.heapUsed;

    return {
      current,
      baseline: this.baselineMemory,
      peak,
      checkpoints: this.checkpoints.length,
      gcCount: this.gcCount,
      formatted: {
        current: `${Math.round(current.heapUsed / 1024 / 1024)}MB`,
        peak: `${Math.round(peak / 1024 / 1024)}MB`,
        rss: `${Math.round(current.rss / 1024 / 1024)}MB`
      }
    };
  }
}

// Create singleton instances
export const globalCache = new SmartCache({ maxSize: 500, ttl: 10 * 60 * 1000 });
export const fileCache = new FileCache();
export const buildPipeline = new OptimizedBuildPipeline();
export const memoryOptimizer = new MemoryOptimizer();

// Utility functions
export function memoize(fn, keyGenerator = null) {
  const cache = new SmartCache({ maxSize: 100 });
  
  return function(...args) {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

export async function withMemoryOptimization(fn, checkpointName = 'operation') {
  const startCheckpoint = memoryOptimizer.checkpoint(`${checkpointName}_start`);
  
  try {
    const result = await fn();
    const endCheckpoint = memoryOptimizer.checkpoint(`${checkpointName}_end`);
    
    // Auto-optimize if memory usage increased significantly
    const memoryIncrease = endCheckpoint.memory.heapUsed - startCheckpoint.memory.heapUsed;
    if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
      memoryOptimizer.optimizeMemory();
    }
    
    return result;
  } catch (error) {
    memoryOptimizer.checkpoint(`${checkpointName}_error`);
    throw error;
  }
}

export function createLazyLoader(loadFunction, options = {}) {
  return new LazyLoader(loadFunction, options);
}

// Clean up expired caches periodically
setInterval(() => {
  try {
    fileCache.cleanup();
    globalCache.clear(); // Memory cache doesn't need cleanup, just clear if needed
  } catch (error) {
    console.warn('Cache cleanup failed:', error.message);
  }
}, 60 * 60 * 1000); // Every hour