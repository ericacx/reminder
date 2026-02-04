import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reminder - 提醒管理',
  description: '企业微信提醒推送管理系统'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
