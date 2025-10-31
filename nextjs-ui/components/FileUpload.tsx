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
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Upload Files</h2>

      {/* Template Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <label className="block text-sm font-medium mb-2">
          Template File (Required)
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Upload your template document (.pdf, .docx, or .md)
        </p>

        {templateFile ? (
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded">
            <div className="flex items-center gap-3">
              <File className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">{templateFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(templateFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={removeTemplate}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => templateInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 transition-colors"
          >
            <input
              ref={templateInputRef}
              type="file"
              accept=".docx,.md,.txt,.pdf"
              onChange={handleTemplateChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-gray-600">Click to upload template</span>
            </div>
          </button>
        )}
      </div>

      {/* Documents Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <label className="block text-sm font-medium mb-2">
          Source Documents (Optional)
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Upload documents to extract data from (.pdf, .docx, .txt)
        </p>

        <button
          onClick={() => documentsInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors mb-4"
        >
          <input
            ref={documentsInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleDocumentsChange}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-2">
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">Add more documents</span>
          </div>
        </button>

        {documentFiles.length > 0 && (
          <div className="space-y-2">
            {documentFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 p-3 rounded"
              >
                <div className="flex items-center gap-3">
                  <File className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeDocument(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!templateFile}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Next: Select Section
        </button>
      </div>
    </div>
  )
}

