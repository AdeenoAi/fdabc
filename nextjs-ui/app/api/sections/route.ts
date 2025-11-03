import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat, writeFile, unlink } from 'fs/promises'
import { join } from 'path'

export interface SavedSection {
  id: string
  fileName: string
  sectionName: string
  content: string
  createdAt: number
  updatedAt: number
  fileSize: number
}

export async function GET(request: NextRequest) {
  try {
    const outputDir = join(process.cwd(), 'output')
    
    // Ensure output directory exists
    try {
      await import('fs/promises').then((fs) =>
        fs.mkdir(outputDir, { recursive: true })
      )
    } catch (e) {
      // Directory might already exist
    }

    // Read all .md files from output directory
    const files = await readdir(outputDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    
    const sections: SavedSection[] = []
    
    for (const file of mdFiles) {
      try {
        const filePath = join(outputDir, file)
        const stats = await stat(filePath)
        const content = await readFile(filePath, 'utf-8')
        
        // Extract section name from filename (format: section_name_timestamp.md)
        const match = file.match(/^(.+?)_(\d+)\.md$/)
        const sectionName = match ? match[1].replace(/_/g, ' ') : file.replace('.md', '')
        const timestamp = match ? parseInt(match[2]) : stats.mtimeMs
        
        sections.push({
          id: file.replace('.md', ''),
          fileName: file,
          sectionName,
          content,
          createdAt: timestamp,
          updatedAt: stats.mtimeMs,
          fileSize: stats.size,
        })
      } catch (error) {
        console.error(`Error reading file ${file}:`, error)
      }
    }
    
    // Sort by most recently updated first
    sections.sort((a, b) => b.updatedAt - a.updatedAt)
    
    return NextResponse.json({ sections })
  } catch (error: any) {
    console.error('Error listing sections:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list sections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, content } = await request.json()

    if (!id || !content) {
      return NextResponse.json(
        { error: 'ID and content are required' },
        { status: 400 }
      )
    }

    const outputDir = join(process.cwd(), 'output')
    const fileName = `${id}.md`
    const filePath = join(outputDir, fileName)

    // Check if file exists
    try {
      await stat(filePath)
    } catch (e) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    await writeFile(filePath, content, 'utf-8')

    // Get updated stats
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const outputDir = join(process.cwd(), 'output')
    const fileName = `${id}.md`
    const filePath = join(outputDir, fileName)

    try {
      await unlink(filePath)
      return NextResponse.json({ success: true })
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
    console.error('Error deleting section:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete section' },
      { status: 500 }
    )
  }
}

