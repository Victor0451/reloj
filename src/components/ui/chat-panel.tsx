"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, MoreHorizontal, Plus, Calendar, Clock } from "lucide-react"

export interface ChatMessage {
  id: string
  content: string
  sender: "user" | "other"
  timestamp: Date
  avatar?: string
  name?: string
}

export interface ChatPanelProps {
  messages?: ChatMessage[]
  currentUserAvatar?: string
  otherUserName?: string
  otherUserAvatar?: string
  isOnline?: boolean
  onSendMessage?: (message: string) => void
  onAttachment?: () => void
  className?: string
}

function ChatPanel({
  messages = defaultMessages,
  currentUserAvatar,
  otherUserName = "User",
  otherUserAvatar,
  isOnline = false,
  onSendMessage,
  onAttachment,
  className,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = React.useState("")
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue)
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      data-slot="chat-panel"
      className={cn("flex flex-col h-full", className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="relative">
          <Avatar size="lg">
            {otherUserAvatar && <AvatarImage src={otherUserAvatar} alt={otherUserName} />}
            <AvatarFallback>{otherUserName[0]}</AvatarFallback>
          </Avatar>
          {/* Online indicator - UI Kit spec: green #10B981 */}
          {isOnline && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-card" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{otherUserName}</h3>
          <p className="text-xs text-muted-foreground">
            {isOnline ? "online" : "offline"}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timestamp */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            Fri, 02 July 2021 15:24
          </span>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2",
              message.sender === "user" && "flex-row-reverse"
            )}
          >
            {/* Avatar for received messages */}
            {message.sender === "other" && message.avatar && (
              <Avatar size="sm">
                <AvatarImage src={message.avatar} />
                <AvatarFallback>{message.name?.[0]}</AvatarFallback>
              </Avatar>
            )}
            
            {/* Bubble - UI Kit specs */}
            <div
              className={cn(
                "max-w-[70%] px-3 py-2 text-sm",
                message.sender === "user"
                  ? "chat-bubble-sent" // bg-primary, color white, radius 12 12 0 12
                  : "chat-bubble-received" // bg-secondary, radius 12 12 12 0
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - UI Kit spec: bg-secondary, border-radius 24px */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
          <Button 
            variant="ghost" 
            size="icon-xs"
            onClick={onAttachment}
            className="shrink-0"
          >
            <Plus className="size-4" />
          </Button>
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          
          <Button 
            variant="ghost" 
            size="icon-xs"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="shrink-0 text-primary hover:text-primary-dark"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Default messages for preview
const defaultMessages: ChatMessage[] = [
  {
    id: "1",
    content: "Hey! How's everything going?",
    sender: "other",
    timestamp: new Date(),
    name: "John",
  },
  {
    id: "2",
    content: "Great! Just finished the new design.",
    sender: "user",
    timestamp: new Date(),
  },
  {
    id: "3",
    content: "That sounds awesome! Can't wait to see it.",
    sender: "other",
    timestamp: new Date(),
    name: "John",
  },
]

export { ChatPanel, type ChatMessage as ChatMessageType }
