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

    const pythonProcess = spawn('python3', args, {
      env: {
        ...process.env,
        PATH: process.env.PATH || '',
      },
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', resolve)
    })

    // Read output file
    const outputPath = join(tempDir, 'output.md')
    const verificationPath = join(tempDir, 'output_verification.json')
    let content = ''
    let verification = null
    
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
        content = await readFile(outputPath, 'utf-8')
      }
      
      // If we didn't get content from JSON, read markdown
      if (!content) {
        content = await readFile(outputPath, 'utf-8')
      }
    } catch (e) {
      // If file doesn't exist, use stdout
      content = stdout
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

    if (exitCode !== 0) {
      console.error('Generation error:', stderr)
      return NextResponse.json(
        { error: 'Generation failed', details: stderr },
        { status: 500 }
      )
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

