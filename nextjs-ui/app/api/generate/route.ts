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

    const pythonProcess = spawn('python3', args, {
      env: {
        ...process.env,
        PATH: process.env.PATH || '',
      },
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      console.log('Python stdout:', text)
    })

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      console.error('Python stderr:', text)
    })

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`)
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

    return NextResponse.json({ 
      content, 
      verification,  // Will be extracted if available
      stdout, 
      stderr 
    })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

