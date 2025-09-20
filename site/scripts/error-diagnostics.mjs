#!/usr/bin/env node
// Automated error detection and diagnostics
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

class ErrorDiagnostics {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
    this.context = new Map();
  }

  addError(category, message, file = null, line = null, suggestion = null) {
    this.errors.push({
      category,
      message,
      file,
      line,
      suggestion,
      timestamp: new Date().toISOString()
    });
  }

  addWarning(category, message, file = null, suggestion = null) {
    this.warnings.push({
      category,
      message,
      file,
      suggestion,
      timestamp: new Date().toISOString()
    });
  }

  addFix(description, action, risk = 'low') {
    this.fixes.push({
      description,
      action,
      risk,
      timestamp: new Date().toISOString()
    });
  }

  async checkJsonSyntax() {
    console.log('🔍 Checking JSON syntax...');
    
    const jsonFiles = [
      'package.json',
      'tsconfig.json',
      'public/ui/config.json'
    ];

    for (const relativePath of jsonFiles) {
      const fullPath = path.join(siteDir, relativePath);
      
      if (!fs.existsSync(fullPath)) {
        this.addWarning('missing_file', `JSON file not found: ${relativePath}`, relativePath);
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        JSON.parse(content);
        console.log(`   ✅ ${relativePath}`);
      } catch (error) {
        this.addError('json_syntax', `Invalid JSON in ${relativePath}: ${error.message}`, relativePath, null, 
          'Check for trailing commas, unquoted keys, or malformed JSON structure');
        console.log(`   ❌ ${relativePath} - ${error.message}`);
      }
    }
  }

  async checkPackageIntegrity() {
    console.log('📦 Checking package integrity...');
    
    const packagePath = path.join(siteDir, 'package.json');
    const lockPath = path.join(siteDir, 'package-lock.json');
    const nodeModulesPath = path.join(siteDir, 'node_modules');

    if (!fs.existsSync(packagePath)) {
      this.addError('missing_file', 'package.json not found', 'package.json', null, 
        'Initialize with: npm init');
      return;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check for required fields
      const requiredFields = ['name', 'version', 'scripts'];
      for (const field of requiredFields) {
        if (!pkg[field]) {
          this.addWarning('package_config', `Missing ${field} in package.json`, 'package.json');
        }
      }

      // Check for inconsistent scripts
      const scripts = pkg.scripts || {};
      const scriptIssues = [];
      
      // Check for non-existent script files
      for (const [name, command] of Object.entries(scripts)) {
        if (command.includes('node ') && command.includes('.mjs')) {
          const scriptFile = command.match(/node\s+([^\s]+\.mjs)/)?.[1];
          if (scriptFile) {
            const scriptPath = path.resolve(siteDir, scriptFile);
            if (!fs.existsSync(scriptPath)) {
              scriptIssues.push(`Script "${name}" references missing file: ${scriptFile}`);
            }
          }
        }
      }

      if (scriptIssues.length > 0) {
        for (const issue of scriptIssues) {
          this.addError('script_reference', issue, 'package.json', null, 
            'Remove the script or create the referenced file');
        }
      }

      // Check lock file sync
      if (fs.existsSync(lockPath) && fs.existsSync(nodeModulesPath)) {
        const lockStats = fs.statSync(lockPath);
        const pkgStats = fs.statSync(packagePath);
        
        if (pkgStats.mtime > lockStats.mtime) {
          this.addWarning('dependency_sync', 'package.json newer than package-lock.json', 'package.json',
            'Run: npm install');
        }
      }

      console.log('   ✅ Package structure valid');

    } catch (error) {
      this.addError('package_parse', `Failed to parse package.json: ${error.message}`, 'package.json');
    }
  }

  async checkWorkflowSyntax() {
    console.log('⚙️ Checking GitHub workflows...');
    
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    
    if (!fs.existsSync(workflowsDir)) {
      this.addWarning('missing_directory', 'No GitHub workflows directory found', '.github/workflows');
      return;
    }

    const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    
    for (const workflowFile of workflowFiles) {
      const workflowPath = path.join(workflowsDir, workflowFile);
      const content = fs.readFileSync(workflowPath, 'utf8');
      
      // Basic YAML syntax check (simplified)
      const lines = content.split('\n');
      let inTemplate = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Check for common template syntax issues
        if (line.includes('${{') && !line.includes('}}')) {
          this.addError('workflow_syntax', `Unclosed template expression`, workflowFile, lineNum,
            'Ensure all ${{ expressions are properly closed with }}');
        }
        
        // Check for missing quotes around special characters
        if (line.includes(': *') && !line.includes('"*"') && !line.includes("'*'")) {
          this.addWarning('workflow_style', `Unquoted wildcard may cause issues`, workflowFile, lineNum,
            'Quote wildcard patterns: "*" instead of *');
        }
        
        // Check for indentation issues (basic)
        if (line.match(/^\s+\S/) && line.length > 0) {
          const indent = line.match(/^(\s*)/)[1].length;
          if (indent % 2 !== 0) {
            this.addWarning('workflow_indentation', `Odd indentation (${indent} spaces)`, workflowFile, lineNum,
              'Use consistent 2-space indentation');
          }
        }
      }
      
      console.log(`   ✅ ${workflowFile}`);
    }
  }

  async checkFilePermissions() {
    console.log('🔐 Checking file permissions...');
    
    const scriptsDir = path.join(siteDir, 'scripts');
    
    if (!fs.existsSync(scriptsDir)) {
      this.addWarning('missing_directory', 'Scripts directory not found', 'scripts');
      return;
    }

    const scriptFiles = fs.readdirSync(scriptsDir)
      .filter(f => f.endsWith('.mjs'))
      .map(f => path.join(scriptsDir, f));

    for (const scriptFile of scriptFiles) {
      try {
        const stats = fs.statSync(scriptFile);
        const mode = stats.mode;
        
        // Check if file is executable (simplified check)
        const isExecutable = (mode & parseInt('111', 8)) !== 0;
        
        if (!isExecutable) {
          const relativePath = path.relative(repoRoot, scriptFile);
          this.addWarning('file_permissions', `Script not executable: ${relativePath}`, relativePath,
            `Run: chmod +x ${relativePath}`);
        }
      } catch (error) {
        // Permission check failed, not critical
      }
    }
    
    console.log('   ✅ File permissions checked');
  }

  async checkDependencyIssues() {
    console.log('🔗 Checking dependencies...');
    
    const nodeModulesPath = path.join(siteDir, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      this.addError('missing_dependencies', 'node_modules not found', null, null, 
        'Run: npm install');
      return;
    }

    // Check for common vulnerability indicators
    try {
      const auditResult = execSync('npm audit --json', { 
        cwd: siteDir, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities) {
        const vulnCount = Object.keys(audit.vulnerabilities).length;
        if (vulnCount > 0) {
          this.addWarning('security_vulnerabilities', 
            `${vulnCount} security vulnerabilities found`, 'package.json',
            'Run: npm audit fix');
        }
      }
      
      console.log('   ✅ Dependency security checked');
      
    } catch (error) {
      // npm audit failed, might be due to no package-lock.json
      this.addWarning('audit_failed', 'npm audit failed', null, 
        'Ensure package-lock.json exists and dependencies are installed');
    }
  }

  async checkConfigurationConsistency() {
    console.log('⚙️ Checking configuration consistency...');
    
    // Check TypeScript config
    const tsconfigPath = path.join(siteDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        
        // Check for strict mode
        if (!tsconfig.compilerOptions?.strict) {
          this.addWarning('typescript_config', 'TypeScript strict mode not enabled', 'tsconfig.json',
            'Enable strict mode for better type safety');
        }
        
        console.log('   ✅ TypeScript configuration');
      } catch (error) {
        this.addError('config_parse', 'Failed to parse tsconfig.json', 'tsconfig.json');
      }
    }

    // Check Next.js config
    const nextConfigPath = path.join(siteDir, 'next.config.js');
    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Check for common issues
      if (!content.includes('output:') && !content.includes('trailingSlash:')) {
        this.addWarning('nextjs_config', 'Next.js config may be missing export settings', 'next.config.js',
          'Ensure proper configuration for static export');
      }
      
      console.log('   ✅ Next.js configuration');
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        suggested_fixes: this.fixes.length
      },
      errors: this.errors,
      warnings: this.warnings,
      suggested_fixes: this.fixes,
      context: Object.fromEntries(this.context)
    };

    // Save report
    const reportsDir = path.join(siteDir, 'public', 'diagnostics');
    fs.mkdirSync(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, 'error-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    return report;
  }

  displaySummary() {
    console.log('\n📊 Diagnostics Summary:');
    console.log(`   Errors: ${this.errors.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    console.log(`   Suggested fixes: ${this.fixes.length}\n`);

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(error => {
        const location = error.file ? ` (${error.file}${error.line ? `:${error.line}` : ''})` : '';
        console.log(`   ${error.category}: ${error.message}${location}`);
        if (error.suggestion) {
          console.log(`      💡 ${error.suggestion}`);
        }
      });
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => {
        const location = warning.file ? ` (${warning.file})` : '';
        console.log(`   ${warning.category}: ${warning.message}${location}`);
        if (warning.suggestion) {
          console.log(`      💡 ${warning.suggestion}`);
        }
      });
      console.log();
    }

    if (this.fixes.length > 0) {
      console.log('🔧 Suggested fixes:');
      this.fixes.forEach(fix => {
        const risk = fix.risk === 'high' ? '⚠️ ' : fix.risk === 'medium' ? '⚡ ' : '✅ ';
        console.log(`   ${risk}${fix.description}`);
        console.log(`      ${fix.action}`);
      });
      console.log();
    }
  }
}

async function runDiagnostics() {
  console.log('🔍 Running Error Diagnostics\n');
  
  const diagnostics = new ErrorDiagnostics();
  
  try {
    await diagnostics.checkJsonSyntax();
    await diagnostics.checkPackageIntegrity();
    await diagnostics.checkWorkflowSyntax();
    await diagnostics.checkFilePermissions();
    await diagnostics.checkDependencyIssues();
    await diagnostics.checkConfigurationConsistency();
  } catch (error) {
    console.error('❌ Diagnostics failed:', error.message);
    process.exit(1);
  }
  
  const report = await diagnostics.generateReport();
  diagnostics.displaySummary();
  
  const reportPath = path.relative(repoRoot, path.join(siteDir, 'public', 'diagnostics', 'error-report.json'));
  console.log(`📁 Full report saved: ${reportPath}\n`);
  
  // Exit with appropriate code
  if (diagnostics.errors.length > 0) {
    console.log('❌ Critical errors found. Fix these issues before proceeding.');
    process.exit(1);
  } else if (diagnostics.warnings.length > 0) {
    console.log('⚠️  Warnings found. Consider addressing these for optimal operation.');
    process.exit(2);
  } else {
    console.log('✅ No issues detected. System appears healthy.');
    process.exit(0);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Error Diagnostics Tool');
    console.log('');
    console.log('Usage: error-diagnostics.mjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h    Show this help message');
    console.log('');
    console.log('Exit codes:');
    console.log('  0    No issues found');
    console.log('  1    Critical errors detected');
    console.log('  2    Warnings detected');
    return;
  }
  
  await runDiagnostics();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error diagnostics failed:', error.message);
    process.exit(1);
  });
}