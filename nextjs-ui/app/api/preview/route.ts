import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const templateFile = formData.get('template') as File
    const section = formData.get('section') as string

    if (!templateFile || !section) {
      return NextResponse.json(
        { error: 'Template file and section are required' },
        { status: 400 }
      )
    }

    // Create temp directory
    const tempDir = join(tmpdir(), `preview-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    // Save template file
    const templatePath = join(tempDir, templateFile.name)
    const templateBytes = await templateFile.arrayBuffer()
    await writeFile(templatePath, Buffer.from(templateBytes))

    // Call Python script to preview
    const pythonScript = join(process.cwd(), '..', 'preview_generation.py')
    const args = [
      pythonScript,
      '--template',
      templatePath,
      '--section',
      section,
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
      await unlink(templatePath).catch(() => {})
    } catch (e) {
      // Ignore
    }

    if (exitCode !== 0) {
      return NextResponse.json(
        { error: 'Preview failed', details: stderr },
        { status: 500 }
      )
    }

    // Parse JSON output
    try {
      const preview = JSON.parse(stdout)
      return NextResponse.json(preview)
    } catch (e) {
      // If not JSON, return as text
      return NextResponse.json({
        prompt: stdout,
        raw_output: stdout
      })
    }
  } catch (error: any) {
    console.error('Preview API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

