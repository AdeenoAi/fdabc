'use client'

import { useState, useRef } from 'react'
import { Upload, File, X } from 'lucide-react'

interface FileUploadProps {
  onTemplateUpload: (file: File) => void
  onDocumentsUpload: (files: File[]) => void
  onNext: () => void
}

export default function FileUpload({
  onTemplateUpload,
  onDocumentsUpload,
  onNext,
}: FileUploadProps) {
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const templateInputRef = useRef<HTMLInputElement>(null)
  const documentsInputRef = useRef<HTMLInputElement>(null)

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTemplateFile(file)
      onTemplateUpload(file)
    }
  }

  const handleDocumentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setDocumentFiles((prev) => [...prev, ...files])
      onDocumentsUpload([...documentFiles, ...files])
    }
  }

  const removeTemplate = () => {
    setTemplateFile(null)
    if (templateInputRef.current) {
      templateInputRef.current.value = ''
    }
  }

  const removeDocument = (index: number) => {
    const newFiles = documentFiles.filter((_, i) => i !== index)
    setDocumentFiles(newFiles)
    onDocumentsUpload(newFiles)
  }

  return (
    <div className="space-y-8">
      {/* Template Upload */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30 transition-all">
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Template File <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-slate-600 mb-4">
          Upload your template document (.pdf, .docx, or .md)
        </p>

        {templateFile ? (
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <File className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{templateFile.name}</p>
                <p className="text-sm text-slate-500">
                  {(templateFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={removeTemplate}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => templateInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
          >
            <input
              ref={templateInputRef}
              type="file"
              accept=".docx,.md,.txt,.pdf"
              onChange={handleTemplateChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center">
                <span className="text-slate-700 font-medium">Click to upload template</span>
                <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Documents Upload */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Source Documents <span className="text-slate-400 text-xs font-normal">(Optional)</span>
        </label>
        <p className="text-sm text-slate-600 mb-4">
          Upload documents to extract data from (.pdf, .docx, .txt)
        </p>

        <button
          onClick={() => documentsInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group mb-4"
        >
          <input
            ref={documentsInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleDocumentsChange}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-slate-700 font-medium">Add source documents</span>
          </div>
        </button>

        {documentFiles.length > 0 && (
          <div className="space-y-2">
            {documentFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-lg">
                    <File className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeDocument(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!templateFile}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          Continue to Section Selection
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

