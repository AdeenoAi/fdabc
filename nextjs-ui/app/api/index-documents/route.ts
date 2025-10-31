import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { writeFile, mkdir, unlink } from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const documents = formData.getAll('documents') as File[]
    const collectionName = (formData.get('collection') as string) || 'bio_drug_docs'

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents provided' },
        { status: 400 }
      )
    }

    // Save files temporarily
    const tempDir = join('/tmp', `index-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    const docPaths: string[] = []
    for (const doc of documents) {
      const docPath = join(tempDir, doc.name)
      const docBytes = await doc.arrayBuffer()
      await writeFile(docPath, Buffer.from(docBytes))
      docPaths.push(docPath)
    }

    // Call Python script to index documents
    const pythonScript = join(process.cwd(), '..', 'index_documents_llama.py')
    const args = [
      pythonScript,
      '--docs',
      tempDir,
      '--collection',
      collectionName,
      '--qdrant-url',
      process.env.QDRANT_URL || 'http://localhost:6333',
    ]

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

    // Cleanup temp files
    try {
      for (const path of docPaths) {
        await unlink(path).catch(() => {})
      }
      await import('fs/promises').then((fs) =>
        fs.rmdir(tempDir).catch(() => {})
      )
    } catch (e) {
      // Ignore cleanup errors
    }

    if (exitCode !== 0) {
      console.error('Indexing error:', stderr)
      return NextResponse.json(
        { error: 'Indexing failed', details: stderr },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Documents indexed successfully',
      collection: collectionName,
      stdout,
      documentsCount: documents.length
    })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

