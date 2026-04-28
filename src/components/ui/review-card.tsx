"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Star, ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react"

export interface ReviewCardProps {
  name?: string
  avatar?: string
  rating?: number
  reviewCount?: number
  timestamp?: string
  title?: string
  content?: string
  helpfulQuestion?: string
  onHelpful?: (helpful: boolean) => void
  className?: string
}

function StarRating({ rating, maxStars = 5 }: { rating: number; maxStars?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-5", // UI Kit spec: 20px
            i < rating 
              ? "star-filled fill-current" 
              : "star-empty text-border"
          )}
        />
      ))}
    </div>
  )
}

function ReviewCard({
  name = "User Name",
  avatar,
  rating = 4,
  reviewCount = 105,
  timestamp = "7 August 2021 / 15:24",
  title = "Satisfied",
  content = "This product exceeded my expectations. The quality is outstanding and the delivery was prompt. I would highly recommend it to anyone looking for a reliable solution.",
  helpfulQuestion = "was this review helpfull?",
  onHelpful,
  className,
}: ReviewCardProps) {
  return (
    <div
      data-slot="review-card"
      className={cn(
        "flex flex-col gap-3 p-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Avatar - UI Kit spec: 40-48px */}
        <Avatar size="default">
          {avatar && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          {/* Name + review count - UI Kit spec: name bold, '105 Reviews' 12px #9CA3AF */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">
              {reviewCount} Reviews
            </span>
          </div>
          
          {/* Timestamp - UI Kit spec: 12px #9CA3AF */}
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>
        
        <Button variant="ghost" size="icon-xs">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      {/* Rating - UI Kit spec: 4 filled #F59E0B + 1 empty */}
      <StarRating rating={rating} />

      {/* Title - UI Kit spec: 'Satisfied' 14-16px bold #e5e5e5 */}
      <h4 className="text-base font-semibold text-foreground">{title}</h4>

      {/* Body - UI Kit spec: 14px, max 5-6 lines */}
      <p className="text-sm text-foreground/80 line-clamp-5">{content}</p>

      {/* Helpful question + CTAs */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">
          {helpfulQuestion}
        </p>
        
        <div className="flex gap-2">
          {/* Yes, helpful - UI Kit spec: filled button #7C3AED */}
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onHelpful?.(true)}
            className="flex-1"
          >
            <ThumbsUp className="size-3.5 mr-1" />
            yes, helpfull
          </Button>
          
          {/* No, didn't help - UI Kit spec: ghost, text #9CA3AF */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onHelpful?.(false)}
            className="flex-1 text-muted-foreground hover:text-foreground"
          >
            <ThumbsDown className="size-3.5 mr-1" />
            no, didn&apos;t help
          </Button>
        </div>
      </div>
    </div>
  )
}

export { ReviewCard, type ReviewCardProps as ReviewCardPropsType, StarRating }
