'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface Section {
  name: string
  path: string
  level: number
}

interface SectionSelectorProps {
  sections: Section[]
  selectedSection: string
  onSelect: (sectionName: string) => void
  onGenerate: () => void
  isGenerating: boolean
}

export default function SectionSelector({
  sections,
  selectedSection,
  onSelect,
  onGenerate,
  isGenerating,
}: SectionSelectorProps) {
  return (
    <div className="space-y-6">
      {sections.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium">No sections found in template</p>
          <p className="text-sm text-slate-500 mt-2">Please check your template file</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section, index) => (
              <button
                key={index}
                onClick={() => onSelect(section.name)}
                className={`p-5 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                  selectedSection === section.name
                    ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-100'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedSection === section.name ? 'bg-blue-600' : 'bg-slate-300'
                      }`} />
                      <h3 className="font-semibold text-slate-900">{section.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 font-mono bg-slate-50 px-2 py-1 rounded">
                      {section.path}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        Level {section.level}
                      </span>
                    </div>
                  </div>
                  {selectedSection === section.name && (
                    <div className="ml-3 flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={onGenerate}
              disabled={!selectedSection || isGenerating}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Preview & Generate
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

