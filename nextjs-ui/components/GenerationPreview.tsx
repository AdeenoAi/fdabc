'use client'

import { useState } from 'react'
import { Play, Edit2, FileText, Table, Search } from 'lucide-react'

interface GenerationPreviewProps {
  preview: {
    section_name: string
    template_found: boolean
    prompt?: string
    base_query?: string
    table_instructions?: string
    structure_preview?: {
      section_name: string
      has_tables: boolean
      table_count: number
      tables: Array<{
        index: number
        headers: string[]
        estimated_rows: string
        columns: number
      }>
      will_extract: string[]
    }
    extraction_plan?: {
      retrieval_strategy: {
        method: string
        top_k: number
        description: string
      }
      extraction_targets: Array<{
        type: string
        description: string
        table_index?: number
        columns?: string[]
      }>
    }
    template_info?: {
      num_tables: number
      table_structures: Array<{
        index: number
        headers: string[]
        markdown_preview: string
      }>
    }
  }
  onGenerate: (editedPrompt?: string) => void
  onBack: () => void
}

export default function GenerationPreview({
  preview,
  onGenerate,
  onBack,
}: GenerationPreviewProps) {
  const [editedPrompt, setEditedPrompt] = useState(preview.prompt || '')
  const [isEditing, setIsEditing] = useState(false)

  if (!preview.template_found) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{preview.message || 'Section not found in template'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-semibold">
          Preview: {preview.section_name}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => {
              // Use edited prompt if it exists and is different from original
              const promptToUse = editedPrompt && editedPrompt.trim() ? editedPrompt : undefined
              onGenerate(promptToUse)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Generate with This Plan
          </button>
        </div>
      </div>

      {/* Structure Preview */}
      {preview.structure_preview && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">Structure Preview</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="font-medium">Section:</span> {preview.structure_preview.section_name}
            </div>
            
            {preview.structure_preview.has_tables && (
              <div>
                <span className="font-medium">Tables:</span> {preview.structure_preview.table_count}
                <div className="mt-2 space-y-2">
                  {preview.structure_preview.tables.map((table, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Table className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Table {table.index + 1}</span>
                        <span className="text-sm text-gray-600">
                          ({table.columns} columns)
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Columns:</span>{' '}
                        {table.headers.join(', ')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Rows: {table.estimated_rows}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <span className="font-medium">Will Extract:</span>
              <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                {preview.structure_preview.will_extract.map((item, idx) => (
                  <li key={idx} className="text-gray-700">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Extraction Plan */}
      {preview.extraction_plan && (
        <div className="border rounded-lg p-4 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Extraction Plan</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="font-medium">Retrieval Strategy:</span>
              <p className="text-sm text-gray-700 mt-1">
                {preview.extraction_plan.retrieval_strategy.description}
              </p>
            </div>
            
            <div>
              <span className="font-medium">Extraction Targets:</span>
              <div className="mt-2 space-y-2">
                {preview.extraction_plan.extraction_targets.map((target, idx) => (
                  <div key={idx} className="bg-white p-2 rounded border border-green-200">
                    <span className="font-medium capitalize">{target.type}:</span>{' '}
                    {target.description}
                    {target.columns && (
                      <div className="text-xs text-gray-600 mt-1">
                        Columns: {target.columns.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Preview (Editable) */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Generation Prompt</h3>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {isEditing ? 'Done Editing' : 'Edit Prompt'}
          </button>
        </div>
        
        {isEditing ? (
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm"
            placeholder="Edit the prompt..."
          />
        ) : (
          <pre className="bg-gray-50 p-4 rounded border overflow-auto max-h-64 text-sm whitespace-pre-wrap">
            {editedPrompt}
          </pre>
        )}
        
        <div className="mt-2 text-xs text-gray-500">
          {isEditing && (
            <p className="text-yellow-600">
              ⚠️ Editing the prompt may affect generation quality. Make sure to preserve key instructions.
            </p>
          )}
          The prompt above will be sent to the LLM for content generation.
        </div>
      </div>

      {/* Template Info */}
      {preview.template_info && (
        <details className="border rounded-lg p-4">
          <summary className="cursor-pointer font-medium text-gray-700">
            Template Table Structures ({preview.template_info.num_tables} tables)
          </summary>
          <div className="mt-3 space-y-3">
            {preview.template_info.table_structures.map((table, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded border">
                <div className="font-medium mb-2">Table {table.index + 1}</div>
                <div className="text-sm mb-2">
                  <span className="font-medium">Headers:</span>{' '}
                  {table.headers.join(' | ')}
                </div>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {table.markdown_preview}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            // Use edited prompt if it exists and is different from original
            const promptToUse = editedPrompt && editedPrompt.trim() ? editedPrompt : undefined
            onGenerate(promptToUse)
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          Generate Section
        </button>
      </div>
    </div>
  )
}

