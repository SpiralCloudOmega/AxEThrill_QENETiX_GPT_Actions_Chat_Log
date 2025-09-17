import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import { readFileSync } from 'fs'
import { join } from 'path'
import glob from 'fast-glob'
import { marked } from 'marked'

interface LogPageProps {
  content: string
  title: string
  slug: string
}

export default function LogPage({ content, title, slug }: LogPageProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <nav style={{ marginBottom: '20px' }}>
        <Link href="/" style={{ 
          textDecoration: 'none', 
          color: '#0066cc',
          fontSize: '14px'
        }}>
          ← Back to Log Index
        </Link>
      </nav>
      
      <article style={{ 
        lineHeight: '1.6',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
      
      <footer style={{ 
        marginTop: '50px', 
        paddingTop: '20px', 
        borderTop: '1px solid #eee',
        textAlign: 'center', 
        color: '#666',
        fontSize: '14px'
      }}>
        <p>
          <Link href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>
            View all logs
          </Link>
        </p>
      </footer>
    </div>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const logsDir = join(process.cwd(), '..', 'logs')
  
  try {
    const markdownFiles = await glob('**/*.md', { cwd: logsDir })
    
    const paths = markdownFiles.map((file) => ({
      params: {
        slug: file.replace(/\.md$/, '').split('/').filter(Boolean)
      }
    }))
    
    return {
      paths,
      fallback: false
    }
  } catch (error) {
    console.error('Error generating paths:', error)
    return {
      paths: [],
      fallback: false
    }
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string[]
  
  if (!slug) {
    return {
      notFound: true
    }
  }
  
  const logsDir = join(process.cwd(), '..', 'logs')
  const filePath = join(logsDir, `${slug.join('/')}.md`)
  
  try {
    const content = readFileSync(filePath, 'utf8')
    
    // Configure marked options
    marked.setOptions({
      breaks: true,
      gfm: true
    })
    
    const htmlContent = marked(content)
    
    // Extract title from first h1
    let title = slug[slug.length - 1] // fallback to filename
    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      title = titleMatch[1]
    }
    
    return {
      props: {
        content: htmlContent,
        title,
        slug: slug.join('/')
      }
    }
  } catch (error) {
    console.error('Error reading file:', error)
    return {
      notFound: true
    }
  }
}