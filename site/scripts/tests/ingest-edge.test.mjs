#!/usr/bin/env node
// Ingest edge case tests - validates file ingestion and edge handling
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const incomingDir = path.join(repoRoot, 'logs', 'incoming');

// Simulate ingest functionality for testing
function parseMarkdownFrontmatter(content) {
  const lines = content.split('\n');
  const frontmatter = {};
  let _inFrontmatter = false;
  let contentStart = 0;
  
  if (lines[0]?.trim() === '---') {
    _inFrontmatter = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        contentStart = i + 1;
        break;
      }
      const match = lines[i]?.match(/^(\w+):\s*(.*)$/);
      if (match) {
        frontmatter[match[1]] = match[2].trim();
      }
    }
  }
  
  const body = lines.slice(contentStart).join('\n').trim();
  return { frontmatter, body };
}

function extractTitleFromContent(content) {
  // Look for first h1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  
  // Look for title in first few lines
  const lines = content.split('\n').slice(0, 10);
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#') && line.length > 3) {
      return line.trim().slice(0, 50);
    }
  }
  
  return 'Untitled';
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'document';
}

function createIngestFilename(title, _tags = []) {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  
  const slug = generateSlug(title);
  return `${timestamp}-${slug}.md`;
}

function ingestMarkdown(content, options = {}) {
  const { frontmatter, body } = parseMarkdownFrontmatter(content);
  
  // Extract title
  const title = frontmatter.title || extractTitleFromContent(body) || options.title || 'Ingested Document';
  
  // Extract/add tags
  const existingTags = frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()) : [];
  const newTags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
  const allTags = [...new Set([...existingTags, ...newTags])].filter(Boolean);
  
  // Create final content with frontmatter
  const finalFrontmatter = {
    title,
    ...(frontmatter.date && { date: frontmatter.date }),
    ...(allTags.length > 0 && { tags: allTags.join(', ') }),
    ...frontmatter
  };
  
  let finalContent = '';
  if (Object.keys(finalFrontmatter).length > 0) {
    finalContent += '---\n';
    for (const [key, value] of Object.entries(finalFrontmatter)) {
      finalContent += `${key}: ${value}\n`;
    }
    finalContent += '---\n\n';
  }
  
  finalContent += body;
  
  const filename = createIngestFilename(title, allTags);
  return { content: finalContent, filename, title, tags: allTags };
}

async function main() {
  console.log('Testing ingest edge cases...');
  
  // Ensure test directory exists
  fs.mkdirSync(incomingDir, { recursive: true });
  
  // Test 1: Basic markdown without frontmatter
  const basicMd = `# Test Document
  
This is a test document with some content.
  
## Section
More content here.`;
  
  const result1 = ingestMarkdown(basicMd);
  assert.equal(result1.title, 'Test Document', 'Should extract title from h1');
  assert.ok(result1.filename.includes('test-document'), 'Filename should include slugified title');
  assert.ok(result1.content.includes('title: Test Document'), 'Should add frontmatter with title');
  
  // Test 2: Document with existing frontmatter
  const frontmatterMd = `---
title: Original Title
date: 2025-09-20
tags: existing, tags
---

# Heading in Body

Content goes here.`;
  
  const result2 = ingestMarkdown(frontmatterMd, { tags: 'new, additional' });
  assert.equal(result2.title, 'Original Title', 'Should preserve existing title');
  assert.ok(result2.tags.includes('existing'), 'Should preserve existing tags');
  assert.ok(result2.tags.includes('new'), 'Should add new tags');
  assert.equal(result2.tags.length, 4, 'Should have all tags combined');
  
  // Test 3: Document without clear title
  const noTitleMd = `Some content without a clear title.
  
Just paragraphs of text here.
More text.`;
  
  const result3 = ingestMarkdown(noTitleMd, { title: 'Fallback Title' });
  assert.equal(result3.title, 'Fallback Title', 'Should use provided fallback title');
  
  // Test 4: Empty/minimal content
  const minimalMd = ``;
  const result4 = ingestMarkdown(minimalMd);
  assert.equal(result4.title, 'Untitled', 'Should handle empty content gracefully');
  assert.ok(result4.filename.includes('untitled'), 'Filename should handle untitled docs');
  
  // Test 5: Special characters in title
  const specialMd = `# "Special" Title: With [Brackets] & Symbols!
  
Content with special characters.`;
  
  const result5 = ingestMarkdown(specialMd);
  assert.equal(result5.title, '"Special" Title: With [Brackets] & Symbols!', 'Should preserve special chars in title');
  assert.ok(!result5.filename.includes('['), 'Filename should sanitize special chars');
  assert.ok(result5.filename.includes('special-title'), 'Filename should be slugified');
  
  // Test 6: Very long title
  const longTitle = 'A'.repeat(100);
  const longMd = `# ${longTitle}
  
Content.`;
  
  const result6 = ingestMarkdown(longMd);
  assert.ok(result6.filename.length < 100, 'Filename should be truncated for long titles');
  
  // Test 7: Multiple h1 headings (should use first)
  const multiH1Md = `# First Title
  
Some content.
  
# Second Title
  
More content.`;
  
  const result7 = ingestMarkdown(multiH1Md);
  assert.equal(result7.title, 'First Title', 'Should use first h1 heading');
  
  // Test 8: Tags normalization
  const tagsResult = ingestMarkdown('# Test', { tags: ' tag1 , tag2,, tag3 ,' });
  assert.deepEqual(tagsResult.tags, ['tag1', 'tag2', 'tag3'], 'Should normalize tags properly');
  
  // Test 9: Write and verify file creation
  const testFilePath = path.join(incomingDir, 'edge-test.md');
  const testResult = ingestMarkdown('# Edge Test\n\nTest content.', { tags: 'test, edge-case' });
  
  // Simulate file write
  fs.writeFileSync(testFilePath, testResult.content);
  assert.ok(fs.existsSync(testFilePath), 'Should create file successfully');
  
  const writtenContent = fs.readFileSync(testFilePath, 'utf8');
  assert.ok(writtenContent.includes('title: Edge Test'), 'Written file should contain frontmatter');
  assert.ok(writtenContent.includes('tags: test, edge-case'), 'Written file should contain tags');
  assert.ok(writtenContent.includes('Test content.'), 'Written file should contain body');
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
  
  console.log('✅ All ingest edge case tests passed');
}

main().catch((e) => {
  console.error('❌ Ingest edge test failed:', e);
  process.exit(1);
});