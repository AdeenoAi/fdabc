'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import SectionSelector from '@/components/SectionSelector'
import DocumentEditor from '@/components/DocumentEditor'
import CollectionManager from '@/components/CollectionManager'
import GenerationPreview from '@/components/GenerationPreview'
import GenerationLogs from '@/components/GenerationLogs'
import Header from '@/components/Header'
import toast from 'react-hot-toast'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

type UploadedFile = {
  file: File
  type: 'template' | 'document'
  id: string
}

type Section = {
  name: string
  path: string
  level: number
}

export default function Home() {
  const [step, setStep] = useState<'upload' | 'select' | 'preview' | 'generate' | 'edit'>('upload')
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [generatedContent, setGeneratedContent] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [verification, setVerification] = useState<any>(null)
  const [generationPreview, setGenerationPreview] = useState<any>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [generationLogs, setGenerationLogs] = useState<Array<{type: 'progress' | 'error' | 'warning', message: string, timestamp?: string}>>([])

  const handleTemplateUpload = (file: File) => {
    setTemplateFile(file)
    // Analyze template to get sections
    analyzeTemplate(file)
  }

  const [isIndexing, setIsIndexing] = useState(false)
  const [collectionName, setCollectionName] = useState('bio_drug_docs')

  const handleDocumentsUpload = (files: File[]) => {
    setDocumentFiles(files)
  }

  const handleIndexDocuments = async () => {
    if (documentFiles.length === 0) {
      toast.error('Please upload documents first')
      return
    }

    setIsIndexing(true)
    const formData = new FormData()
    documentFiles.forEach((file) => {
      formData.append('documents', file)
    })
    formData.append('collection', collectionName)

    try {
      const response = await fetch('/api/index-documents', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Indexing failed')
      }

      const data = await response.json()
      toast.success(`Indexed ${data.documentsCount} documents to collection: ${data.collection}`)
    } catch (error: any) {
      toast.error(`Failed to index documents: ${error.message}`)
      console.error(error)
    } finally {
      setIsIndexing(false)
    }
  }

  const analyzeTemplate = async (file: File) => {
    const formData = new FormData()
    formData.append('template', file)

    try {
      const response = await fetch('/api/analyze-template', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to analyze template')

      const data = await response.json()
      setSections(data.sections || [])
      setStep('select')
      toast.success('Template analyzed successfully')
    } catch (error) {
      toast.error('Failed to analyze template')
      console.error(error)
    }
  }

  const handleSectionSelect = async (sectionName: string) => {
    setSelectedSection(sectionName)
    // Load preview for the selected section
    await loadPreview(sectionName)
  }

  const loadPreview = async (sectionName: string) => {
    if (!templateFile) return

    setIsLoadingPreview(true)
    const formData = new FormData()
    formData.append('template', templateFile)
    formData.append('section', sectionName)

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Preview failed')

      const data = await response.json()
      setGenerationPreview(data)
      setStep('preview')
    } catch (error) {
      toast.error('Failed to load preview')
      console.error(error)
      // Fallback to direct generation if preview fails
      setStep('select')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleGenerate = async (editedPrompt?: string) => {
    if (!templateFile || !selectedSection) {
      toast.error('Please upload template and select a section')
      return
    }

    setIsGenerating(true)
    setGenerationLogs([]) // Clear previous logs
    setStep('edit') // Move to edit step to show loading
    
    const formData = new FormData()
    formData.append('template', templateFile)
    formData.append('section', selectedSection)
    formData.append('collection', collectionName)
    
    // Add custom prompt if edited and not empty
    if (editedPrompt && editedPrompt.trim()) {
      formData.append('custom_prompt', editedPrompt)
    }

    // Add documents if uploaded (these are for potential future use or temporary indexing)
    documentFiles.forEach((file) => {
      formData.append('documents', file)
    })

    try {
      // Use streaming endpoint for real-time logs
      const response = await fetch('/api/generate-stream', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(errorData.error || errorData.details || 'Generation failed')
      }

      // Handle Server-Sent Events stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let data: any = null

      if (!reader) {
        throw new Error('Response body is not readable')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Keep incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // Remove 'data: ' prefix
              const event = JSON.parse(jsonStr)

              if (event.type === 'log') {
                // Update logs in real-time
                setGenerationLogs(prev => [...prev, {
                  type: (event.log.type === 'error' || event.log.type === 'warning' 
                    ? event.log.type 
                    : 'progress') as 'progress' | 'error' | 'warning',
                  message: event.log.message || '',
                  timestamp: event.log.timestamp
                }])
              } else if (event.type === 'complete') {
                // Final response received
                data = {
                  content: event.content,
                  verification: event.verification,
                  logs: event.logs || [],
                  stdout: event.stdout,
                  stderr: event.stderr
                }
              } else if (event.type === 'error') {
                throw new Error(event.message || 'Generation error')
              }
            } catch (e) {
              console.error('Error parsing SSE event:', e, line)
            }
          }
        }

        if (data) break // Got complete data, exit
      }
      
      if (!data) {
        throw new Error('No data received from server')
      }
      
      // Update logs immediately when we get them (even if partial)
      if (data.logs && Array.isArray(data.logs)) {
        const mappedLogs = data.logs.map((log: any) => ({
          type: (log.type === 'error' || log.type === 'warning' 
            ? log.type 
            : 'progress') as 'progress' | 'error' | 'warning',
          message: log.message || '',
          timestamp: log.timestamp
        }))
        setGenerationLogs(mappedLogs)
      }
      
      if (data.error && !data.content) {
        // If there's an error and no content, show detailed error
        const errorDetails = data.details ? `\n\n${data.details}` : ''
        const errorInfo = data.stdout || data.stderr ? `\n\nDebug info:\n${data.stdout || ''}\n${data.stderr || ''}` : ''
        throw new Error(`${data.error}${errorDetails}${errorInfo}`)
      }
      
      // Even if there's an error flag, show the content (which might be an error message)
      setGeneratedContent(data.content || data.error || 'No content received')
      setVerification(data.verification || null)
      setStep('edit')
      
      if (data.verification) {
        const confidence = data.verification.confidence || 0
        if (confidence >= 0.8) {
          toast.success('Section generated with high confidence!')
        } else if (confidence >= 0.6) {
          toast('Section generated with medium confidence - review recommended', { icon: '⚠️' })
        } else {
          toast.error('Section generated with low confidence - please review carefully')
        }
      } else {
        toast.success('Section generated successfully!')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate section')
      console.error('Generation error:', error)
      setStep('preview') // Go back to preview if generation fails
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async (editedContent: string) => {
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editedContent,
          section: selectedSection,
        }),
      })

      if (!response.ok) throw new Error('Save failed')

      const data = await response.json()
      toast.success('Document saved successfully!', {
        duration: 3000,
      })
      
      // Navigate to sections page after a short delay
      setTimeout(() => {
        window.location.href = '/sections'
      }, 1500)
    } catch (error) {
      toast.error('Failed to save document')
      console.error(error)
    }
  }

  const steps = [
    { id: 'upload', label: 'Upload Files', number: 1 },
    { id: 'select', label: 'Select Section', number: 2 },
    { id: 'preview', label: 'Preview', number: 3 },
    { id: 'edit', label: 'Generate & Edit', number: 4 },
  ]

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId)
    const currentIndex = steps.findIndex(s => s.id === step || (s.id === 'preview' && step === 'preview'))
    
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-center gap-4">
            {steps.map((stepItem, index) => {
              const status = getStepStatus(stepItem.id)
              const isLast = index === steps.length - 1
              
              return (
                <div key={stepItem.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                        status === 'completed'
                          ? 'bg-primary border-primary text-primary-foreground'
                          : status === 'active'
                          ? 'bg-secondary border-primary text-primary'
                          : 'bg-card border-border text-muted-foreground'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : status === 'active' ? (
                        <Circle className="w-6 h-6 fill-primary" />
                      ) : (
                        <span className="font-semibold">{stepItem.number}</span>
                      )}
                    </div>
                    <span
                      className={`mt-2 text-sm font-medium ${
                        status === 'active'
                          ? 'text-primary'
                          : status === 'completed'
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {stepItem.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`w-16 h-0.5 mx-2 ${
                        status === 'completed' ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="bg-card rounded-xl shadow-lg border border-border p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Upload Your Documents</h2>
              <p className="text-muted-foreground">Start by uploading your template and source documents</p>
            </div>
            
            <FileUpload
              onTemplateUpload={handleTemplateUpload}
              onDocumentsUpload={handleDocumentsUpload}
              onNext={() => {
                if (templateFile) {
                  setStep('select')
                } else {
                  toast.error('Please upload a template first')
                }
              }}
            />
            
            <div className="mt-6">
              <CollectionManager
                collectionName={collectionName}
                onCollectionChange={setCollectionName}
              />
            </div>

            {documentFiles.length > 0 && (
              <div className="mt-6 p-5 border-2 border-primary/20 rounded-xl bg-secondary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {documentFiles.length} document(s) ready to index
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Will be indexed into: <strong className="font-semibold">{collectionName}</strong>
                    </p>
                  </div>
                  <button
                    onClick={handleIndexDocuments}
                    disabled={isIndexing}
                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-sm font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                  >
                    {isIndexing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Indexing...
                      </>
                    ) : (
                      'Index Documents'
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Index documents to make them searchable for generation. All documents are added to the same collection.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Section Selection Step */}
        {step === 'select' && (
          <div className="bg-card rounded-xl shadow-lg border border-border p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Section to Generate</h2>
              <p className="text-muted-foreground">Choose which section of your template you'd like to generate</p>
            </div>
            <SectionSelector
              sections={sections}
              selectedSection={selectedSection}
              onSelect={handleSectionSelect}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && generationPreview && (
          <div className="bg-card rounded-xl shadow-lg border border-border">
            <GenerationPreview
              preview={generationPreview}
              onGenerate={handleGenerate}
              onBack={() => setStep('select')}
            />
          </div>
        )}

        {/* Loading Preview */}
        {isLoadingPreview && (
          <div className="bg-card rounded-xl shadow-lg border border-border p-12">
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-secondary border-t-primary mb-4"></div>
              <p className="text-foreground font-medium">Analyzing template structure...</p>
              <p className="text-muted-foreground text-sm mt-2">Preparing generation preview</p>
            </div>
          </div>
        )}

        {/* Generation & Edit Step */}
        {(step === 'generate' || step === 'edit') && (
          <div className="bg-card rounded-xl shadow-lg border border-border p-8">
            {isGenerating ? (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-secondary border-t-primary mb-6"></div>
                  <p className="text-foreground text-xl font-semibold">Generating section...</p>
                  <p className="text-muted-foreground mt-2">This may take a minute. Please wait while we process your request.</p>
                </div>
                <GenerationLogs logs={generationLogs} isGenerating={isGenerating} />
              </div>
            ) : (
              <div className="space-y-6">
                <DocumentEditor
                  content={generatedContent}
                  sectionName={selectedSection}
                  onSave={handleSave}
                  onBack={() => setStep('preview')}
                  verification={verification}
                />
                {generationLogs.length > 0 && (
                  <GenerationLogs logs={generationLogs} isGenerating={false} />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

