'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, MessageSquare, Users, Zap } from 'lucide-react'
import { io } from 'socket.io-client'

export default function Dashboard() {
  const [stats, setStats] = useState({
    status: 'connecting',
    activeSessions: 0,
    messagesCount: 0,
    responseTime: 0,
  })
  const [recentMessages, setRecentMessages] = useState([])

  useEffect(() => {
    // Connect to backend Socket.IO
    const socket = io('http://localhost:3003')

    socket.on('connect', () => {
      console.log('Connected to backend')
      socket.emit('get-status')
      socket.emit('get-messages')
    })

    socket.on('status', (status) => {
      setStats(prev => ({
        ...prev,
        status: status.connected ? 'connected' : 'disconnected',
        activeSessions: status.activeSessions || 0,
        messagesCount: status.messagesCount || 0,
        responseTime: status.avgResponseTime || 0,
      }))
    })

    socket.on('messages', (messages) => {
      setRecentMessages(messages.slice(0, 10))
    })

    socket.on('new-message', (message) => {
      setRecentMessages(prev => [message, ...prev].slice(0, 10))
      setStats(prev => ({
        ...prev,
        messagesCount: prev.messagesCount + 1,
      }))
    })

    socket.on('connection-update', ({ state }) => {
      setStats(prev => ({
        ...prev,
        status: state === 'open' ? 'connected' : 'disconnected',
      }))
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const statCards = [
    {
      title: 'Status',
      value: stats.status,
      icon: Activity,
      badge: stats.status === 'connected' ? 'success' : 'destructive',
    },
    {
      title: 'Active Sessions',
      value: stats.activeSessions,
      icon: Users,
      description: 'Current conversations',
    },
    {
      title: 'Messages Today',
      value: stats.messagesCount,
      icon: MessageSquare,
      description: 'Total processed',
    },
    {
      title: 'Avg Response Time',
      value: `${stats.responseTime}ms`,
      icon: Zap,
      description: 'AI processing speed',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Monitor your WhatsApp AI agent performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {stat.badge ? (
                    <Badge variant={stat.badge} className="text-xs capitalize">
                      {stat.value}
                    </Badge>
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                </div>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest messages processed by the agent</CardDescription>
        </CardHeader>
        <CardContent>
          {recentMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Waiting for incoming messages...
            </p>
          ) : (
            <div className="space-y-4">
              {recentMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {msg.from?.replace('@s.whatsapp.net', '')}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {msg.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
