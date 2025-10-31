'use client'

import { useState, useEffect } from 'react'
import { Edit2, Check, X } from 'lucide-react'

interface EditableTableProps {
  markdownTable: string
  onUpdate: (oldTable: string, newTable: string) => void
  confidenceData?: {
    tableIndex?: number
    lowConfidenceCells?: Array<{
      rowIndex: number
      colIndex: number
      confidence: number
      reason?: string
    }>
  }
}

export default function EditableTable({
  markdownTable,
  onUpdate,
  confidenceData,
}: EditableTableProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tableData, setTableData] = useState<string[][]>([])
  const [originalTable, setOriginalTable] = useState(markdownTable)

  useEffect(() => {
    parseMarkdownTable(markdownTable)
    setOriginalTable(markdownTable)
  }, [markdownTable])

  const parseMarkdownTable = (markdown: string) => {
    if (!markdown || !markdown.trim()) {
      setTableData([])
      return
    }

    const lines = markdown.split('\n').map(line => line.trim()).filter((line) => line.length > 0)
    const rows: string[][] = []
    let foundSeparator = false

    lines.forEach((line) => {
      // Check if it's a separator row
      const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)*\|?\s*$/.test(line) || 
                          line.includes('---') || 
                          line.includes('===') ||
                          /^[\s\-:|]+$/.test(line.replace(/\|/g, ''))
      
      if (isSeparator) {
        foundSeparator = true
        return
      }

      // Only process lines that look like table rows
      if (line.includes('|')) {
        // Split by |, remove empty first/last elements from leading/trailing pipes
        const parts = line.split('|')
        
        // Remove first and last if they're empty (from leading/trailing |)
        let cells = parts
        if (parts[0].trim() === '' && parts.length > 1) {
          cells = parts.slice(1)
        }
        if (cells.length > 0 && cells[cells.length - 1].trim() === '') {
          cells = cells.slice(0, -1)
        }
        
        // Clean and filter cells
        const cleanedCells = cells
          .map((cell) => cell.trim())
          .filter((cell) => cell.length >= 0) // Allow empty cells
        
        // Only add if we have at least one cell
        if (cleanedCells.length > 0) {
          rows.push(cleanedCells)
        }
      }
    })

    // If no separator found but we have rows, assume first row is header
    // If separator found, first row is definitely header
    if (rows.length > 0) {
      // Ensure all rows have the same number of columns as the first row
      const numCols = rows[0].length
      const normalizedRows = rows.map(row => {
        // Pad with empty strings if row is shorter
        while (row.length < numCols) {
          row.push('')
        }
        // Truncate if row is longer
        return row.slice(0, numCols)
      })
      
      setTableData(normalizedRows)
    } else {
      // Try to parse even if format is slightly different
      console.warn('Could not parse table, attempting fallback parsing')
      setTableData([])
    }
  }

  const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
    const newData = tableData.map((row, rIdx) =>
      row.map((cell, cIdx) =>
        rIdx === rowIndex && cIdx === cellIndex ? value : cell
      )
    )
    setTableData(newData)
  }

  const handleAddRow = () => {
    if (tableData.length > 0) {
      const newRow = new Array(tableData[0].length).fill('')
      setTableData([...tableData, newRow])
    }
  }

  const handleDeleteRow = (rowIndex: number) => {
    if (tableData.length > 1) {
      setTableData(tableData.filter((_, idx) => idx !== rowIndex))
    }
  }

  const handleSave = () => {
    if (tableData.length === 0) return

    // Convert back to markdown
    const markdownRows = tableData.map((row) => `| ${row.join(' | ')} |`)
    
    // Add separator after header row
    if (markdownRows.length > 1) {
      const numCols = tableData[0].length
      const separator = `| ${Array(numCols).fill('---').join(' | ')} |`
      const newMarkdown = [markdownRows[0], separator, ...markdownRows.slice(1)].join('\n')
      onUpdate(originalTable, newMarkdown)
      setOriginalTable(newMarkdown)
    } else {
      const newMarkdown = markdownRows[0]
      onUpdate(originalTable, newMarkdown)
      setOriginalTable(newMarkdown)
    }
    
    setIsEditing(false)
  }

  const handleCancel = () => {
    parseMarkdownTable(originalTable)
    setIsEditing(false)
  }

  if (tableData.length === 0) {
    return (
      <div className="my-4 p-4 border border-gray-300 rounded bg-gray-50">
        <div className="mb-2">
          <p className="text-gray-700 text-sm font-medium mb-2">Unable to parse table. Raw markdown:</p>
          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
            {markdownTable}
          </pre>
        </div>
        <button
          onClick={() => {
            // Try manual parsing
            const lines = markdownTable.split('\n')
            const manualRows: string[][] = []
            for (const line of lines) {
              if (line.includes('|')) {
                const cells = line.split('|').map(c => c.trim()).filter((c, i, arr) => {
                  // Keep all cells, but note empty first/last from leading/trailing pipes
                  return true
                })
                if (cells.length > 1) {
                  // Remove empty first/last if they exist
                  let filtered = cells
                  if (cells[0] === '' && cells.length > 1) filtered = cells.slice(1)
                  if (filtered[filtered.length - 1] === '') filtered = filtered.slice(0, -1)
                  if (filtered.length > 0 && !filtered.every(c => /^[\s\-:]+$/.test(c))) {
                    manualRows.push(filtered)
                  }
                }
              }
            }
            if (manualRows.length > 0) {
              setTableData(manualRows)
            }
          }}
          className="text-blue-500 hover:text-blue-700 text-sm underline"
        >
          Try manual parse
        </button>
      </div>
    )
  }

  // Create a map of low confidence cells for quick lookup
  const lowConfidenceMap = new Map<string, { confidence: number; reason?: string }>()
  if (confidenceData?.lowConfidenceCells) {
    confidenceData.lowConfidenceCells.forEach(cell => {
      const key = `${cell.rowIndex}-${cell.colIndex}`
      lowConfidenceMap.set(key, { confidence: cell.confidence, reason: cell.reason })
    })
  }

  const getCellConfidence = (rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}-${colIdx}`
    return lowConfidenceMap.get(key)
  }

  const getCellClassName = (rowIdx: number, colIdx: number, isHeader: boolean) => {
    const cellConf = getCellConfidence(rowIdx, colIdx)
    if (!cellConf) {
      return isHeader ? 'bg-gray-100 font-semibold' : ''
    }
    
    const conf = cellConf.confidence
    if (conf < 0.6) {
      return isHeader ? 'bg-red-200 font-semibold border-red-400 border-2' : 'bg-red-100 border-red-300 border-2'
    } else if (conf < 0.8) {
      return isHeader ? 'bg-yellow-200 font-semibold border-yellow-400 border-2' : 'bg-yellow-100 border-yellow-300 border-2'
    }
    return isHeader ? 'bg-gray-100 font-semibold' : ''
  }

  const getCellTitle = (rowIdx: number, colIdx: number) => {
    const cellConf = getCellConfidence(rowIdx, colIdx)
    if (cellConf) {
      return `Confidence: ${(cellConf.confidence * 100).toFixed(0)}%${cellConf.reason ? ` - ${cellConf.reason}` : ''}`
    }
    return ''
  }

  return (
    <div className="my-6 border-2 border-gray-200 rounded-lg overflow-hidden bg-white relative">
      {/* Low confidence indicator badge */}
      {confidenceData?.lowConfidenceCells && confidenceData.lowConfidenceCells.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800 border border-yellow-300">
            ⚠️ {confidenceData.lowConfidenceCells.length} low confidence cell(s)
          </span>
        </div>
      )}
      <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Table</span>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-blue-500 hover:text-blue-700 flex items-center gap-2 text-sm px-3 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit Table
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="text-green-600 hover:text-green-700 flex items-center gap-2 text-sm px-3 py-1 rounded hover:bg-green-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="text-red-500 hover:text-red-700 flex items-center gap-2 text-sm px-3 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleAddRow}
              className="text-blue-500 hover:text-blue-700 text-sm px-3 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              + Add Row
            </button>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {tableData.length > 0 && (
              <tr className="bg-gray-50">
                {tableData[0].map((header, idx) => (
                  <th
                    key={idx}
                    className={`${getCellClassName(0, idx, true)} border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700`}
                    title={getCellTitle(0, idx)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={header}
                        onChange={(e) => handleCellChange(0, idx, e.target.value)}
                        className="w-full p-1 border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      />
                    ) : (
                      header
                    )}
                  </th>
                ))}
                {isEditing && (
                  <th className="border border-gray-300 px-2 w-16"></th>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {tableData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => {
                  const actualRowIndex = rowIndex + 1  // +1 because we sliced off header
                  return (
                  <td
                    key={cellIndex}
                    className={`${getCellClassName(actualRowIndex, cellIndex, false)} border border-gray-300 px-4 py-2 text-gray-700`}
                    title={getCellTitle(actualRowIndex, cellIndex)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) =>
                          handleCellChange(rowIndex + 1, cellIndex, e.target.value)
                        }
                        className="w-full p-1 border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      />
                    ) : (
                      <span className="relative">
                        {cell || <span className="text-gray-400 italic">empty</span>}
                        {getCellConfidence(actualRowIndex, cellIndex) && (
                          <span className="ml-1 text-xs" title={getCellTitle(actualRowIndex, cellIndex)}>
                            {getCellConfidence(actualRowIndex, cellIndex)!.confidence < 0.6 ? '🔴' : '🟡'}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  )
                })}
                {isEditing && (
                  <td className="border border-gray-300 px-2">
                    <button
                      onClick={() => handleDeleteRow(rowIndex + 1)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Delete row"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
