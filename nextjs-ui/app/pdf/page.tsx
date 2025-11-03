'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import html2canvas from 'html2canvas'
import { 
  Download, 
  ArrowLeft, 
  FileText,
  Loader2,
  FileDown,
  Eye
} from 'lucide-react'

export default function PDFPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sectionId = searchParams.get('sectionId')
  const allSections = searchParams.get('all') === 'true'
  
  const [content, setContent] = useState<string>('')
  const [sectionName, setSectionName] = useState<string>('Document')
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadContent()
  }, [sectionId, allSections])

  const loadContent = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId: sectionId || null,
          allSections: allSections,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load content')
      }

      const data = await response.json()
      setContent(data.content)
      setSectionName(data.sectionName || 'Document')
    } catch (error: any) {
      toast.error(`Failed to load content: ${error.message}`)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = async () => {
    if (!contentRef.current) return

    try {
      setGeneratingPDF(true)
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      // Create a temporary container for PDF generation
      const element = contentRef.current
      
      // Use html2canvas to capture the content
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      // Dynamically import jsPDF to avoid SSR issues
      const { default: jsPDF } = await import('jspdf')
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583))
      const imgScaledWidth = imgWidth * 0.264583 * ratio
      const imgScaledHeight = imgHeight * 0.264583 * ratio
      const marginX = (pdfWidth - imgScaledWidth) / 2
      const marginY = (pdfHeight - imgScaledHeight) / 2

      // Add first page
      pdf.addImage(imgData, 'PNG', marginX, marginY, imgScaledWidth, imgScaledHeight)

      // If content is taller than one page, split into multiple pages
      const pageHeight = pdfHeight - 20 // Leave some margin
      let heightLeft = imgScaledHeight
      let position = marginY

      while (heightLeft > 0) {
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', marginX, position, imgScaledWidth, imgScaledHeight)
        heightLeft -= pageHeight
      }

      // Generate filename
      const fileName = `${sectionName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`
      
      // Save PDF
      pdf.save(fileName)
      
      toast.success('PDF generated successfully!', { id: 'pdf-generation' })
    } catch (error: any) {
      toast.error(`Failed to generate PDF: ${error.message}`, { id: 'pdf-generation' })
      console.error(error)
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-card rounded-xl shadow-lg border border-border p-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading content...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Header with Actions */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                PDF Preview: {sectionName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {allSections ? 'Complete Document' : 'Single Section'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={generatePDF}
                disabled={generatingPDF || !content}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {generatingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Save as PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PDF Preview Content */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          <div 
            ref={contentRef}
            className="pdf-content prose prose-slate max-w-none"
            style={{
              padding: '40px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontFamily: 'Georgia, serif',
              lineHeight: '1.6',
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 style={{ fontSize: '2em', marginTop: '1em', marginBottom: '0.5em', fontWeight: 'bold', color: '#0f172a' }} {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 style={{ fontSize: '1.5em', marginTop: '0.8em', marginBottom: '0.4em', fontWeight: 'bold', color: '#1e293b' }} {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 style={{ fontSize: '1.25em', marginTop: '0.6em', marginBottom: '0.3em', fontWeight: 'bold', color: '#334155' }} {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p style={{ marginBottom: '1em', textAlign: 'justify' }} {...props} />
                ),
                table: ({ node, ...props }) => (
                  <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1em 0' }} {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', backgroundColor: '#f1f5f9', fontWeight: 'bold', textAlign: 'left' }} {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px' }} {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul style={{ marginLeft: '1.5em', marginBottom: '1em' }} {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol style={{ marginLeft: '1.5em', marginBottom: '1em' }} {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li style={{ marginBottom: '0.5em' }} {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote style={{ borderLeft: '4px solid #cbd5e1', paddingLeft: '1em', margin: '1em 0', fontStyle: 'italic', color: '#64748b' }} {...props} />
                ),
                code: ({ node, inline, ...props }: any) => {
                  if (inline) {
                    return <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }} {...props} />
                  }
                  return (
                    <pre style={{ backgroundColor: '#f8fafc', padding: '1em', borderRadius: '4px', overflow: 'auto', margin: '1em 0' }}>
                      <code style={{ fontFamily: 'monospace', fontSize: '0.9em' }} {...props} />
                    </pre>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* PDF Info */}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>This is how your document will appear when exported as PDF</p>
        </div>
      </main>
    </div>
  )
}

