import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const templateFile = formData.get('template') as File

    if (!templateFile) {
      return NextResponse.json(
        { error: 'No template file provided' },
        { status: 400 }
      )
    }

    // Save uploaded file temporarily
    const bytes = await templateFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tempPath = join('/tmp', `template-${Date.now()}-${templateFile.name}`)
    await writeFile(tempPath, buffer)

    // Call Python script to analyze template
    const pythonScript = join(process.cwd(), '..', 'analyze_template_api.py')
    const pythonProcess = spawn('python3', [
      pythonScript,
      '--template',
      tempPath,
    ])

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

    // Cleanup temp file
    await unlink(tempPath).catch(() => {})

    if (exitCode !== 0) {
      console.error('Python script error:', stderr)
      return NextResponse.json(
        { error: 'Failed to analyze template', details: stderr },
        { status: 500 }
      )
    }

    const result = JSON.parse(stdout)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

