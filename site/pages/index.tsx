import { GetStaticProps } from 'next'
import Link from 'next/link'
import { readFileSync } from 'fs'
import { join } from 'path'
import glob from 'fast-glob'
import { marked } from 'marked'

interface LogEntry {
  slug: string
  title: string
  date?: string
  topic?: string
  path: string
}

interface HomeProps {
  logs: LogEntry[]
}

export default function Home({ logs }: HomeProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>ChatGPT Chat Logs</h1>
      <p>Browse through our collection of ChatGPT conversation logs and tutorials.</p>
      
      <div style={{ marginTop: '30px' }}>
        {logs.length === 0 ? (
          <p>No logs found.</p>
        ) : (
          logs.map((log) => (
            <div key={log.slug} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '15px',
              backgroundColor: '#f9f9f9'
            }}>
              <h3 style={{ margin: '0 0 10px 0' }}>
                <Link href={`/logs/${log.slug}`} style={{ 
                  textDecoration: 'none', 
                  color: '#0066cc' 
                }}>
                  {log.title}
                </Link>
              </h3>
              {log.date && (
                <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Date:</strong> {log.date}
                </p>
              )}
              {log.topic && (
                <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                  <strong>Topic:</strong> {log.topic}
                </p>
              )}
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#666' }}>
                Path: {log.path}
              </p>
            </div>
          ))
        )}
      </div>
      
      <footer style={{ marginTop: '50px', textAlign: 'center', color: '#666' }}>
        <p>Static Chat Log Viewer - Built with Next.js</p>
      </footer>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const logsDir = join(process.cwd(), '..', 'logs')
  
  try {
    // Find all markdown files in the logs directory
    const markdownFiles = await glob('**/*.md', { cwd: logsDir })
    
    const logs: LogEntry[] = markdownFiles.map((file) => {
      const fullPath = join(logsDir, file)
      const content = readFileSync(fullPath, 'utf8')
      
      // Parse the front matter and content
      const lines = content.split('\n')
      let title = 'Untitled'
      let date = ''
      let topic = ''
      
      // Extract title from first h1
      const titleMatch = content.match(/^#\s+(.+)$/m)
      if (titleMatch) {
        title = titleMatch[1]
      }
      
      // Extract date and topic from markdown
      const dateMatch = content.match(/\*\*Date\*\*:\s*(.+)$/m)
      if (dateMatch) {
        date = dateMatch[1]
      }
      
      const topicMatch = content.match(/\*\*Topic\*\*:\s*(.+)$/m)
      if (topicMatch) {
        topic = topicMatch[1]
      }
      
      // Create slug from file path
      const slug = file.replace(/\.md$/, '').replace(/\\/g, '/')
      
      return {
        slug,
        title,
        date,
        topic,
        path: file
      }
    })
    
    // Sort by date if available, otherwise by title
    logs.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      }
      return a.title.localeCompare(b.title)
    })
    
    return {
      props: {
        logs
      }
    }
  } catch (error) {
    console.error('Error reading logs:', error)
    return {
      props: {
        logs: []
      }
    }
  }
}