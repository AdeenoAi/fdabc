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
      <h2 className="text-2xl font-semibold mb-4">Select Section to Generate</h2>

      {sections.length === 0 ? (
        <p className="text-gray-500">No sections found in template</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section, index) => (
              <button
                key={index}
                onClick={() => onSelect(section.name)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  selectedSection === section.name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{section.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Path: {section.path}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Level: {section.level}
                    </p>
                  </div>
                  {selectedSection === section.name && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={onGenerate}
              disabled={!selectedSection || isGenerating}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Section'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

