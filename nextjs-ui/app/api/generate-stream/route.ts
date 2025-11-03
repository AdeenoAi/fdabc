import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { writeFile, mkdir, unlink } from 'fs/promises'

export async function GET(request: NextRequest) {
  // This endpoint streams logs for a generation job
  // The job ID is passed as a query parameter
  const jobId = request.nextUrl.searchParams.get('jobId')
  
  if (!jobId) {
    return new Response('Missing jobId', { status: 400 })
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      const sendEvent = (type: string, data: any) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
          )
        } catch (e) {
          // Stream might be closed
        }
      }

      // In a real implementation, you'd retrieve the job details from a store
      // For now, we'll need to pass the job info differently
      // This is a placeholder - the actual implementation should get job info from memory/DB
      
      sendEvent('error', { message: 'Stream endpoint needs job info - use POST instead' })
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const templateFile = formData.get('template') as File
    const section = formData.get('section') as string
    const documents = formData.getAll('documents') as File[]
    const collectionName = (formData.get('collection') as string) || 
                           process.env.QDRANT_COLLECTION || 
                           'bio_drug_docs'
    const enableVerification = (formData.get('verify') as string) !== 'false'
    const customPrompt = formData.get('custom_prompt') as string

    if (!templateFile || !section) {
      return new Response(
        JSON.stringify({ error: 'Template and section are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Save files temporarily
    const tempDir = join('/tmp', `gen-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    const templatePath = join(tempDir, templateFile.name)
    const templateBytes = await templateFile.arrayBuffer()
    await writeFile(templatePath, Buffer.from(templateBytes))

    const docPaths: string[] = []
    for (const doc of documents) {
      const docPath = join(tempDir, doc.name)
      const docBytes = await doc.arrayBuffer()
      await writeFile(docPath, Buffer.from(docBytes))
      docPaths.push(docPath)
    }

    // Call Python script to generate
    const pythonScript = join(process.cwd(), '..', 'generate_document_llama.py')
    const args = [
      pythonScript,
      '--template',
      templatePath,
      '--section',
      section,
      '--collection',
      collectionName,
      '--output',
      join(tempDir, 'output.md'),
    ]
    
    if (!enableVerification) {
      args.push('--no-verify')
    }
    
    if (customPrompt) {
      const customPromptPath = join(tempDir, 'custom_prompt.txt')
      await writeFile(customPromptPath, customPrompt)
      args.push('--custom-prompt', customPromptPath)
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        const sendEvent = (type: string, data: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
            )
          } catch (e) {
            // Stream might be closed
          }
        }

        // Use unbuffered Python output
        const pythonProcess = spawn('python3', ['-u', ...args], {
          env: {
            ...process.env,
            PATH: process.env.PATH || '',
            PYTHONUNBUFFERED: '1',
          },
        })

        let stdout = ''
        let stderr = ''
        const logs: Array<{ type: string; message: string; timestamp: string }> = []
        let stdoutBuffer = ''
        let stderrBuffer = ''

        const parseLogLine = (text: string): { type: string; message: string } | null => {
          const patterns = [
            /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+)/,
            /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+?)(?:\n|$)/,
            /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+?)(?:\r|$)/,
          ]
          
          for (const pattern of patterns) {
            const logMatch = text.match(pattern)
            if (logMatch && logMatch[2]) {
              return {
                type: logMatch[1].toLowerCase(),
                message: logMatch[2].trim()
              }
            }
          }
          return null
        }

        const processBuffer = (buffer: string): string => {
          const lines = buffer.split('\n')
          const completeLines = lines.slice(0, -1)
          const remainingLine = lines[lines.length - 1]
          
          for (const line of completeLines) {
            const trimmedLine = line.trim()
            if (trimmedLine) {
              const logEntry = parseLogLine(trimmedLine)
              if (logEntry) {
                const logObj = {
                  type: logEntry.type,
                  message: logEntry.message,
                  timestamp: new Date().toISOString()
                }
                logs.push(logObj)
                // Send log immediately via SSE
                sendEvent('log', { log: logObj })
              }
            }
          }
          
          return remainingLine
        }

        pythonProcess.stdout.on('data', (data) => {
          const text = data.toString()
          stdout += text
          stdoutBuffer += text
          stdoutBuffer = processBuffer(stdoutBuffer)
        })

        pythonProcess.stderr.on('data', (data) => {
          const text = data.toString()
          stderr += text
          stderrBuffer += text
          stderrBuffer = processBuffer(stderrBuffer)
        })

        const exitCode = await new Promise<number>((resolve) => {
          pythonProcess.on('close', (code) => {
            // Process remaining buffers
            if (stdoutBuffer.trim()) {
              const logEntry = parseLogLine(stdoutBuffer.trim())
              if (logEntry) {
                const logObj = {
                  type: logEntry.type,
                  message: logEntry.message,
                  timestamp: new Date().toISOString()
                }
                logs.push(logObj)
                sendEvent('log', { log: logObj })
              }
            }
            if (stderrBuffer.trim()) {
              const logEntry = parseLogLine(stderrBuffer.trim())
              if (logEntry) {
                const logObj = {
                  type: logEntry.type,
                  message: logEntry.message,
                  timestamp: new Date().toISOString()
                }
                logs.push(logObj)
                sendEvent('log', { log: logObj })
              }
            }
            resolve(code || 0)
          })
          
          pythonProcess.on('error', (error) => {
            sendEvent('error', { message: error.message })
            resolve(1)
          })
        })

        // Read output file
        const outputPath = join(tempDir, 'output.md')
        const verificationPath = join(tempDir, 'output_verification.json')
        let content = ''
        let verification = null

        if (exitCode !== 0) {
          sendEvent('error', { 
            message: 'Generation failed', 
            details: stderr || stdout || 'Unknown error',
            exitCode 
          })
          
          try {
            const { readFile } = await import('fs/promises')
            try {
              content = await readFile(outputPath, 'utf-8')
            } catch (e) {
              // File doesn't exist
            }
          } catch (e) {
            // Ignore
          }
        } else {
          try {
            const { readFile } = await import('fs/promises')
            
            try {
              const verificationData = await readFile(verificationPath, 'utf-8')
              const parsed = JSON.parse(verificationData)
              content = parsed.content || ''
              verification = parsed.verification || null
            } catch (e) {
              try {
                content = await readFile(outputPath, 'utf-8')
              } catch (e2) {
                if (stdout && stdout.trim()) {
                  content = stdout
                }
              }
            }
            
            if (!content || content.trim() === '') {
              try {
                content = await readFile(outputPath, 'utf-8')
              } catch (e) {
                if (stdout && stdout.trim()) {
                  content = stdout
                }
              }
            }
          } catch (e) {
            if (stdout && stdout.trim()) {
              content = stdout
            }
          }
        }

        // Send final result
        sendEvent('complete', {
          content,
          verification,
          logs,
          stdout,
          stderr
        })

        // Cleanup
        try {
          await unlink(verificationPath).catch(() => {})
          for (const path of [templatePath, ...docPaths, outputPath]) {
            await unlink(path).catch(() => {})
          }
          await import('fs/promises').then((fs) =>
            fs.rmdir(tempDir).catch(() => {})
          )
        } catch (e) {
          // Ignore cleanup errors
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

