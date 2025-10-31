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
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Database className="w-4 h-4" />
          Qdrant Collection
        </label>
        <button
          onClick={fetchCollections}
          disabled={isLoading}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="flex gap-2">
        <select
          value={collectionName}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
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
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>
      
      <p className="text-xs text-gray-500 mt-2">
        Documents are indexed into this collection. All sessions use the same collection by default.
      </p>
    </div>
  )
}

