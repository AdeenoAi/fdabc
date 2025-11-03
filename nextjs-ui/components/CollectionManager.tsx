'use client'

import { useState, useEffect } from 'react'
import { Database, RefreshCw } from 'lucide-react'

interface CollectionManagerProps {
  collectionName: string
  onCollectionChange: (name: string) => void
}

export default function CollectionManager({
  collectionName,
  onCollectionChange,
}: CollectionManagerProps) {
  const [collections, setCollections] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchCollections = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:6333/collections')
      if (response.ok) {
        const data = await response.json()
        const collectionNames = data.result?.collections?.map((c: any) => c.name) || []
        setCollections(collectionNames)
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  return (
    <div className="border-2 border-slate-200 rounded-xl p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          Vector Database Collection
        </label>
        <button
          onClick={fetchCollections}
          disabled={isLoading}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="flex gap-2 mb-3">
        <select
          value={collectionName}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        >
          {collections.length > 0 ? (
            collections.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))
          ) : (
            <option value={collectionName}>{collectionName}</option>
          )}
        </select>
        <input
          type="text"
          value={collectionName}
          onChange={(e) => onCollectionChange(e.target.value)}
          placeholder="Or enter custom name"
          className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
      </div>
      
      <p className="text-xs text-slate-600 mt-2">
        Documents are indexed into this collection. All sessions use the same collection by default.
      </p>
    </div>
  )
}

