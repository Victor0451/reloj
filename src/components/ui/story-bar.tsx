"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from "@/components/ui/avatar"
import { ChevronRight, Plus } from "lucide-react"

export interface Story {
  id: string
  username: string
  avatar?: string
  hasStory?: boolean
  isOwn?: boolean
}

export interface StoryBarProps {
  stories?: Story[]
  onStoryClick?: (story: Story) => void
  onAddStory?: () => void
  className?: string
}

function StoryBar({
  stories = defaultStories,
  onStoryClick,
  onAddStory,
  className,
}: StoryBarProps) {
  return (
    <div
      data-slot="story-bar"
      className={cn(
        "flex items-center gap-3 overflow-x-auto pb-2 px-2",
        // UI Kit spec: horizontal scroll
        "scrollbar-hide",
        className
      )}
    >
      {/* Own story - with + badge (UI Kit spec: #7C3AED) */}
      <div 
        className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
        onClick={onAddStory}
      >
        <div className="relative">
          <Avatar size="default" variant="active">
            <AvatarImage src={stories.find(s => s.isOwn)?.avatar} />
            <AvatarFallback>You</AvatarFallback>
          </Avatar>
          {/* Badge add - UI Kit spec: 18px circle #7C3AED with + white */}
          <AvatarBadge variant="add">
            <Plus className="size-2.5" />
          </AvatarBadge>
        </div>
        <span className="text-[10px] text-muted-foreground text-center max-w-[48px] truncate">
          Your Story
        </span>
      </div>

      {/* Other stories - UI Kit spec: border 2px solid #A78BFA */}
      {stories.filter(s => !s.isOwn).map((story) => (
        <div 
          key={story.id}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
          onClick={() => onStoryClick?.(story)}
        >
          <div className="relative">
            <Avatar size="default" variant="active">
              {story.avatar && <AvatarImage src={story.avatar} alt={story.username} />}
              <AvatarFallback>{story.username[0]}</AvatarFallback>
            </Avatar>
            {/* Border for stories - UI Kit spec: 2px solid #A78BFA */}
            <div className="absolute inset-0 rounded-full ring-2 ring-primary-light" />
          </div>
          <span className="text-[10px] text-muted-foreground text-center max-w-[48px] truncate">
            {story.username}
          </span>
        </div>
      ))}

      {/* Navigation arrow - UI Kit spec: '›' right for more items */}
      {stories.length > 4 && (
        <div className="flex items-center justify-center size-12 shrink-0">
          <ChevronRight className="size-5 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// Default stories for preview
const defaultStories: Story[] = [
  { id: "1", username: "john_doe", avatar: "", hasStory: true, isOwn: true },
  { id: "2", username: "jane_smith", avatar: "", hasStory: true },
  { id: "3", username: "bob_wilson", avatar: "", hasStory: true },
  { id: "4", username: "alice_jones", avatar: "", hasStory: true },
  { id: "5", username: "charlie_b", avatar: "", hasStory: false },
]

export { StoryBar, type Story as StoryType, type StoryBarProps as StoryBarPropsType }
