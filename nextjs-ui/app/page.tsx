'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import SectionSelector from '@/components/SectionSelector'
import DocumentEditor from '@/components/DocumentEditor'
import CollectionManager from '@/components/CollectionManager'
import GenerationPreview from '@/components/GenerationPreview'
import toast from 'react-hot-toast'

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
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(errorData.error || errorData.details || 'Generation failed')
      }

      const data = await response.json()
      
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

      toast.success('Document saved successfully!')
    } catch (error) {
      toast.error('Failed to save document')
      console.error(error)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Document Generator - Bio/Drug RAG System
        </h1>

        {/* Step Indicator */}
        <div className="mb-8 flex justify-center">
          <div className="flex gap-4">
            <div className={`px-4 py-2 rounded ${step === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              1. Upload
            </div>
            <div className={`px-4 py-2 rounded ${step === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              2. Select Section
            </div>
            <div className={`px-4 py-2 rounded ${step === 'generate' || step === 'edit' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              3. Generate & Edit
            </div>
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
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
              <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {documentFiles.length} document(s) ready to index
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Will be indexed into: <strong>{collectionName}</strong>
                    </p>
                  </div>
                  <button
                    onClick={handleIndexDocuments}
                    disabled={isIndexing}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                  >
                    {isIndexing ? 'Indexing...' : 'Index Documents'}
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Index documents to make them searchable for generation. All documents are added to the same collection (does not create new collection per upload).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Section Selection Step */}
        {step === 'select' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
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
          <GenerationPreview
            preview={generationPreview}
            onGenerate={handleGenerate}
            onBack={() => setStep('select')}
          />
        )}

        {/* Loading Preview */}
        {isLoadingPreview && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Loading generation preview...</p>
            </div>
          </div>
        )}

        {/* Generation & Edit Step */}
        {(step === 'generate' || step === 'edit') && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {isGenerating ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600 text-lg">Generating section...</p>
                <p className="text-gray-500 text-sm mt-2">This may take a minute</p>
              </div>
            ) : (
              <DocumentEditor
                content={generatedContent}
                sectionName={selectedSection}
                onSave={handleSave}
                onBack={() => setStep('preview')}
                verification={verification}
              />
            )}
          </div>
        )}
      </div>
    </main>
  )
}

