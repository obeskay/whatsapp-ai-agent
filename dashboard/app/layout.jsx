import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'WhatsApp AI Agent Dashboard',
  description: 'Monitor and manage your WhatsApp AI agent',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto py-6 px-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
