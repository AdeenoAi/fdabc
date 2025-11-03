'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface LogEntry {
  type: 'progress' | 'error' | 'warning'
  message: string
  timestamp?: string
}

interface GenerationLogsProps {
  logs: LogEntry[]
  isGenerating: boolean
}

// Keywords that indicate important messages
const IMPORTANT_KEYWORDS = [
  'error', 'warning', 'failed', 'complete', 'finished', 'success',
  'retrieved', 'extracted', 'generated', 'verified', 'confidence',
  'validation', 'issue', 'problem', 'exception', 'timeout'
]

// Keywords that indicate verbose/unimportant messages
const VERBOSE_KEYWORDS = [
  'processing', 'analyzing', 'parsing', 'loading', 'preparing',
  'initializing', 'connecting', 'fetching', 'reading', 'writing'
]

export default function GenerationLogs({ logs, isGenerating }: GenerationLogsProps) {
  const logEndRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter logs to show only important ones
  const importantLogs = useMemo(() => {
    return logs.filter(log => {
      // Always show errors and warnings
      if (log.type === 'error' || log.type === 'warning') {
        return true
      }

      const message = log.message.toLowerCase()
      
      // Filter out verbose progress messages
      const isVerbose = VERBOSE_KEYWORDS.some(keyword => 
        message.includes(keyword) && message.length < 50
      )
      
      if (isVerbose) {
        return false
      }

      // Show important progress messages
      const isImportant = IMPORTANT_KEYWORDS.some(keyword => 
        message.includes(keyword)
      )

      return isImportant || message.length > 100 // Show longer messages as they're likely important
    })
  }, [logs])

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (logEndRef.current && isExpanded) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [importantLogs, isExpanded])

  // Count log types
  const errorCount = logs.filter(l => l.type === 'error').length
  const warningCount = logs.filter(l => l.type === 'warning').length
  const hasImportantLogs = importantLogs.length > 0 || errorCount > 0 || warningCount > 0

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <CheckCircle2 className="w-4 h-4" />
    }
  }

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      default:
        return 'text-muted-foreground bg-muted/50 border-border'
    }
  }

  // Don't show if no logs and not generating
  if (logs.length === 0 && !isGenerating) {
    return null
  }

  // Show compact summary when collapsed
  if (!isExpanded && !hasImportantLogs && isGenerating) {
    return (
      <div className="border border-border rounded-lg bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            Generating...
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Show details
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {isGenerating && (
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            )}
            {isGenerating ? 'Generating...' : 'Generation Logs'}
          </h3>
          {(errorCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {errorCount > 0 && (
                <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {isExpanded ? 'Hide' : 'Show'}
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {importantLogs.length === 0 && isGenerating && (
            <div className="text-xs text-muted-foreground italic py-2">
              Waiting for important updates...
            </div>
          )}
          
          {importantLogs.map((log, index) => (
            <div
              key={index}
              className={`text-xs p-2 rounded border ${getLogColor(log.type)}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">{getLogIcon(log.type)}</span>
                <span className="flex-1 leading-relaxed">{log.message}</span>
              </div>
            </div>
          ))}
          
          {importantLogs.length === 0 && !isGenerating && logs.length > 0 && (
            <div className="text-xs text-muted-foreground italic py-2">
              All checks passed. No issues detected.
            </div>
          )}
          
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

