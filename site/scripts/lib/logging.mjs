// Enhanced logging system with structured output
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Log levels with numeric values for filtering
 */
export const LogLevel = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60
};

/**
 * Enhanced structured logger
 */
export class StructuredLogger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.service = options.service || 'chatlog-system';
    this.logDir = options.logDir || path.join(__dirname, '..', '..', 'logs', 'system');
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.rotateDaily = options.rotateDaily !== false;
    
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (this.enableFile) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error.message);
        this.enableFile = false;
      }
    }
  }

  createLogEntry(level, message, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: this.getLevelName(level),
      service: this.service,
      message,
      context,
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    };
  }

  getLevelName(level) {
    const names = {
      [LogLevel.TRACE]: 'TRACE',
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.FATAL]: 'FATAL'
    };
    return names[level] || 'UNKNOWN';
  }

  shouldLog(level) {
    return level >= this.level;
  }

  log(level, message, context = {}) {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context);

    if (this.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.enableFile) {
      this.logToFile(entry);
    }

    return entry;
  }

  logToConsole(entry) {
    const colors = {
      TRACE: '\x1b[90m',   // Gray
      DEBUG: '\x1b[36m',   // Cyan
      INFO: '\x1b[32m',    // Green
      WARN: '\x1b[33m',    // Yellow
      ERROR: '\x1b[31m',   // Red
      FATAL: '\x1b[35m',   // Magenta
      reset: '\x1b[0m'     // Reset
    };

    const color = colors[entry.level] || colors.reset;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    console.log(`${color}[${timestamp}] ${entry.level.padEnd(5)} ${entry.service}${colors.reset} ${entry.message}`);
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(`${color}   Context:${colors.reset}`, entry.context);
    }
  }

  logToFile(entry) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${this.service}-${date}.jsonl`);
      
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  // Convenience methods
  trace(message, context = {}) {
    return this.log(LogLevel.TRACE, message, context);
  }

  debug(message, context = {}) {
    return this.log(LogLevel.DEBUG, message, context);
  }

  info(message, context = {}) {
    return this.log(LogLevel.INFO, message, context);
  }

  warn(message, context = {}) {
    return this.log(LogLevel.WARN, message, context);
  }

  error(message, context = {}) {
    return this.log(LogLevel.ERROR, message, context);
  }

  fatal(message, context = {}) {
    return this.log(LogLevel.FATAL, message, context);
  }

  // Operation tracking
  startOperation(operationName, context = {}) {
    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.info(`Operation started: ${operationName}`, {
      operationId,
      operationName,
      ...context
    });

    return {
      operationId,
      operationName,
      startTime: Date.now(),
      
      success: (result = {}) => {
        const duration = Date.now() - this.startTime;
        this.info(`Operation completed: ${operationName}`, {
          operationId,
          operationName,
          duration,
          success: true,
          ...result
        });
      },
      
      failure: (error, context = {}) => {
        const duration = Date.now() - this.startTime;
        this.error(`Operation failed: ${operationName}`, {
          operationId,
          operationName,
          duration,
          success: false,
          error: error.message,
          ...context
        });
      }
    };
  }

  // Performance monitoring
  measurePerformance(fn, operationName, context = {}) {
    return async (...args) => {
      const operation = this.startOperation(operationName, context);
      
      try {
        const startTime = Date.now();
        const result = await fn(...args);
        const duration = Date.now() - startTime;
        
        operation.success({ result, duration });
        return result;
      } catch (error) {
        operation.failure(error);
        throw error;
      }
    };
  }
}

/**
 * Request/Response logger for API operations
 */
export class RequestLogger extends StructuredLogger {
  constructor(options = {}) {
    super({
      ...options,
      service: options.service || 'api-requests'
    });
  }

  logRequest(method, url, headers = {}, body = null, context = {}) {
    return this.info('HTTP Request', {
      type: 'request',
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      bodySize: body ? JSON.stringify(body).length : 0,
      ...context
    });
  }

  logResponse(method, url, statusCode, responseTime, context = {}) {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    
    return this.log(level, 'HTTP Response', {
      type: 'response',
      method,
      url,
      statusCode,
      responseTime,
      ...context
    });
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}

/**
 * Performance metrics logger
 */
export class PerformanceLogger extends StructuredLogger {
  constructor(options = {}) {
    super({
      ...options,
      service: options.service || 'performance'
    });
    
    this.metrics = new Map();
  }

  recordMetric(name, value, unit = 'ms', tags = {}) {
    const metric = {
      name,
      value,
      unit,
      tags,
      timestamp: Date.now()
    };
    
    this.metrics.set(name, metric);
    
    this.info('Performance metric', {
      metric: name,
      value,
      unit,
      tags
    });
    
    return metric;
  }

  getMetrics() {
    return Array.from(this.metrics.values());
  }

  clearMetrics() {
    this.metrics.clear();
  }

  // Timer utility
  timer(name, tags = {}) {
    const startTime = Date.now();
    
    return {
      stop: () => {
        const duration = Date.now() - startTime;
        return this.recordMetric(name, duration, 'ms', tags);
      }
    };
  }
}

/**
 * Audit logger for security and compliance
 */
export class AuditLogger extends StructuredLogger {
  constructor(options = {}) {
    super({
      ...options,
      service: options.service || 'audit',
      level: LogLevel.INFO // Audit logs should always be recorded
    });
  }

  logAccess(resource, action, user = 'system', context = {}) {
    return this.info('Resource access', {
      type: 'access',
      resource,
      action,
      user,
      ...context
    });
  }

  logDataChange(resource, action, before = null, after = null, user = 'system', context = {}) {
    return this.info('Data modification', {
      type: 'data_change',
      resource,
      action,
      user,
      before,
      after,
      ...context
    });
  }

  logSecurityEvent(event, severity = 'medium', context = {}) {
    const level = severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    
    return this.log(level, 'Security event', {
      type: 'security',
      event,
      severity,
      ...context
    });
  }
}

/**
 * Log analyzer for pattern detection
 */
export class LogAnalyzer {
  constructor(logDir) {
    this.logDir = logDir;
  }

  async analyzeDay(date) {
    const dateStr = date.toISOString().split('T')[0];
    const logFiles = this.findLogFiles(dateStr);
    
    const analysis = {
      date: dateStr,
      totalEvents: 0,
      levelCounts: {},
      errorPatterns: [],
      performanceIssues: [],
      topErrors: []
    };

    for (const logFile of logFiles) {
      await this.analyzeFile(logFile, analysis);
    }

    return analysis;
  }

  findLogFiles(dateStr) {
    const files = [];
    
    try {
      const items = fs.readdirSync(this.logDir);
      for (const item of items) {
        if (item.includes(dateStr) && item.endsWith('.jsonl')) {
          files.push(path.join(this.logDir, item));
        }
      }
    } catch (error) {
      console.error('Failed to read log directory:', error.message);
    }
    
    return files;
  }

  async analyzeFile(filePath, analysis) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          this.analyzeEntry(entry, analysis);
        } catch (error) {
          // Skip malformed log entries
        }
      }
    } catch (error) {
      console.error(`Failed to analyze log file ${filePath}:`, error.message);
    }
  }

  analyzeEntry(entry, analysis) {
    analysis.totalEvents++;
    
    // Count by level
    analysis.levelCounts[entry.level] = (analysis.levelCounts[entry.level] || 0) + 1;
    
    // Detect error patterns
    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      this.detectErrorPatterns(entry, analysis);
    }
    
    // Detect performance issues
    if (entry.context && entry.context.duration > 5000) { // >5s operations
      analysis.performanceIssues.push({
        timestamp: entry.timestamp,
        operation: entry.context.operationName || 'unknown',
        duration: entry.context.duration
      });
    }
  }

  detectErrorPatterns(entry, analysis) {
    const pattern = this.extractErrorPattern(entry.message);
    
    let existing = analysis.errorPatterns.find(p => p.pattern === pattern);
    if (!existing) {
      existing = { pattern, count: 0, examples: [] };
      analysis.errorPatterns.push(existing);
    }
    
    existing.count++;
    if (existing.examples.length < 3) {
      existing.examples.push({
        timestamp: entry.timestamp,
        message: entry.message,
        context: entry.context
      });
    }
  }

  extractErrorPattern(message) {
    // Simple pattern extraction - replace specific values with placeholders
    return message
      .replace(/\d+/g, 'NUMBER')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/\/[^\s]+/g, 'PATH')
      .replace(/https?:\/\/[^\s]+/g, 'URL');
  }
}

// Create default loggers
export const systemLogger = new StructuredLogger({
  service: 'chatlog-system',
  level: process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] : LogLevel.INFO
});

export const requestLogger = new RequestLogger();
export const performanceLogger = new PerformanceLogger();
export const auditLogger = new AuditLogger();

// Convenience function for creating service-specific loggers
export function createLogger(service, options = {}) {
  return new StructuredLogger({
    service,
    ...options
  });
}