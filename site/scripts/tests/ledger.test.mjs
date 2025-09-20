#!/usr/bin/env node
// Token ledger test - validates token tracking and rate limiting functionality
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const mcpDir = path.join(logsDir, 'memory', 'mcp');

// Simple token ledger implementation for testing
class TokenLedger {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to load ledger:', e.message);
    }
    return { date: new Date().toISOString().split('T')[0], counts: {}, limit: 500 };
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  addRequest(method, tokens = 0) {
    const today = new Date().toISOString().split('T')[0];
    if (this.data.date !== today) {
      this.data = { date: today, counts: {}, limit: this.data.limit || 500 };
    }
    
    if (!this.data.counts[method]) {
      this.data.counts[method] = { requests: 0, tokens: 0 };
    }
    
    this.data.counts[method].requests++;
    this.data.counts[method].tokens += tokens;
    this.save();
    
    return this.getTotalRequests() <= this.data.limit;
  }

  getTotalRequests() {
    return Object.values(this.data.counts).reduce((sum, count) => sum + count.requests, 0);
  }

  getRemainingRequests() {
    return Math.max(0, this.data.limit - this.getTotalRequests());
  }

  isWithinLimit() {
    return this.getTotalRequests() < this.data.limit;
  }

  reset() {
    this.data = { date: new Date().toISOString().split('T')[0], counts: {}, limit: 500 };
    this.save();
  }
}

async function main() {
  console.log('Testing token ledger functionality...');
  
  // Test file path
  const testLedgerPath = path.join(mcpDir, 'test-rate-limits.json');
  
  // Clean up any existing test file
  if (fs.existsSync(testLedgerPath)) {
    fs.unlinkSync(testLedgerPath);
  }
  
  // 1. Test basic ledger creation and initialization
  const ledger = new TokenLedger(testLedgerPath);
  assert.ok(ledger.data.date, 'Ledger should have a date');
  assert.equal(typeof ledger.data.counts, 'object', 'Ledger should have counts object');
  assert.equal(ledger.data.limit, 500, 'Default limit should be 500');
  
  // 2. Test adding requests
  assert.ok(ledger.addRequest('test.method', 10), 'First request should be allowed');
  assert.equal(ledger.getTotalRequests(), 1, 'Total requests should be 1');
  assert.equal(ledger.data.counts['test.method'].tokens, 10, 'Tokens should be tracked');
  
  // 3. Test multiple methods
  ledger.addRequest('another.method', 5);
  ledger.addRequest('test.method', 15);
  assert.equal(ledger.getTotalRequests(), 3, 'Total requests should be 3');
  assert.equal(ledger.data.counts['test.method'].requests, 2, 'test.method should have 2 requests');
  assert.equal(ledger.data.counts['test.method'].tokens, 25, 'test.method should have 25 tokens');
  
  // 4. Test rate limiting
  // Add requests up to limit
  for (let i = 0; i < 497; i++) {
    ledger.addRequest('bulk.method', 1);
  }
  assert.equal(ledger.getTotalRequests(), 500, 'Should reach the limit');
  assert.ok(!ledger.addRequest('over.limit', 1), 'Request over limit should be rejected');
  
  // 5. Test remaining requests calculation
  ledger.reset();
  ledger.addRequest('test', 1);
  assert.equal(ledger.getRemainingRequests(), 499, 'Should have 499 remaining requests');
  
  // 6. Test file persistence
  const ledger2 = new TokenLedger(testLedgerPath);
  assert.equal(ledger2.getTotalRequests(), 1, 'Ledger should persist to file');
  
  // 7. Test date rollover simulation
  ledger.data.date = '2025-01-01'; // Old date
  ledger.save();
  const ledger3 = new TokenLedger(testLedgerPath);
  ledger3.addRequest('new.day', 1);
  assert.notEqual(ledger3.data.date, '2025-01-01', 'Date should roll over to today');
  assert.equal(ledger3.getTotalRequests(), 1, 'Counts should reset on new day');
  
  // 8. Test within limit check
  ledger.reset();
  assert.ok(ledger.isWithinLimit(), 'Empty ledger should be within limit');
  for (let i = 0; i < 500; i++) {
    ledger.addRequest('limit.test', 1);
  }
  assert.ok(!ledger.isWithinLimit(), 'Full ledger should not be within limit');
  
  // Clean up test file
  if (fs.existsSync(testLedgerPath)) {
    fs.unlinkSync(testLedgerPath);
  }
  
  console.log('✅ All ledger tests passed');
}

main().catch((e) => {
  console.error('❌ Ledger test failed:', e);
  process.exit(1);
});