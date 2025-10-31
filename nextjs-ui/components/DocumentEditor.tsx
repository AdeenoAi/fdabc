'use client'

import { useState, useEffect } from 'react'
import { Save, ArrowLeft, Edit2, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import EditableTable from './EditableTable'

interface DocumentEditorProps {
  content: string
  sectionName: string
  onSave: (content: string) => void
  onBack: () => void
  verification?: {
    confidence: number
    warnings: string[]
    lowConfidenceAreas: Array<{
      claim: string
      type: string
      confidence: number
      reason: string
      tableIndex?: number
      rowIndex?: number
      colIndex?: number
      line_number?: number
      char_start?: number
      char_end?: number
    }>
  }
}

export default function DocumentEditor({
  content,
  sectionName,
  onSave,
  onBack,
  verification,
}: DocumentEditorProps) {
  const [editedContent, setEditedContent] = useState(content)
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')

  useEffect(() => {
    setEditedContent(content)
  }, [content])

  // This function is now defined outside component, see parseMarkdownTables below

  const handleTableUpdate = (oldTable: string, newTable: string) => {
    setEditedContent((prev) => prev.replace(oldTable, newTable))
  }

  // Replace markdown tables with editable components
  const renderContentWithEditableTables = () => {
    // Use the new component that handles highlighting
    return (
      <MarkdownWithEditableTables
        content={editedContent}
        onTableUpdate={handleTableUpdate}
        verification={verification}
      />
    )
  }

  // Legacy function - keeping for reference but not using
  const _renderContentWithEditableTables = () => {
    const tables = parseMarkdownTables(editedContent)
    let result = editedContent

    // Process tables in reverse to maintain indices
    for (let i = tables.length - 1; i >= 0; i--) {
      const table = tables[i]
      const lines = result.split('\n')
      const tableMarkdown = lines.slice(table.start, table.end + 1).join('\n')
      
      // Replace with placeholder that we'll render
      result = result.replace(tableMarkdown, `__TABLE_${i}__`)
    }

    return result
  }

  const confidence = verification?.confidence || 1.0
  const confidenceColor = 
    confidence >= 0.8 ? 'text-green-600' :
    confidence >= 0.6 ? 'text-yellow-600' :
    'text-red-600'

  return (
    <div className="space-y-4">
      {/* Verification Banner */}
      {verification && (
        <div className={`p-4 rounded-lg border-2 ${
          confidence >= 0.8 ? 'bg-green-50 border-green-200' :
          confidence >= 0.6 ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-semibold ${confidenceColor}`}>
                  Confidence: {(confidence * 100).toFixed(0)}%
                </span>
                {confidence >= 0.8 && <span className="text-green-600">✅ High</span>}
                {confidence >= 0.6 && confidence < 0.8 && <span className="text-yellow-600">⚠️ Medium</span>}
                {confidence < 0.6 && <span className="text-red-600">❌ Low</span>}
              </div>
              
              {verification.warnings && verification.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium mb-1">Warnings:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {verification.warnings.map((warning, idx) => (
                      <li key={idx} className="text-gray-700">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {verification.lowConfidenceAreas && verification.lowConfidenceAreas.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Low Confidence Areas ({verification.lowConfidenceAreas.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {verification.lowConfidenceAreas.map((area, idx) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border">
                        <p className="font-medium">{area.type.replace('_', ' ')}</p>
                        <p className="text-gray-600">{area.claim.substring(0, 100)}...</p>
                        <p className="text-red-600 mt-1">Confidence: {(area.confidence * 100).toFixed(0)}% - {area.reason}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{sectionName}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'preview' ? 'source' : 'preview')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            {viewMode === 'preview' ? (
              <>
                <Edit2 className="w-4 h-4" />
                Source
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Preview
              </>
            )}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => onSave(editedContent)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {viewMode === 'preview' ? (
        <div className="border rounded-lg p-6 bg-white min-h-[600px]">
          <MarkdownWithEditableTables 
            content={editedContent} 
            onTableUpdate={handleTableUpdate}
          />
        </div>
      ) : (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full h-[600px] p-4 border rounded-lg font-mono text-sm markdown-editor"
          placeholder="Edit markdown content..."
        />
      )}
    </div>
  )
}

// Component that renders markdown but replaces tables with editable versions
function MarkdownWithEditableTables({ 
  content, 
  onTableUpdate,
  verification 
}: { 
  content: string; 
  onTableUpdate: (oldTable: string, newTable: string) => void;
  verification?: DocumentEditorProps['verification']
}) {
  const tables = parseMarkdownTables(content)
  const parts: Array<{type: 'text' | 'table', content: string, index?: number}> = []
  
  let lastIndex = 0
  tables.forEach((table, index) => {
    // Add text before table
    if (table.start > lastIndex) {
      const textContent = content.split('\n').slice(lastIndex, table.start).join('\n')
      if (textContent.trim()) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    // Add table
    parts.push({ type: 'table', content: table.content, index })
    lastIndex = table.end + 1
  })
  
  // Add remaining text
  if (lastIndex < content.split('\n').length) {
    const textContent = content.split('\n').slice(lastIndex).join('\n')
    if (textContent.trim()) {
      parts.push({ type: 'text', content: textContent })
    }
  }

  // If no tables found, render all as text
  if (tables.length === 0) {
    parts.push({ type: 'text', content })
  }

  // Prepare confidence data for tables
  const getTableConfidenceData = (tableIndex: number) => {
    if (!verification?.lowConfidenceAreas) return undefined
    
    const tableAreas = verification.lowConfidenceAreas.filter(
      area => area.tableIndex === tableIndex && 
      area.rowIndex !== undefined && 
      area.colIndex !== undefined
    )
    
    if (tableAreas.length === 0) return undefined
    
    return {
      tableIndex,
      lowConfidenceCells: tableAreas.map(area => ({
        rowIndex: area.rowIndex!,
        colIndex: area.colIndex!,
        confidence: area.confidence,
        reason: area.reason
      }))
    }
  }

  // Prepare text highlighting data
  const getHighlightedText = (textContent: string) => {
    if (!verification?.lowConfidenceAreas) return textContent
    
    // Create highlighted version with spans for low confidence areas
    let highlighted = textContent
    const textAreas = verification.lowConfidenceAreas.filter(
      area => area.type !== 'table_cell' && area.char_start !== undefined
    )
    
    // Sort by char_start descending to avoid offset issues when replacing
    const sortedAreas = [...textAreas].sort((a, b) => (b.char_start || 0) - (a.char_start || 0))
    
    sortedAreas.forEach(area => {
      if (area.char_start !== undefined && area.char_end !== undefined) {
        const start = area.char_start
        const end = area.char_end
        const text = highlighted.substring(start, end)
        const conf = area.confidence
        const bgColor = conf < 0.6 ? 'bg-red-200' : 'bg-yellow-200'
        const borderColor = conf < 0.6 ? 'border-red-400' : 'border-yellow-400'
        const replacement = `<mark class="${bgColor} ${borderColor} border-2 border-dashed px-1 rounded" title="Confidence: ${(conf * 100).toFixed(0)}% - ${area.reason || 'Low confidence'}">${text}</mark>`
        highlighted = highlighted.substring(0, start) + replacement + highlighted.substring(end)
      }
    })
    
    return highlighted
  }

  return (
    <div>
      {parts.map((part, idx) => {
        if (part.type === 'table') {
          return (
            <EditableTable
              key={`table-${part.index}-${idx}`}
              markdownTable={part.content}
              onUpdate={onTableUpdate}
              confidenceData={getTableConfidenceData(part.index || 0)}
            />
          )
        } else {
          const highlightedText = getHighlightedText(part.content)
          return (
            <ReactMarkdown
              key={`text-${idx}`}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table: () => null, // Skip tables in markdown, we handle them separately
              }}
            >
              {highlightedText}
            </ReactMarkdown>
          )
        }
      })}
    </div>
  )
}

function parseMarkdownTables(markdown: string): Array<{start: number, end: number, content: string}> {
  const tables: Array<{start: number, end: number, content: string}> = []
  const lines = markdown.split('\n')
  let inTable = false
  let tableStart = 0
  let tableLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Check if line contains table markers
    const hasPipe = line.includes('|')
    const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)*\|?\s*$/.test(trimmedLine) || 
                        trimmedLine.includes('---') || 
                        trimmedLine.includes('===')
    const isTableRow = hasPipe && (
      trimmedLine.startsWith('|') || 
      trimmedLine.endsWith('|') ||
      /^\s*\|\s*[^\|]+\s*\|/.test(trimmedLine) // Has content between pipes
    )

    if (isTableRow || isSeparator) {
      if (!inTable) {
        inTable = true
        tableStart = i
        tableLines = []
      }
      tableLines.push(line)
    } else if (inTable) {
      // End of table - need at least 2 lines (header + separator or header + data)
      if (tableLines.length >= 2) {
        tables.push({
          start: tableStart,
          end: i - 1,
          content: tableLines.join('\n')
        })
      }
      tableLines = []
      inTable = false
    }
  }

  // Handle table at end of document
  if (inTable && tableLines.length >= 2) {
    tables.push({
      start: tableStart,
      end: lines.length - 1,
      content: tableLines.join('\n')
    })
  }

  return tables
}
