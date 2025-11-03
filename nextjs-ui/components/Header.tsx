'use client'

import { FolderOpen, FileDown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Header() {
  const pathname = usePathname()
  const isSectionsPage = pathname === '/sections'
  const isPdfPage = pathname === '/pdf'
  const isDashboardPage = pathname === '/dashboard'

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-semibold text-foreground">AdeenoAi</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDashboardPage
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                Generator
              </Link>
              <Link
                href="/sections"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSectionsPage
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                Saved Sections
              </Link>
              {isSectionsPage && (
                <Link
                  href="/pdf?all=true"
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  title="View all sections as PDF"
                >
                  <FileDown className="w-4 h-4" />
                  PDF View
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

