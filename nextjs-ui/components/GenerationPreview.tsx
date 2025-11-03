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
      <div className="p-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-600 font-semibold mb-2">Section not found in template</p>
          <p className="text-slate-500 text-sm mb-6">Please check your template file and try again</p>
          <button
            onClick={onBack}
            className="px-5 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Generation Preview
          </h2>
          <p className="text-sm text-slate-600 mt-1">{preview.section_name}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => {
              const promptToUse = editedPrompt && editedPrompt.trim() ? editedPrompt : undefined
              onGenerate(promptToUse)
            }}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
          >
            <Play className="w-4 h-4" />
            Generate Section
          </button>
        </div>
      </div>

      {/* Structure Preview */}
      {preview.structure_preview && (
        <div className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-blue-900">Structure Preview</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="font-medium">Section:</span> {preview.structure_preview.section_name}
            </div>
            
            {preview.structure_preview.has_tables && (
              <div>
                <span className="font-semibold text-slate-900">Tables:</span> <span className="text-blue-600 font-bold">{preview.structure_preview.table_count}</span>
                <div className="mt-3 space-y-3">
                  {preview.structure_preview.tables.map((table, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Table className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-bold text-slate-900">Table {table.index + 1}</span>
                        <span className="text-sm text-slate-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {table.columns} columns
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mb-2">
                        <span className="font-semibold">Columns:</span>{' '}
                        <span className="text-slate-600">{table.headers.join(', ')}</span>
                      </div>
                      <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                        Estimated rows: {table.estimated_rows}
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
        <div className="border-2 border-emerald-200 rounded-xl p-6 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-emerald-900">Extraction Plan</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="font-medium">Retrieval Strategy:</span>
              <p className="text-sm text-gray-700 mt-1">
                {preview.extraction_plan.retrieval_strategy.description}
              </p>
            </div>
            
            <div>
              <span className="font-semibold text-slate-900">Extraction Targets:</span>
              <div className="mt-3 space-y-2">
                {preview.extraction_plan.extraction_targets.map((target, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border-2 border-emerald-200 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-bold capitalize text-emerald-700">{target.type}:</span>
                      <span className="text-slate-700 flex-1">{target.description}</span>
                    </div>
                    {target.columns && (
                      <div className="text-xs text-slate-600 mt-2 bg-emerald-50 px-2 py-1 rounded">
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
      <div className="border-2 border-slate-200 rounded-xl p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Edit2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Generation Prompt</h3>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            {isEditing ? 'Done Editing' : 'Edit Prompt'}
          </button>
        </div>
        
        {isEditing ? (
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="w-full h-64 p-4 border border-slate-300 rounded-xl font-mono text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            placeholder="Edit the prompt..."
          />
        ) : (
          <pre className="bg-slate-50 p-5 rounded-xl border border-slate-200 overflow-auto max-h-64 text-sm whitespace-pre-wrap font-mono">
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

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
        <button
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            const promptToUse = editedPrompt && editedPrompt.trim() ? editedPrompt : undefined
            onGenerate(promptToUse)
          }}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
        >
          <Play className="w-4 h-4" />
          Generate Section
        </button>
      </div>
    </div>
  )
}

