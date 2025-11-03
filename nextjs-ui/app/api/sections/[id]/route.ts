import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const id = resolvedParams.id
    const outputDir = join(process.cwd(), 'output')
    const fileName = `${id}.md`
    const filePath = join(outputDir, fileName)

    try {
      const content = await readFile(filePath, 'utf-8')
      const stats = await stat(filePath)
      
      // Extract section name from filename
      const match = id.match(/^(.+?)_(\d+)$/)
      const sectionName = match ? match[1].replace(/_/g, ' ') : id.replace(/_/g, ' ')
      const timestamp = match ? parseInt(match[2]) : stats.mtimeMs

      return NextResponse.json({
        id,
        fileName,
        sectionName,
        content,
        createdAt: timestamp,
        updatedAt: stats.mtimeMs,
        fileSize: stats.size,
      })
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Section not found' },
          { status: 404 }
        )
      }
      throw e
    }
  } catch (error: any) {
    console.error('Error getting section:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get section' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const id = resolvedParams.id
    const { content } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const outputDir = join(process.cwd(), 'output')
    const fileName = `${id}.md`
    const filePath = join(outputDir, fileName)

    // Check if file exists
    try {
      await stat(filePath)
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Section not found' },
          { status: 404 }
        )
      }
      throw e
    }

    await writeFile(filePath, content, 'utf-8')
    const stats = await stat(filePath)

    return NextResponse.json({
      success: true,
      fileName,
      updatedAt: stats.mtimeMs,
    })
  } catch (error: any) {
    console.error('Error updating section:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update section' },
      { status: 500 }
    )
  }
}

