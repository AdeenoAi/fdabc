import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { content, section } = await request.json()

    if (!content || !section) {
      return NextResponse.json(
        { error: 'Content and section are required' },
        { status: 400 }
      )
    }

    // Save to output directory
    const outputDir = join(process.cwd(), 'output')
    const fileName = `${section.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`
    const filePath = join(outputDir, fileName)

    // Ensure output directory exists
    try {
      await import('fs/promises').then((fs) =>
        fs.mkdir(outputDir, { recursive: true })
      )
    } catch (e) {
      // Directory might already exist
    }

    await writeFile(filePath, content, 'utf-8')

    return NextResponse.json({
      success: true,
      fileName,
      filePath,
    })
  } catch (error: any) {
    console.error('Save error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save file' },
      { status: 500 }
    )
  }
}

