// Enhanced error handling utilities
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced error class with context and recovery suggestions
 */
export class SystemError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'SystemError';
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.suggestions = [];
  }

  addSuggestion(suggestion) {
    this.suggestions.push(suggestion);
    return this;
  }

  addContext(key, value) {
    this.context[key] = value;
    return this;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      suggestions: this.suggestions,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * File operation error with specific recovery strategies
 */
export class FileError extends SystemError {
  constructor(message, filePath, operation, context = {}) {
    super(message, { filePath, operation, ...context });
    this.name = 'FileError';
    this.filePath = filePath;
    this.operation = operation;

    // Add common recovery suggestions based on operation
    this.addAutoSuggestions();
  }

  addAutoSuggestions() {
    switch (this.operation) {
      case 'read':
        this.addSuggestion('Check if file exists and is readable');
        this.addSuggestion('Verify file permissions');
        break;
      case 'write':
        this.addSuggestion('Check directory permissions');
        this.addSuggestion('Ensure parent directory exists');
        break;
      case 'parse':
        this.addSuggestion('Validate file syntax');
        this.addSuggestion('Check for special characters or encoding issues');
        break;
    }
  }
}

/**
 * Network/API error with retry strategies
 */
export class NetworkError extends SystemError {
  constructor(message, endpoint, statusCode = null, context = {}) {
    super(message, { endpoint, statusCode, ...context });
    this.name = 'NetworkError';
    this.endpoint = endpoint;
    this.statusCode = statusCode;

    this.addAutoSuggestions();
  }

  addAutoSuggestions() {
    if (this.statusCode >= 500) {
      this.addSuggestion('Server error - retry after delay');
      this.addSuggestion('Check service status');
    } else if (this.statusCode === 429) {
      this.addSuggestion('Rate limited - implement exponential backoff');
    } else if (this.statusCode >= 400) {
      this.addSuggestion('Client error - check request parameters');
      this.addSuggestion('Verify API credentials');
    }
  }
}

/**
 * Configuration error with setup guidance
 */
export class ConfigError extends SystemError {
  constructor(message, configFile = null, context = {}) {
    super(message, { configFile, ...context });
    this.name = 'ConfigError';
    this.configFile = configFile;

    this.addSuggestion('Review configuration documentation');
    if (configFile) {
      this.addSuggestion(`Check ${configFile} for syntax errors`);
    }
  }
}

/**
 * Enhanced error logger with structured logging
 */
export class ErrorLogger {
  constructor(logDir = null) {
    this.logDir = logDir || path.join(__dirname, '..', 'logs', 'errors');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create error log directory:', error.message);
    }
  }

  log(error, severity = 'error') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      severity,
      error: error instanceof SystemError ? error.toJSON() : {
        name: error.name || 'Error',
        message: error.message,
        stack: error.stack
      },
      process: {
        pid: process.pid,
        argv: process.argv,
        cwd: process.cwd(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          NODE_VERSION: process.version
        }
      }
    };

    // Console output with colors
    this.logToConsole(logEntry);

    // File output
    this.logToFile(logEntry);

    return logEntry;
  }

  logToConsole(logEntry) {
    const colors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      reset: '\x1b[0m'     // Reset
    };

    const color = colors[logEntry.severity] || colors.reset;
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    
    console.error(`${color}[${timestamp}] ${logEntry.severity.toUpperCase()}${colors.reset}`);
    console.error(`${color}${logEntry.error.message}${colors.reset}`);
    
    if (logEntry.error.context && Object.keys(logEntry.error.context).length > 0) {
      console.error('Context:', logEntry.error.context);
    }
    
    if (logEntry.error.suggestions && logEntry.error.suggestions.length > 0) {
      console.error('💡 Suggestions:');
      logEntry.error.suggestions.forEach(suggestion => {
        console.error(`   - ${suggestion}`);
      });
    }
  }

  logToFile(logEntry) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `error-${date}.jsonl`);
      
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write error log:', error.message);
    }
  }
}

/**
 * Retry utility with exponential backoff
 */
export class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffFactor = options.backoffFactor || 2;
  }

  async execute(operation, operationName = 'operation') {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) {
          // Final attempt failed
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffFactor, attempt),
          this.maxDelay
        );

        console.warn(`${operationName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`);
        console.warn(`Error: ${error.message}`);

        await this.sleep(delay);
      }
    }

    // All attempts failed
    throw new SystemError(
      `${operationName} failed after ${this.maxRetries + 1} attempts`,
      { lastError: lastError.message, attempts: this.maxRetries + 1 }
    ).addSuggestion('Check system connectivity and resources')
     .addSuggestion('Increase retry limits if needed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Safe file operations with automatic error handling
 */
export class SafeFileOps {
  constructor(logger = null) {
    this.logger = logger || new ErrorLogger();
  }

  async readFile(filePath, encoding = 'utf8') {
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      const fileError = new FileError(
        `Failed to read file: ${error.message}`,
        filePath,
        'read',
        { errno: error.errno, code: error.code }
      );

      if (error.code === 'ENOENT') {
        fileError.addSuggestion('Create the file or check the path');
      } else if (error.code === 'EACCES') {
        fileError.addSuggestion('Check file permissions: chmod 644 ' + filePath);
      }

      this.logger.log(fileError);
      throw fileError;
    }
  }

  async writeFile(filePath, content, options = {}) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      
      fs.writeFileSync(filePath, content, options);
      return true;
    } catch (error) {
      const fileError = new FileError(
        `Failed to write file: ${error.message}`,
        filePath,
        'write',
        { errno: error.errno, code: error.code }
      );

      if (error.code === 'ENOSPC') {
        fileError.addSuggestion('Free up disk space');
      } else if (error.code === 'EACCES') {
        fileError.addSuggestion('Check directory permissions');
      }

      this.logger.log(fileError);
      throw fileError;
    }
  }

  async parseJSON(filePath) {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof FileError) {
        throw error; // Re-throw file errors
      }

      const parseError = new FileError(
        `Failed to parse JSON: ${error.message}`,
        filePath,
        'parse',
        { position: this.findJSONErrorPosition(error.message) }
      );

      parseError.addSuggestion('Validate JSON syntax with a linter');
      parseError.addSuggestion('Check for trailing commas or unquoted keys');

      this.logger.log(parseError);
      throw parseError;
    }
  }

  findJSONErrorPosition(errorMessage) {
    const match = errorMessage.match(/position (\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}

/**
 * Process manager with graceful shutdown
 */
export class ProcessManager {
  constructor() {
    this.shutdownHandlers = [];
    this.isShuttingDown = false;
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => this.gracefulShutdown(signal));
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.emergencyShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.emergencyShutdown('unhandledRejection');
    });
  }

  addShutdownHandler(handler, name = 'handler') {
    this.shutdownHandlers.push({ handler, name });
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(`\n🔄 Graceful shutdown initiated (${signal})`);

    try {
      for (const { handler, name } of this.shutdownHandlers) {
        console.log(`   Executing ${name}...`);
        await Promise.race([
          handler(),
          this.timeout(5000, `${name} timeout`)
        ]);
      }

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  }

  emergencyShutdown(reason) {
    console.error(`🚨 Emergency shutdown: ${reason}`);
    process.exit(1);
  }

  timeout(ms, message) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    );
  }
}

// Create singleton instances
export const errorLogger = new ErrorLogger();
export const retryManager = new RetryManager();
export const safeFileOps = new SafeFileOps(errorLogger);
export const processManager = new ProcessManager();

// Convenience function for error handling
export function handleError(error, context = {}) {
  if (!(error instanceof SystemError)) {
    error = new SystemError(error.message, context);
  }
  
  errorLogger.log(error);
  return error;
}

// Wrapper for async operations with error handling
export function withErrorHandling(asyncFn, context = {}) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  };
}