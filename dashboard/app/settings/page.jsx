'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings as SettingsIcon, Mic, Zap, Globe, Shield } from 'lucide-react'

export default function Settings() {
  const [config, setConfig] = useState({
    agentName: 'Loading...',
    personality: 'Loading...',
    language: 'en',
    enableVoice: false,
    autoTranscribe: false,
    useOpenRouter: false,
    model: 'gpt-4',
  })

  useEffect(() => {
    // Fetch config from API
    fetch('http://localhost:3003/health')
      .then(res => res.json())
      .then(data => {
        // Parse config from environment or API
        setConfig({
          agentName: process.env.NEXT_PUBLIC_AGENT_NAME || 'AI Assistant',
          personality: 'Helpful, friendly, professional',
          language: 'en',
          enableVoice: true,
          autoTranscribe: true,
          useOpenRouter: false,
          model: 'gpt-4',
        })
      })
      .catch(err => console.error('Failed to fetch config:', err))
  }, [])

  const configSections = [
    {
      title: 'Agent Configuration',
      icon: SettingsIcon,
      items: [
        { label: 'Agent Name', value: config.agentName },
        { label: 'Personality', value: config.personality },
        { label: 'Language', value: config.language.toUpperCase() },
      ],
    },
    {
      title: 'Voice Features',
      icon: Mic,
      items: [
        { label: 'Voice Messages', value: config.enableVoice, type: 'boolean' },
        { label: 'Auto Transcribe', value: config.autoTranscribe, type: 'boolean' },
      ],
    },
    {
      title: 'AI Model',
      icon: Zap,
      items: [
        { label: 'Provider', value: config.useOpenRouter ? 'OpenRouter' : 'OpenAI' },
        { label: 'Model', value: config.model },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Configure your WhatsApp AI agent
          </p>
        </div>
        <Button>
          <Shield className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {configSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title}>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle>{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.type === 'boolean' ? (
                        <Badge variant={item.value ? 'success' : 'secondary'}>
                          {item.value ? 'Enabled' : 'Disabled'}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {item.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>API Configuration</CardTitle>
            </div>
            <CardDescription>
              Connection settings for Evolution API and AI services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Evolution API</span>
                <Badge variant="success">Connected</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">OpenAI API</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">Webhook URL</span>
                <span className="text-sm text-muted-foreground font-mono">
                  http://localhost:3003/webhook
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment Information</CardTitle>
          <CardDescription>
            Current runtime environment and version details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium mb-1">Node Environment</p>
              <Badge variant="outline">Development</Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Server Port</p>
              <span className="text-sm text-muted-foreground">3003</span>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Dashboard Port</p>
              <span className="text-sm text-muted-foreground">3004</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
