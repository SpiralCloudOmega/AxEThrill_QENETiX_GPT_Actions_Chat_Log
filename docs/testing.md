# Testing Guide

## Overview

The AxEThrill QENETiX system includes comprehensive testing infrastructure covering unit tests, integration tests, edge case validation, and system health verification.

## Test Architecture

### Test Categories

1. **Unit Tests**: Individual function and utility testing
2. **Integration Tests**: Script interactions and workflow validation
3. **Edge Case Tests**: Boundary conditions and error scenarios
4. **System Tests**: End-to-end workflow verification
5. **Performance Tests**: Benchmarking and performance validation

### Test Structure

All tests follow a consistent pattern:

```javascript
class TestRunner {
  constructor() {
    this.results = [];
    this.currentTest = null;
  }

  async runTest(name, testFn) {
    this.currentTest = name;
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, success: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({ name, success: false, error: error.message, duration });
      console.log(`❌ ${name}: ${error.message} (${duration}ms)`);
      return false;
    }
  }

  generateReport() {
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    return {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed: total - passed },
      results: this.results
    };
  }
}
```

## Test Files

### Core Test Scripts

#### Token Ledger Tests (`scripts/tests/ledger.test.mjs`)

Comprehensive testing of token tracking and rate limiting:

```bash
npm run test:ledger
```

**Test Scenarios:**

1. **Basic Creation**: Verify TokenLedger instantiation
2. **Token Addition**: Test addTokens() functionality
3. **Rate Limiting**: Validate canProceed() with limits
4. **Daily Rollover**: Test date-based token reset
5. **Persistence**: Verify save/load functionality
6. **Edge Cases**: Empty tokens, negative values, invalid dates
7. **Concurrency**: Multiple rapid token additions
8. **Memory Management**: Large token operations

**Example Test:**

```javascript
await runner.runTest('Rate limiting enforcement', () => {
  const ledger = new TokenLedger(100); // 100 token limit
  
  ledger.addTokens(50, 'test-operation');
  assert(ledger.canProceed(30), 'Should allow under limit');
  
  ledger.addTokens(40, 'test-operation');
  assert(!ledger.canProceed(20), 'Should deny over limit');
});
```

#### Markdown Ingestion Tests (`scripts/tests/ingest-edge.test.mjs`)

Edge case validation for markdown processing:

```bash
npm run test:ingest-edge
```

**Test Scenarios:**

1. **Frontmatter Parsing**: YAML header extraction
2. **Title Extraction**: Various title formats
3. **Slug Generation**: URL-safe slug creation
4. **Tag Normalization**: Tag cleaning and aliases
5. **Content Processing**: Markdown content handling
6. **Empty Files**: Zero-length file handling
7. **Malformed Headers**: Invalid frontmatter recovery
8. **Unicode Handling**: International character support
9. **Large Files**: Performance with large content

**Example Test:**

```javascript
await runner.runTest('Frontmatter with missing closing delimiter', () => {
  const content = `---
title: Test Post
tags: test, incomplete
date: 2025-01-20

This is content without proper frontmatter closing.`;

  const result = parseHeader(content);
  assert(result.title === 'Test Post', 'Should extract title despite malformed frontmatter');
});
```

#### MCP Server Tests (`scripts/tests/mcp.test.mjs`)

Model Context Protocol server validation:

```bash
npm run test:mcp
```

**Test Coverage:**

- JSON-RPC 2.0 compliance
- Request/response validation
- Error handling
- Rate limiting integration
- Logging functionality

#### Tool Validation Tests (`scripts/tools/test.mjs`)

Utility tool functionality verification:

```bash
npm run tools:test
```

**Test Coverage:**

- Memory operations
- Grep search functionality
- Web scraping tools
- File system utilities

## Running Tests

### Individual Test Suites

```bash
# Run specific test categories
npm run test:ledger          # Token ledger functionality
npm run test:ingest-edge     # Markdown processing edge cases
npm run test:mcp            # MCP server validation
npm run tools:test          # Utility tools

# Development utilities
npm run dev-utils check-health  # Quick system health check
```

### Complete Test Suite

```bash
npm run test:all
```

Runs all test categories in sequence:

1. Tool validation tests
2. Token ledger tests
3. Markdown ingestion tests
4. MCP server tests

### Expected Output

```text
🧪 Running All Tests

=== Tool Tests ===
✅ Memory operations (45ms)
✅ Grep functionality (32ms)
✅ Scraper utilities (67ms)

=== Ledger Tests ===
✅ Basic ledger creation (12ms)
✅ Token addition (8ms)
✅ Rate limiting enforcement (15ms)
✅ Daily rollover (23ms)
✅ Persistence (34ms)
✅ Edge cases (18ms)
✅ Concurrency handling (56ms)
✅ Memory management (89ms)

=== Ingestion Tests ===
✅ Standard frontmatter parsing (21ms)
✅ Title extraction variants (14ms)
✅ Slug generation (9ms)
✅ Tag normalization (17ms)
✅ Empty file handling (11ms)
✅ Malformed frontmatter (25ms)
✅ Unicode content (19ms)
✅ Large file processing (134ms)
✅ Content preservation (22ms)

=== MCP Tests ===
✅ JSON-RPC compliance (43ms)
✅ Error handling (28ms)

📊 All Tests Summary:
   Total: 21
   Passed: 21
   Failed: 0
   Duration: 567ms

✅ All tests passed successfully!
```

## Test Development

### Writing New Tests

#### 1. Create Test File

```javascript
#!/usr/bin/env node
// New test file: scripts/tests/my-feature.test.mjs
import { TestRunner } from '../lib/test-utils.mjs';

const runner = new TestRunner();

async function runMyFeatureTests() {
  console.log('🧪 Testing My Feature\n');

  await runner.runTest('Feature basic functionality', async () => {
    // Test implementation
    const result = await myFeature.process();
    assert(result.success, 'Feature should succeed');
  });

  await runner.runTest('Feature error handling', async () => {
    // Error scenario test
    await assert.rejects(
      () => myFeature.processInvalid(),
      /Expected error message/
    );
  });

  const report = runner.generateReport();
  console.log(`\n📊 Tests: ${report.summary.passed}/${report.summary.total} passed`);
  
  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMyFeatureTests().catch(error => {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  });
}
```

#### 2. Add to package.json

```json
{
  "scripts": {
    "test:my-feature": "node scripts/tests/my-feature.test.mjs"
  }
}
```

#### 3. Update test:all Script

```json
{
  "scripts": {
    "test:all": "npm run tools:test && npm run test:ledger && npm run test:ingest-edge && npm run test:mcp && npm run test:my-feature"
  }
}
```

### Test Patterns

#### Assertion Helpers

```javascript
// Basic assertions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Equality assertion
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Promise rejection assertion
async function assertRejects(fn, pattern) {
  try {
    await fn();
    throw new Error('Expected function to reject');
  } catch (error) {
    if (pattern && !pattern.test(error.message)) {
      throw new Error(`Error message "${error.message}" does not match pattern ${pattern}`);
    }
  }
}
```

#### Async Test Patterns

```javascript
// Testing async operations
await runner.runTest('Async operation', async () => {
  const result = await myAsyncFunction();
  assert(result.success, 'Async operation should succeed');
});

// Testing with timeouts
await runner.runTest('Operation with timeout', async () => {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 5000)
  );
  
  const operation = myLongRunningOperation();
  
  const result = await Promise.race([operation, timeout]);
  assert(result.completed, 'Operation should complete within timeout');
});
```

#### File System Testing

```javascript
// Testing file operations
await runner.runTest('File processing', async () => {
  const testDir = path.join(os.tmpdir(), 'test-' + Date.now());
  fs.mkdirSync(testDir);
  
  try {
    const testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');
    
    const result = await processFile(testFile);
    assert(result.success, 'File processing should succeed');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
```

## Test Environment

### Setup Requirements

```bash
# Ensure clean test environment
cd site
npm install

# Verify workspace structure
npm run health

# Clean any previous test artifacts
npm run dev-utils clean
```

### Test Data

Test files should use isolated test data:

```javascript
// Use temporary directories
const testDir = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random()}`);

// Use test-specific file names
const testFile = `test-${Date.now()}.md`;

// Clean up after tests
fs.rmSync(testDir, { recursive: true, force: true });
```

### Environment Variables

Test-specific environment variables:

```bash
# Disable external API calls during testing
export NODE_ENV=test
export AI_PROVIDER=rag
export SKIP_EXTERNAL_DEPS=true
```

## Continuous Integration

### GitHub Actions Integration

Tests are automatically run in CI:

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: cd site && npm install
      
      - name: Run health checks
        run: cd site && npm run health
      
      - name: Run test suite
        run: cd site && npm run test:all
      
      - name: Run diagnostics
        run: cd site && npm run diagnose
```

### Test Artifacts

Test results are saved for analysis:

```javascript
// Save test results
const report = runner.generateReport();
fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));

// Upload artifacts in CI
// See .github/workflows/ci.yml for artifact handling
```

## Debugging Tests

### Verbose Output

```bash
# Run tests with detailed output
DEBUG=* npm run test:all

# Run individual test with debugging
DEBUG=test npm run test:ledger
```

### Test Isolation

```bash
# Run single test scenario
node -e "
import('./scripts/tests/ledger.test.mjs').then(async m => {
  const runner = new m.TestRunner();
  await runner.runTest('Token addition', () => {
    // Single test case
  });
});
"
```

### Common Issues

#### Test Timeout

```javascript
// Add timeout handling
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Test timeout')), 10000)
);

await Promise.race([testPromise, timeoutPromise]);
```

#### File System Permissions

```bash
# Ensure test scripts are executable
chmod +x scripts/tests/*.mjs

# Check file permissions
ls -la scripts/tests/
```

#### Memory Issues

```javascript
// Monitor memory usage in tests
const memBefore = process.memoryUsage();
await runTest();
const memAfter = process.memoryUsage();

console.log(`Memory delta: ${memAfter.heapUsed - memBefore.heapUsed} bytes`);
```

## Performance Testing

### Benchmark Integration

Performance tests are integrated with monitoring:

```bash
npm run perf:quick          # Quick performance baseline
npm run perf               # Full benchmark suite
```

### Load Testing

```javascript
// Example load test
await runner.runTest('High load processing', async () => {
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(processItem(`item-${i}`));
  }
  
  const results = await Promise.all(promises);
  assert(results.every(r => r.success), 'All items should process successfully');
});
```

## Test Maintenance

### Regular Maintenance Tasks

1. **Update test data**: Keep test scenarios current
2. **Review test coverage**: Ensure new features have tests
3. **Performance baselines**: Update expected performance metrics
4. **Clean test artifacts**: Remove old test files and reports

### Test Documentation

- Document test scenarios and expected outcomes
- Update test documentation when adding new tests
- Include troubleshooting guides for test failures
- Maintain test environment setup instructions

### Best Practices

- Keep tests isolated and independent
- Use descriptive test names and error messages
- Include both positive and negative test cases
- Test edge cases and boundary conditions
- Clean up test artifacts after execution
- Run tests regularly during development
