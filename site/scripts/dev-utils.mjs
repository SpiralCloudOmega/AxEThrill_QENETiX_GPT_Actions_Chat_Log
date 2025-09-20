#!/usr/bin/env node
// Development utility script for common tasks
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

const commands = {
  'clean': {
    desc: 'Clean build artifacts and caches',
    run: () => {
      console.log('🧹 Cleaning build artifacts...');
      const cleanPaths = [
        path.join(siteDir, '.next'),
        path.join(siteDir, 'out'),
        path.join(siteDir, 'public', 'logs-index.json'),
        path.join(siteDir, 'public', 'rag-index.json'),
        path.join(siteDir, 'public', 'memory-index.json'),
        path.join(siteDir, 'tsconfig.tsbuildinfo')
      ];
      
      cleanPaths.forEach(p => {
        if (fs.existsSync(p)) {
          if (fs.statSync(p).isDirectory()) {
            fs.rmSync(p, { recursive: true });
            console.log(`  Removed directory: ${path.relative(repoRoot, p)}`);
          } else {
            fs.unlinkSync(p);
            console.log(`  Removed file: ${path.relative(repoRoot, p)}`);
          }
        }
      });
      console.log('✅ Clean complete');
    }
  },

  'dev-setup': {
    desc: 'Set up development environment',
    run: () => {
      console.log('🚀 Setting up development environment...');
      
      // Ensure directories exist
      const dirs = [
        path.join(repoRoot, 'logs', 'incoming'),
        path.join(repoRoot, 'logs', 'memory'),
        path.join(siteDir, 'public', 'ui'),
        path.join(siteDir, 'scripts', 'public')
      ];
      
      dirs.forEach(dir => {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  Created directory: ${path.relative(repoRoot, dir)}`);
      });
      
      // Create default UI config if it doesn't exist
      const uiConfigPath = path.join(siteDir, 'public', 'ui', 'config.json');
      if (!fs.existsSync(uiConfigPath)) {
        const defaultConfig = {
          "tagAliases": {
            "ai": "ai",
            "agents": "agents",
            "nvidia code": "nvidia",
            "gpt actions": "actions"
          },
          "relatedLogsConfig": {
            "maxResults": 5,
            "minSimilarity": 0.1,
            "tagOverlapBoost": 0.2
          },
          "searchConfig": {
            "maxResults": 20,
            "minScore": 0.05
          }
        };
        fs.writeFileSync(uiConfigPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`  Created default config: ${path.relative(repoRoot, uiConfigPath)}`);
      }
      
      console.log('✅ Development setup complete');
    }
  },

  'quick-build': {
    desc: 'Quick build with minimal prebuild',
    run: () => {
      console.log('⚡ Running quick build...');
      process.chdir(siteDir);
      
      try {
        execSync('npm run prebuild', { stdio: 'inherit' });
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ Quick build complete');
      } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
      }
    }
  },

  'check-health': {
    desc: 'Check system health and configuration',
    run: () => {
      console.log('🔍 Checking system health...');
      
      const checks = [
        {
          name: 'Node.js version',
          check: () => {
            const version = process.version;
            const major = parseInt(version.slice(1).split('.')[0]);
            return { ok: major >= 18, message: `${version} (requires >=18)` };
          }
        },
        {
          name: 'Dependencies installed',
          check: () => {
            const nodeModules = path.join(siteDir, 'node_modules');
            return { 
              ok: fs.existsSync(nodeModules),
              message: fs.existsSync(nodeModules) ? 'Present' : 'Missing - run npm install'
            };
          }
        },
        {
          name: 'Logs directory',
          check: () => {
            const logsDir = path.join(repoRoot, 'logs');
            const hasLogs = fs.existsSync(logsDir) && fs.readdirSync(logsDir).length > 0;
            return {
              ok: hasLogs,
              message: hasLogs ? 'Has content' : 'Empty or missing'
            };
          }
        },
        {
          name: 'Generated indexes',
          check: () => {
            const indexes = [
              path.join(siteDir, 'public', 'logs-index.json'),
              path.join(siteDir, 'public', 'health.json')
            ];
            const existing = indexes.filter(p => fs.existsSync(p));
            return {
              ok: existing.length > 0,
              message: `${existing.length}/${indexes.length} present`
            };
          }
        }
      ];
      
      let allOk = true;
      checks.forEach(check => {
        const result = check.check();
        const status = result.ok ? '✅' : '❌';
        console.log(`  ${status} ${check.name}: ${result.message}`);
        if (!result.ok) allOk = false;
      });
      
      console.log(allOk ? '✅ System health: Good' : '⚠️  System health: Issues detected');
      if (!allOk) process.exit(1);
    }
  },

  'watch-logs': {
    desc: 'Watch and auto-route incoming logs',
    run: () => {
      console.log('👀 Watching for incoming logs...');
      console.log('Press Ctrl+C to stop');
      
      const incomingDir = path.join(repoRoot, 'logs', 'incoming');
      fs.mkdirSync(incomingDir, { recursive: true });
      
      // Run route-logs every 3 seconds
      const interval = setInterval(() => {
        try {
          const files = fs.readdirSync(incomingDir);
          if (files.length > 0) {
            console.log(`  Found ${files.length} files to route...`);
            process.chdir(siteDir);
            execSync('npm run route:logs', { stdio: 'pipe' });
            console.log('  Routed successfully');
          }
        } catch (error) {
          console.error('  Routing error:', error.message);
        }
      }, 3000);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log('\n👋 Stopped watching');
        process.exit(0);
      });
    }
  },

  'stats': {
    desc: 'Show repository statistics',
    run: () => {
      console.log('📊 Repository Statistics');
      
      // Count logs
      const logsDir = path.join(repoRoot, 'logs');
      let logCount = 0;
      if (fs.existsSync(logsDir)) {
        const countFiles = (dir) => {
          const items = fs.readdirSync(dir);
          let count = 0;
          for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
              count += countFiles(fullPath);
            } else if (item.endsWith('.md')) {
              count++;
            }
          }
          return count;
        };
        logCount = countFiles(logsDir);
      }
      
      // Count memory items
      const memoryDir = path.join(repoRoot, 'logs', 'memory');
      let memoryCount = 0;
      if (fs.existsSync(memoryDir)) {
        const countJson = (dir) => {
          const items = fs.readdirSync(dir);
          let count = 0;
          for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
              count += countJson(fullPath);
            } else if (item.endsWith('.json') && !item.includes('index') && !item.includes('rate-limits')) {
              count++;
            }
          }
          return count;
        };
        memoryCount = countJson(memoryDir);
      }
      
      console.log(`  📝 Chat logs: ${logCount}`);
      console.log(`  🧠 Memory items: ${memoryCount}`);
      
      // Check health file
      const healthFile = path.join(siteDir, 'public', 'health.json');
      if (fs.existsSync(healthFile)) {
        try {
          const health = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
          console.log(`  🏷️  Unique tags: ${health.uniqueTags || 'Unknown'}`);
          console.log(`  🔍 RAG chunks: ${health.rag?.chunks || 'Unknown'}`);
          console.log(`  📅 Last build: ${health.generatedAt ? new Date(health.generatedAt).toLocaleString() : 'Unknown'}`);
        } catch (e) {
          console.log('  ⚠️  Health file corrupted');
        }
      }
    }
  }
};

function showHelp() {
  console.log('🛠️  Development Utility');
  console.log('\nAvailable commands:');
  Object.entries(commands).forEach(([cmd, info]) => {
    console.log(`  ${cmd.padEnd(15)} ${info.desc}`);
  });
  console.log('\nUsage: node dev-utils.mjs <command>');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help') {
    showHelp();
    return;
  }
  
  if (!commands[command]) {
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    commands[command].run();
  } catch (error) {
    console.error(`❌ Command failed:`, error.message);
    process.exit(1);
  }
}

main();