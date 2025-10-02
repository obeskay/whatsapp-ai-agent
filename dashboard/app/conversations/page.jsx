'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Clock, User } from 'lucide-react'
import { io } from 'socket.io-client'

export default function Conversations() {
  const [conversations, setConversations] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    // Fetch conversations from API
    fetch('http://localhost:3003/health')
      .then(res => res.json())
      .then(data => {
        // Mock conversations data - replace with actual API
        setConversations([
          {
            id: '1',
            contact: '+1234567890',
            lastMessage: 'Hello, I need help with...',
            timestamp: new Date(),
            status: 'active',
            messageCount: 12,
          },
          {
            id: '2',
            contact: '+0987654321',
            lastMessage: 'Thanks for your help!',
            timestamp: new Date(Date.now() - 3600000),
            status: 'resolved',
            messageCount: 8,
          },
        ])
      })
      .catch(err => console.error('Failed to fetch conversations:', err))

    // Connect to Socket.IO for real-time updates
    const socket = io('http://localhost:3003')

    socket.on('new-message', (message) => {
      // Update conversations with new message
      setConversations(prev => {
        const existing = prev.find(c => c.contact === message.from)
        if (existing) {
          return prev.map(c =>
            c.contact === message.from
              ? { ...c, lastMessage: message.type, timestamp: new Date(message.timestamp) }
              : c
          )
        }
        return [{
          id: Date.now().toString(),
          contact: message.from,
          lastMessage: message.type,
          timestamp: new Date(message.timestamp),
          status: 'active',
          messageCount: 1,
        }, ...prev]
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const filteredConversations = conversations.filter(conv => {
    if (filter === 'all') return true
    return conv.status === filter
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Conversations</h2>
        <p className="text-muted-foreground">
          View and manage active WhatsApp conversations
        </p>
      </div>

      <Tabs defaultValue="all" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-6">
          {filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversations found
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredConversations.map((conv) => (
              <Card key={conv.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {conv.contact.replace('@s.whatsapp.net', '')}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {conv.lastMessage}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={conv.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {conv.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{conv.messageCount} messages</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimestamp(conv.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatTimestamp(date) {
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
