import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { sectionId, allSections } = await request.json()

    if (allSections) {
      // Generate PDF for all sections
      const outputDir = join(process.cwd(), 'output')
      const files = await readdir(outputDir)
      const mdFiles = files.filter(f => f.endsWith('.md')).sort()

      const sections: Array<{ name: string; content: string }> = []
      
      for (const file of mdFiles) {
        try {
          const filePath = join(outputDir, file)
          const content = await readFile(filePath, 'utf-8')
          const match = file.match(/^(.+?)_(\d+)\.md$/)
          const sectionName = match ? match[1].replace(/_/g, ' ') : file.replace('.md', '')
          
          sections.push({
            name: sectionName,
            content,
          })
        } catch (error) {
          console.error(`Error reading file ${file}:`, error)
        }
      }

      // Combine all sections into one document
      const fullDocument = sections
        .map(section => `# ${section.name}\n\n${section.content}`)
        .join('\n\n---\n\n')

      return NextResponse.json({
        success: true,
        content: fullDocument,
        sectionName: 'Complete Document',
        totalSections: sections.length,
      })
    } else if (sectionId) {
      // Generate PDF for single section
      const outputDir = join(process.cwd(), 'output')
      const fileName = `${sectionId}.md`
      const filePath = join(outputDir, fileName)

      try {
        const content = await readFile(filePath, 'utf-8')
        const match = sectionId.match(/^(.+?)_(\d+)$/)
        const sectionName = match ? match[1].replace(/_/g, ' ') : sectionId.replace(/_/g, ' ')

        return NextResponse.json({
          success: true,
          content,
          sectionName,
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
    } else {
      return NextResponse.json(
        { error: 'Either sectionId or allSections must be provided' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error generating PDF data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF data' },
      { status: 500 }
    )
  }
}

