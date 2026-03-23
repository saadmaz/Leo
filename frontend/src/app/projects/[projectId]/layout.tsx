'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { AnnouncementBanner } from '@/components/layout/announcement-banner'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AnnouncementBanner />
        {children}
      </div>
    </div>
  )
}
