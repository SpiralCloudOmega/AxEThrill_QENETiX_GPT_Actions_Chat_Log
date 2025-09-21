#!/usr/bin/env node
/**
 * Session Recovery System
 * Ensures work state persists across environment refreshes
 * Auto-saves progress, detects environment changes, restores state
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const sessionDir = path.join(rootDir, 'logs', 'session');
const sessionFile = path.join(sessionDir, 'current-session.json');
const chatHistoryDir = path.join(sessionDir, 'chat-history');

/**
 * Session state structure
 */
const createSessionState = () => ({
  sessionId: generateSessionId(),
  startTime: new Date().toISOString(),
  lastUpdate: new Date().toISOString(),
  environmentId: process.env.CODESPACE_NAME || process.env.HOSTNAME || 'local',
  workState: {
    currentTodos: [],
    lastCompletedTask: null,
    activeFiles: [],
    progress: {
      testsImplemented: 0,
      monitoringToolsCreated: 0,
      performanceOptimizationsAdded: 0,
      documentationCompleted: 0
    }
  },
  chatHistory: [],
  achievements: [],
  nextSteps: []
});

function generateSessionId() {
  return `session-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize session recovery system
 */
export async function initializeSessionRecovery() {
  try {
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.mkdir(chatHistoryDir, { recursive: true });
    
    const existingSession = await loadSession();
    if (existingSession && existingSession.environmentId !== (process.env.CODESPACE_NAME || process.env.HOSTNAME || 'local')) {
      console.log('🔄 Environment refresh detected! Restoring previous session...');
      await restoreSession(existingSession);
    } else if (!existingSession) {
      console.log('🚀 Starting new session...');
      await createNewSession();
    } else {
      console.log('📋 Continuing existing session...');
    }
    
    // Set up auto-save
    setupAutoSave();
    
    return await loadSession();
  } catch (error) {
    console.error('❌ Session recovery initialization failed:', error);
    return createSessionState();
  }
}

/**
 * Load existing session
 */
export async function loadSession() {
  try {
    const sessionData = await fs.readFile(sessionFile, 'utf8');
    return JSON.parse(sessionData);
  } catch (error) {
    return null;
  }
}

/**
 * Save current session state
 */
export async function saveSession(sessionState) {
  try {
    sessionState.lastUpdate = new Date().toISOString();
    await fs.writeFile(sessionFile, JSON.stringify(sessionState, null, 2));
    
    // Also save a timestamped backup
    const backupFile = path.join(sessionDir, `backup-${Date.now()}.json`);
    await fs.writeFile(backupFile, JSON.stringify(sessionState, null, 2));
    
    // Clean old backups (keep last 10)
    await cleanOldBackups();
  } catch (error) {
    console.error('❌ Failed to save session:', error);
  }
}

/**
 * Create new session
 */
async function createNewSession() {
  const newSession = createSessionState();
  await saveSession(newSession);
  console.log(`✅ New session created: ${newSession.sessionId}`);
  return newSession;
}

/**
 * Restore session after environment refresh
 */
async function restoreSession(previousSession) {
  console.log(`🔄 Restoring session: ${previousSession.sessionId}`);
  console.log(`📅 Original start time: ${previousSession.startTime}`);
  console.log(`🏗️  Progress restored:`);
  console.log(`   - Tests: ${previousSession.workState.progress.testsImplemented}`);
  console.log(`   - Monitoring: ${previousSession.workState.progress.monitoringToolsCreated}`);
  console.log(`   - Performance: ${previousSession.workState.progress.performanceOptimizationsAdded}`);
  console.log(`   - Documentation: ${previousSession.workState.progress.documentationCompleted}`);
  
  // Update environment ID but keep session continuity
  previousSession.environmentId = process.env.CODESPACE_NAME || process.env.HOSTNAME || 'local';
  previousSession.achievements.push({
    type: 'environment_refresh_survived',
    timestamp: new Date().toISOString(),
    description: 'Successfully restored state after environment refresh'
  });
  
  await saveSession(previousSession);
}

/**
 * Save chat message to persistent history
 */
export async function saveChatMessage(message, type = 'user') {
  try {
    const timestamp = new Date().toISOString();
    const filename = `chat-${timestamp.split('T')[0]}.jsonl`;
    const chatFile = path.join(chatHistoryDir, filename);
    
    const chatEntry = {
      timestamp,
      type,
      content: message,
      sessionId: (await loadSession())?.sessionId || 'unknown'
    };
    
    await fs.appendFile(chatFile, JSON.stringify(chatEntry) + '\n');
    
    // Also update session with latest chat
    const session = await loadSession();
    if (session) {
      session.chatHistory = session.chatHistory.slice(-50); // Keep last 50 messages in memory
      session.chatHistory.push(chatEntry);
      await saveSession(session);
    }
  } catch (error) {
    console.error('❌ Failed to save chat message:', error);
  }
}

/**
 * Update work progress
 */
export async function updateProgress(area, increment = 1) {
  try {
    const session = await loadSession();
    if (session) {
      session.workState.progress[area] = (session.workState.progress[area] || 0) + increment;
      session.achievements.push({
        type: 'progress_update',
        timestamp: new Date().toISOString(),
        area,
        newValue: session.workState.progress[area]
      });
      await saveSession(session);
    }
  } catch (error) {
    console.error('❌ Failed to update progress:', error);
  }
}

/**
 * Add achievement
 */
export async function addAchievement(description, type = 'general') {
  try {
    const session = await loadSession();
    if (session) {
      session.achievements.push({
        type,
        timestamp: new Date().toISOString(),
        description
      });
      await saveSession(session);
      console.log(`🏆 Achievement unlocked: ${description}`);
    }
  } catch (error) {
    console.error('❌ Failed to add achievement:', error);
  }
}

/**
 * Set up auto-save every 30 seconds
 */
function setupAutoSave() {
  setInterval(async () => {
    const session = await loadSession();
    if (session) {
      await saveSession(session);
    }
  }, 30000);
}

/**
 * Clean old backup files
 */
async function cleanOldBackups() {
  try {
    const files = await fs.readdir(sessionDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup-'))
      .map(f => ({ name: f, path: path.join(sessionDir, f) }))
      .sort((a, b) => {
        const aTime = parseInt(a.name.split('-')[1].split('.')[0]);
        const bTime = parseInt(b.name.split('-')[1].split('.')[0]);
        return bTime - aTime;
      });
    
    // Keep only last 10 backups
    const toDelete = backupFiles.slice(10);
    for (const file of toDelete) {
      await fs.unlink(file.path);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Export current chat history to markdown
 */
export async function exportChatHistory() {
  try {
    const session = await loadSession();
    if (!session) return;
    
    const exportFile = path.join(rootDir, 'logs', 'incoming', `chat-export-${new Date().toISOString().split('T')[0]}.md`);
    
    let markdown = `# Chat Session Export\n\n`;
    markdown += `**Session ID**: ${session.sessionId}\n`;
    markdown += `**Start Time**: ${session.startTime}\n`;
    markdown += `**Export Time**: ${new Date().toISOString()}\n\n`;
    
    markdown += `## Progress Summary\n\n`;
    markdown += `- Tests Implemented: ${session.workState.progress.testsImplemented}\n`;
    markdown += `- Monitoring Tools: ${session.workState.progress.monitoringToolsCreated}\n`;
    markdown += `- Performance Optimizations: ${session.workState.progress.performanceOptimizationsAdded}\n`;
    markdown += `- Documentation Completed: ${session.workState.progress.documentationCompleted}\n\n`;
    
    markdown += `## Achievements\n\n`;
    for (const achievement of session.achievements) {
      markdown += `- **${achievement.timestamp}**: ${achievement.description}\n`;
    }
    
    markdown += `\n## Chat History\n\n`;
    for (const chat of session.chatHistory) {
      markdown += `### ${chat.type.toUpperCase()} - ${chat.timestamp}\n\n`;
      markdown += `${chat.content}\n\n`;
    }
    
    await fs.writeFile(exportFile, markdown);
    console.log(`📄 Chat history exported to: ${exportFile}`);
    
    return exportFile;
  } catch (error) {
    console.error('❌ Failed to export chat history:', error);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      await initializeSessionRecovery();
      break;
    case 'save-chat':
      await saveChatMessage(process.argv[3] || 'Test message');
      break;
    case 'progress':
      await updateProgress(process.argv[3] || 'testsImplemented');
      break;
    case 'achievement':
      await addAchievement(process.argv[3] || 'Test achievement');
      break;
    case 'export':
      await exportChatHistory();
      break;
    case 'status': {
      const session = await loadSession();
      console.log('Current session:', JSON.stringify(session, null, 2));
      break;
    }
    default:
      console.log(`
Session Recovery Commands:
  init          - Initialize session recovery
  save-chat     - Save a chat message
  progress      - Update progress counter
  achievement   - Add achievement
  export        - Export chat history to markdown
  status        - Show current session status
`);
  }
}
