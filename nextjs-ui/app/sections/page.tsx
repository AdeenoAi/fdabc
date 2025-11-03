'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import DocumentEditor from '@/components/DocumentEditor'
import toast from 'react-hot-toast'
import { 
  FileText, 
  Edit2, 
  Trash2, 
  Clock, 
  ArrowLeft,
  Search,
  Loader2,
  FileDown,
  Eye
} from 'lucide-react'

interface SavedSection {
  id: string
  fileName: string
  sectionName: string
  content: string
  createdAt: number
  updatedAt: number
  fileSize: number
}

export default function SectionsPage() {
  const router = useRouter()
  const [sections, setSections] = useState<SavedSection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSection, setEditingSection] = useState<SavedSection | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadSections()
  }, [])

  const loadSections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sections')
      if (!response.ok) throw new Error('Failed to load sections')
      const data = await response.json()
      setSections(data.sections || [])
    } catch (error: any) {
      toast.error(`Failed to load sections: ${error.message}`)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (section: SavedSection) => {
    setEditingSection(section)
  }

  const handleSave = async (content: string) => {
    if (!editingSection) return

    try {
      const response = await fetch(`/api/sections/${editingSection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save section')
      }

      toast.success('Section updated successfully!')
      setEditingSection(null)
      loadSections()
    } catch (error: any) {
      toast.error(`Failed to save section: ${error.message}`)
      console.error(error)
    }
  }

  const handleDelete = async (id: string, sectionName: string) => {
    if (!confirm(`Are you sure you want to delete "${sectionName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(id)
      const response = await fetch(`/api/sections?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete section')
      }

      toast.success('Section deleted successfully!')
      loadSections()
    } catch (error: any) {
      toast.error(`Failed to delete section: ${error.message}`)
      console.error(error)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const filteredSections = sections.filter(section =>
    section.sectionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (editingSection) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-card rounded-xl shadow-lg border border-border p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div>
                <button
                  onClick={() => setEditingSection(null)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sections
                </button>
                <h2 className="text-2xl font-bold text-foreground">Edit Section</h2>
                <p className="text-sm text-muted-foreground mt-1">{editingSection.sectionName}</p>
              </div>
            </div>
            <DocumentEditor
              content={editingSection.content}
              sectionName={editingSection.sectionName}
              onSave={handleSave}
              onBack={() => setEditingSection(null)}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Saved Sections</h1>
              <p className="text-muted-foreground">View and manage all your saved document sections</p>
            </div>
            <div className="flex gap-2">
              {sections.length > 0 && (
                <button
                  onClick={() => router.push('/pdf?all=true')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
                  title="View all sections as PDF"
                >
                  <FileDown className="w-4 h-4" />
                  View All as PDF
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-foreground font-medium transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Generator
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sections by name or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-card"
            />
          </div>
        </div>

        {loading ? (
          <div className="bg-card rounded-xl shadow-lg border border-border p-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading sections...</p>
            </div>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="bg-card rounded-xl shadow-lg border border-border p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {searchQuery ? 'No sections found' : 'No saved sections yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery 
                  ? 'Try adjusting your search query'
                  : 'Start by generating and saving a section from the document generator'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  Go to Generator
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSections.map((section) => (
              <div
                key={section.id}
                className="bg-card rounded-xl shadow-lg border border-border p-6 hover:shadow-xl transition-all hover:border-primary/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-accent" />
                      </div>
                      <h3 className="font-bold text-foreground text-lg line-clamp-2">
                        {section.sectionName}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {section.content.substring(0, 150)}...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(section.updatedAt)}</span>
                  </div>
                  <div>{formatFileSize(section.fileSize)}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/pdf?sectionId=${section.id}`)}
                    className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 font-medium transition-colors flex items-center justify-center gap-2"
                    title="View as PDF"
                  >
                    <Eye className="w-4 h-4" />
                    View PDF
                  </button>
                  <button
                    onClick={() => handleEdit(section)}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(section.id, section.sectionName)}
                    disabled={deletingId === section.id}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:bg-muted disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingId === section.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredSections.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Showing {filteredSections.length} of {sections.length} section{sections.length !== 1 ? 's' : ''}
          </div>
        )}
      </main>
    </div>
  )
}

