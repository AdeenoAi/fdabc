import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { writeFile, mkdir, unlink } from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const templateFile = formData.get('template') as File
    const section = formData.get('section') as string
    const documents = formData.getAll('documents') as File[]

    if (!templateFile || !section) {
      return NextResponse.json(
        { error: 'Template and section are required' },
        { status: 400 }
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

    // Get collection name (default from env or use default)
    const collectionName = (formData.get('collection') as string) || 
                           process.env.QDRANT_COLLECTION || 
                           'bio_drug_docs'
    
    // Verification is enabled by default
    const enableVerification = (formData.get('verify') as string) !== 'false'
    
    // Check for custom prompt
    const customPrompt = formData.get('custom_prompt') as string

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
    
    // If custom prompt provided, save it to a file and pass as argument
    if (customPrompt) {
      const customPromptPath = join(tempDir, 'custom_prompt.txt')
      await writeFile(customPromptPath, customPrompt)
      args.push('--custom-prompt', customPromptPath)
    }

    // Use -u flag for unbuffered output so logs appear immediately
    const pythonProcess = spawn('python3', ['-u', ...args], {
      env: {
        ...process.env,
        PATH: process.env.PATH || '',
        PYTHONUNBUFFERED: '1', // Also set env var for extra safety
      },
    })

    let stdout = ''
    let stderr = ''
    const logs: Array<{ type: string; message: string; timestamp: string }> = []
    
    // Accumulate partial lines across chunks
    let stdoutBuffer = ''
    let stderrBuffer = ''

    // Parse log lines and extract progress messages
    const parseLogLine = (text: string): { type: string; message: string } | null => {
      // Try multiple patterns to catch logs in different formats
      const patterns = [
        /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+)/,  // Standard format
        /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+?)(?:\n|$)/,  // With line end
        /\[LOG_(PROGRESS|ERROR|WARNING)\]\s*(.+?)(?:\r|$)/,  // With carriage return
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
      
      // Debug: log non-matching lines that contain LOG_ to see what we're missing
      if (text.includes('LOG_') && !text.match(/\[LOG_(PROGRESS|ERROR|WARNING)\]/)) {
        console.log('[DEBUG] Line contains LOG_ but did not match:', text.substring(0, 200))
      }
      
      return null
    }

    // Process buffer and extract complete log lines
    const processBuffer = (buffer: string, isStderr: boolean = false) => {
      const lines = buffer.split('\n')
      // Keep the last line as it might be incomplete
      const completeLines = lines.slice(0, -1)
      const remainingLine = lines[lines.length - 1]
      
      for (const line of completeLines) {
        const trimmedLine = line.trim()
        if (trimmedLine) {
          // Debug: log all lines that might be logs
          if (trimmedLine.includes('LOG_')) {
            console.log('[DEBUG] Processing potential log line:', trimmedLine.substring(0, 100))
          }
          
          const logEntry = parseLogLine(trimmedLine)
          if (logEntry) {
            const logObj = {
              type: logEntry.type,
              message: logEntry.message,
              timestamp: new Date().toISOString()
            }
            logs.push(logObj)
            console.log(`[LOG CAPTURED] ${logEntry.type}: ${logEntry.message}`)
            
          } else if (trimmedLine.includes('LOG_')) {
            console.log('[DEBUG] Line with LOG_ did not parse:', trimmedLine.substring(0, 150))
          }
        }
      }
      
      return remainingLine
    }

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      console.log('Python stdout:', text)
      
      // Accumulate and process complete lines
      stdoutBuffer += text
      stdoutBuffer = processBuffer(stdoutBuffer, false)
    })

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      console.error('Python stderr:', text)
      
      // Accumulate and process complete lines
      stderrBuffer += text
      stderrBuffer = processBuffer(stderrBuffer, true)
    })

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`)
        
        // Process any remaining lines after process closes
        if (stdoutBuffer.trim()) {
          const logEntry = parseLogLine(stdoutBuffer.trim())
          if (logEntry) {
            logs.push({
              type: logEntry.type,
              message: logEntry.message,
              timestamp: new Date().toISOString()
            })
          }
        }
        if (stderrBuffer.trim()) {
          const logEntry = parseLogLine(stderrBuffer.trim())
          if (logEntry) {
            logs.push({
              type: logEntry.type,
              message: logEntry.message,
              timestamp: new Date().toISOString()
            })
          }
        }
        
        console.log(`Collected ${logs.length} log entries`)
        resolve(code || 0)
      })
      
      pythonProcess.on('error', (error) => {
        console.error('Python process error:', error)
        stderr += `Process error: ${error.message}`
        resolve(1)
      })
    })

    // Read output file
    const outputPath = join(tempDir, 'output.md')
    const verificationPath = join(tempDir, 'output_verification.json')
    let content = ''
    let verification = null
    
    if (exitCode !== 0) {
      console.error('Generation error:', stderr)
      console.error('Exit code:', exitCode)
      console.error('Stdout:', stdout)
      
      // Try to still read output if it exists
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
      
      // Cleanup
      try {
        await unlink(outputPath).catch(() => {})
        await unlink(verificationPath).catch(() => {})
      } catch (e) {
        // Ignore
      }
      
      return NextResponse.json(
        { 
          error: 'Generation failed', 
          details: stderr || stdout || 'Unknown error',
          exitCode,
          stdout 
        },
        { status: 500 }
      )
    }
    
    try {
      const { readFile } = await import('fs/promises')
      
      // Try to read verification JSON file first
      try {
        const verificationData = await readFile(verificationPath, 'utf-8')
        const parsed = JSON.parse(verificationData)
        content = parsed.content || ''
        verification = parsed.verification || null
      } catch (e) {
        // Fallback to reading markdown file
        try {
          content = await readFile(outputPath, 'utf-8')
        } catch (e2) {
          // If file doesn't exist, use stdout
          content = stdout
        }
      }
      
      // If we didn't get content from JSON, read markdown
      if (!content || content.trim() === '') {
        try {
          content = await readFile(outputPath, 'utf-8')
        } catch (e) {
          // Try stdout
          if (stdout && stdout.trim()) {
            content = stdout
          } else {
            // Last resort - return error
            return NextResponse.json(
              { 
                error: 'No content generated',
                details: 'The generation script completed but produced no output.',
                stdout: stdout.substring(0, 500),
                stderr: stderr.substring(0, 500)
              },
              { status: 500 }
            )
          }
        }
      }
      
      // Final check - ensure we have content
      if (!content || !content.trim()) {
        // Check if output file exists and has error message
        try {
          const { readFile } = await import('fs/promises')
          const errorFileContent = await readFile(outputPath, 'utf-8').catch(() => null)
          if (errorFileContent && errorFileContent.includes('# Error') || errorFileContent.includes('# Generation Error')) {
            // Return the error message from the file
            return NextResponse.json({
              content: errorFileContent,
              error: true,
              stdout: stdout.substring(0, 1000),
              stderr: stderr.substring(0, 1000)
            })
          }
        } catch (e) {
          // Ignore
        }
        
        return NextResponse.json(
          { 
            error: 'No content generated',
            details: 'The generation completed but the output file is empty.',
            stdout: stdout.substring(0, 1000),
            stderr: stderr.substring(0, 1000),
            exitCode
          },
          { status: 500 }
        )
      }
    } catch (e) {
      // If file doesn't exist, check stdout
      if (stdout && stdout.trim()) {
        content = stdout
      } else {
        console.error('Error reading output files:', e)
        return NextResponse.json(
          { 
            error: 'Failed to read generated content',
            details: String(e),
            stdout: stdout.substring(0, 500),
            stderr: stderr.substring(0, 500)
          },
          { status: 500 }
        )
      }
    }
    
    // Cleanup verification file
    try {
      await unlink(verificationPath).catch(() => {})
    } catch (e) {
      // Ignore
    }

    // Cleanup temp files
    try {
      for (const path of [templatePath, ...docPaths, outputPath]) {
        await unlink(path).catch(() => {})
      }
      await import('fs/promises').then((fs) =>
        fs.rmdir(tempDir).catch(() => {})
      )
    } catch (e) {
      // Ignore cleanup errors
    }

    // Send final response with all data
    const finalResponse = { 
      content, 
      verification,  // Will be extracted if available
      stdout, 
      stderr,
      logs: logs  // Already objects, no need to parse
    }
    
    return NextResponse.json(finalResponse)
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

