'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function Nav() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: '提醒列表' },
    { href: '/settings', label: '设置' }
  ]

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            ⏰ Reminder
          </Link>
          <div className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm transition-colors hover:text-foreground/80',
                  pathname === link.href ? 'text-foreground font-medium' : 'text-foreground/60'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
