'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Brain, Send, X, MessageSquare, Loader2, Minimize2, Maximize2, Users, ShieldCheck, Newspaper, Zap, RefreshCw, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccessProps {
    onRefresh?: () => void
}

type AgentType = 'AUDY' | 'AS' | 'WIE' | 'WUE' | 'GROUP'

const agentStyles: Record<AgentType, { name: string, color: string, bg: string, border: string, icon: any, desc: string }> = {
    AUDY: { name: 'Audy', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: ShieldCheck, desc: 'Compliance & Audit' },
    AS: { name: 'As', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: MessageSquare, desc: 'Executive Assistant' },
    WIE: { name: 'Wie', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Newspaper, desc: 'Senior Journalist' },
    WUE: { name: 'Wue', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', icon: Zap, desc: 'Breaking News' },
    GROUP: { name: 'GROUP', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: Users, desc: 'Team Discussion' },
}

export function AdminChatWidget({ onRefresh }: AccessProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [activeAgent, setActiveAgent] = useState<AgentType>('AS')

    // Separate history for each agent
    const [histories, setHistories] = useState<Record<AgentType, { role: 'user' | 'assistant', content: string, agent?: string }[]>>({
        AUDY: [{ role: 'assistant', content: 'Compliance systems active.', agent: 'AUDY' }],
        AS: [{ role: 'assistant', content: 'How can I help organize your day?', agent: 'AS' }],
        WIE: [{ role: 'assistant', content: 'Ready to hunt for viral news.', agent: 'WIE' }],
        WUE: [{ role: 'assistant', content: 'Speed reporting ready.', agent: 'WUE' }],
        GROUP: [{ role: 'assistant', content: 'Group channel open.', agent: 'GROUP' }]
    })

    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [agentStatus, setAgentStatus] = useState<Record<AgentType, 'online' | 'offline' | 'checking'>>({
        AUDY: 'checking', AS: 'online', WIE: 'checking', WUE: 'checking', GROUP: 'online'
    })

    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom when the active history changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [histories, activeAgent, isOpen, isMinimized])

    const checkConnection = async (agent: AgentType) => {
        setAgentStatus(prev => ({ ...prev, [agent]: 'checking' }))
        try {
            const res = await fetch('/api/ai/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'command',
                    options: { agent, ping: true }
                })
            })
            const data = await res.json()
            if (data.success) {
                setAgentStatus(prev => ({ ...prev, [agent]: 'online' }))
            } else {
                setAgentStatus(prev => ({ ...prev, [agent]: 'offline' }))
            }
        } catch (e) {
            setAgentStatus(prev => ({ ...prev, [agent]: 'offline' }))
        }
    }

    const handleReconnect = () => {
        (Object.keys(agentStyles) as AgentType[]).forEach(a => checkConnection(a))
    }

    // Was firing 4 concurrent agent pings (each 2 DB writes + 1 external
    // gateway call) on every single admin page load, regardless of whether
    // the chat panel was ever opened - real, measurable contention against
    // this project's single pooled DB connection right when the dashboard
    // is trying to load everything else. Now only pings on first open.
    const hasConnectedRef = useRef(false)
    useEffect(() => {
        if (isOpen && !hasConnectedRef.current) {
            hasConnectedRef.current = true
            handleReconnect()
        }
    }, [isOpen])

    // --- AUTO-AUDIT TIMER (Every 5 Minutes) ---
    useEffect(() => {
        const runAudit = async () => {
            console.log("🛡️ Audy is running scheduled health check...")
            try {
                // Call the health-check action
                await fetch('/api/ai/assistant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'health-check' })
                })
                // Optionally update UI or notify (audy status is already tracked via checkConnection)

                // Also refresh connection status
                checkConnection('AUDY')
            } catch (e) {
                console.error("Auto-audit failed", e)
            }
        }

        // Run immediately on mount (or after short delay)
        const initialTimer = setTimeout(runAudit, 5000)
        // Then every 5 minutes
        const interval = setInterval(runAudit, 5 * 60 * 1000)

        return () => {
            clearTimeout(initialTimer)
            clearInterval(interval)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        // ... (rest of handleSubmit logic if needed, but for this replacement keeping it short or strictly moving the useEffect)
        const userMsg = input
        const currentAgent = activeAgent
        setInput('')

        // Optimistic update for the specific agent
        setHistories(prev => ({
            ...prev,
            [currentAgent]: [...prev[currentAgent], { role: 'user', content: userMsg }]
        }))

        setIsLoading(true)

        try {
            const res = await fetch('/api/ai/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'command',
                    options: {
                        command: userMsg,
                        agent: currentAgent
                    }
                })
            })

            const data = await res.json()

            if (data.success) {
                if (data.messages && data.messages.length > 0) {
                    // Handle multi-message response (Group Chat)
                    const newMessages = data.messages.map((m: any) => ({
                        role: 'assistant',
                        content: m.content,
                        agent: m.agent
                    }))
                    setHistories(prev => ({
                        ...prev,
                        [currentAgent]: [...prev[currentAgent], ...newMessages]
                    }))
                } else {
                    // Handle single legacy response
                    setHistories(prev => ({
                        ...prev,
                        [currentAgent]: [...prev[currentAgent], {
                            role: 'assistant',
                            content: data.response || 'Task completed.',
                            agent: data.agent || currentAgent
                        }]
                    }))
                }
                setAgentStatus(prev => ({ ...prev, [currentAgent]: 'online' }))
                if (onRefresh) onRefresh()
            } else {
                setHistories(prev => ({
                    ...prev,
                    [currentAgent]: [...prev[currentAgent], {
                        role: 'assistant',
                        content: `Error: ${data.error || 'Unknown error'}`,
                        agent: 'System'
                    }]
                }))
                setAgentStatus(prev => ({ ...prev, [currentAgent]: 'offline' }))
            }
        } catch (error) {
            setHistories(prev => ({
                ...prev,
                [currentAgent]: [...prev[currentAgent], {
                    role: 'assistant',
                    content: 'Connection error.',
                    agent: 'System'
                }]
            }))
            setAgentStatus(prev => ({ ...prev, [currentAgent]: 'offline' }))
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-110"
                onClick={() => setIsOpen(true)}
            >
                <MessageSquare className="h-6 w-6 text-white" />
            </Button>
        )
    }

    return (
        <Card className={cn(
            "fixed bottom-6 right-6 w-[450px] shadow-2xl z-50 transition-all duration-200 ease-in-out border-2 flex flex-col overflow-hidden bg-background",
            isMinimized ? "h-16" : "h-[600px]",
            agentStyles[activeAgent].border
        )}>
            {/* Header */}
            <CardHeader className={cn("p-3 flex flex-row items-center justify-between space-y-0 pb-3 border-b transition-colors shrink-0", agentStyles[activeAgent].bg)}>
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", agentStyles[activeAgent].bg, "brightness-95")}>
                        {(() => {
                            const Icon = agentStyles[activeAgent].icon
                            return <Icon className={cn("h-4 w-4", agentStyles[activeAgent].color)} />
                        })()}
                    </div>
                    <div>
                        <span className={cn("font-bold text-sm block", agentStyles[activeAgent].color)}>
                            {agentStyles[activeAgent].name}
                        </span>
                        <div className="flex items-center gap-1">
                            <Circle className={cn("h-2 w-2 fill-current",
                                agentStatus[activeAgent] === 'online' ? "text-green-500" :
                                    agentStatus[activeAgent] === 'offline' ? "text-red-500" : "text-yellow-500"
                            )} />
                            <span className="text-[10px] text-muted-foreground uppercase">{agentStatus[activeAgent]}</span>
                            {activeAgent === 'AUDY' && <span className="text-[10px] text-purple-500 ml-1">(Auto-Audit Initialized)</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReconnect} title="Reconnect Agents">
                        <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(!isMinimized)}>
                        {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </CardHeader>

            {!isMinimized && (
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-16 bg-muted/30 border-r flex flex-col items-center py-4 gap-2 shrink-0">
                        {(Object.keys(agentStyles) as AgentType[]).map((type) => {
                            const style = agentStyles[type]
                            const Icon = style.icon
                            const isActive = activeAgent === type
                            const status = agentStatus[type]
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveAgent(type)}
                                    className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all relative group",
                                        isActive ? cn("bg-white shadow-sm border", style.border) : "hover:bg-white/50"
                                    )}
                                    title={style.name}
                                >
                                    <Icon className={cn("h-5 w-5", isActive ? style.color : "text-muted-foreground")} />
                                    <span className={cn("absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ring-1 ring-white",
                                        status === 'online' ? "bg-green-500" :
                                            status === 'offline' ? "bg-red-500" : "bg-yellow-500"
                                    )} />
                                </button>
                            )
                        })}
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col bg-background/50">
                        <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
                            {/* Replaced ScrollArea with native div for reliable scrolling */}
                            <div
                                className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                                ref={scrollRef}
                            >
                                <div className="space-y-4 pb-4">
                                    {histories[activeAgent].map((m, i) => (
                                        <div key={i} className={cn("flex w-full flex-col gap-1", m.role === 'user' ? "items-end" : "items-start")}>
                                            <div className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                                m.role === 'user'
                                                    ? "bg-blue-600 text-white rounded-br-none"
                                                    : cn("bg-white border text-foreground rounded-bl-none", agentStyles[activeAgent].border)
                                            )}>
                                                {m.content}
                                            </div>
                                            {m.role === 'assistant' && (
                                                <span className="text-[10px] text-muted-foreground ml-2">
                                                    {m.agent}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex w-full justify-start animate-pulse delay-75">
                                            <div className="bg-muted rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Calling {agentStyles[activeAgent].name}...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="p-3 border-t bg-background">
                            <form onSubmit={handleSubmit} className="flex w-full gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={`Message ${agentStyles[activeAgent].name}...`}
                                    className="flex-1 h-9"
                                    disabled={isLoading}
                                />
                                <Button type="submit" size="icon" className="h-9 w-9" disabled={isLoading || !input.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </CardFooter>
                    </div>
                </div>
            )}
        </Card>
    )
}
