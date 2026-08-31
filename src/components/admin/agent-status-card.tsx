'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Brain, Shield, PenTool, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface AgentStatus {
    AUDY: string
    AS: string
    WUE: string
    WIE: string
}

const agents = [
    { id: 'AS', name: 'As (Lead)', icon: Brain, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'AUDY', name: 'Audy (Audit)', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'WUE', name: 'Wue (Reporter)', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'WIE', name: 'Wie (Journalist)', icon: PenTool, color: 'text-green-500', bg: 'bg-green-500/10' },
]

export function AgentStatusCard() {
    const [status, setStatus] = useState<AgentStatus>({
        AUDY: 'Idle',
        AS: 'Idle',
        WUE: 'Idle',
        WIE: 'Idle'
    })

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/ai/status')
                if (res.ok) {
                    const data = await res.json()
                    setStatus(data.agentStatus || status)
                }
            } catch (e) {
                console.error("Failed to fetch agent status")
            }
        }

        fetchStatus()
        // 3s was hammering the single pooled DB connection for a purely
        // decorative status widget; 15s still reads as "live" without
        // competing with real admin actions for that connection.
        const interval = setInterval(fetchStatus, 15000)
        return () => clearInterval(interval)
    }, [])

    return (
        <Card className="border-indigo-500/20 bg-indigo-50/05 h-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-indigo-500" />
                    Live Agent Activity
                </CardTitle>
                <CardDescription>Real-time operations of the AI Newsroom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {agents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-md", agent.bg)}>
                                <agent.icon className={cn("h-4 w-4", agent.color)} />
                            </div>
                            <div>
                                <p className="font-medium text-sm leading-none mb-1">{agent.name}</p>
                                <p className="text-xs text-muted-foreground animate-pulse">
                                    {status[agent.id as keyof AgentStatus]}
                                </p>
                            </div>
                        </div>
                        <Badge variant={
                            status[agent.id as keyof AgentStatus] === 'Offline' ? 'destructive' :
                                (status[agent.id as keyof AgentStatus] === 'Idle' || status[agent.id as keyof AgentStatus] === 'Standby') ? 'secondary' :
                                    'default'
                        }
                            className={cn(
                                status[agent.id as keyof AgentStatus] !== 'Idle' && status[agent.id as keyof AgentStatus] !== 'Standby' && status[agent.id as keyof AgentStatus] !== 'Offline' && "bg-green-500 hover:bg-green-600",
                                status[agent.id as keyof AgentStatus] === 'Offline' && "bg-red-500"
                            )}>
                            {status[agent.id as keyof AgentStatus] === 'Offline' ? 'Offline' :
                                (status[agent.id as keyof AgentStatus] === 'Idle' || status[agent.id as keyof AgentStatus] === 'Standby') ? 'Standby' :
                                    'Online'}
                        </Badge>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
