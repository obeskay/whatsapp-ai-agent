'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MessageSquare, LayoutDashboard, Settings } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/conversations', label: 'Conversations', icon: MessageSquare },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">WhatsApp AI Agent</h1>
          </div>

          <nav className="flex items-center space-x-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
