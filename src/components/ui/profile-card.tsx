"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, Mail, Phone, MapPin, MoreHorizontal } from "lucide-react"

export interface ProfileCardProps {
  name?: string
  avatar?: string
  rating?: number
  reviewCount?: number
  email?: string
  phone?: string
  location?: string
  onFollow?: () => void
  onMessage?: () => void
  className?: string
}

function StarRating({ rating, maxStars = 5 }: { rating: number; maxStars?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i < rating 
              ? "star-filled fill-current" // #F59E0B
              : "star-empty text-border"  // #E5E7EB (dark: #3f3f3f)
          )}
        />
      ))}
    </div>
  )
}

function ProfileCard({
  name = "User Name",
  avatar,
  rating = 4,
  reviewCount = 105,
  email = "user@email.com",
  phone = "+1 234 567 890",
  location = "New York, USA",
  onFollow,
  onMessage,
  className,
}: ProfileCardProps) {
  return (
    <div
      data-slot="profile-card"
      className={cn(
        "flex flex-col items-center p-6 space-y-4",
        className
      )}
    >
      {/* Header with menu */}
      <div className="w-full flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          user profile
        </span>
        <Button variant="ghost" size="icon-xs">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      {/* Avatar - UI Kit spec: 64px, border 2px solid #A78BFA */}
      <div className="relative">
        <Avatar size="lg" variant="active">
          {avatar && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
      </div>

      {/* Name - UI Kit spec: 18-20px, bold, #374151 (dark: #e5e5e5) */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground">{name}</h3>
        
        {/* Rating - UI Kit spec: 5 stars, filled #F59E0B, empty #E5E7EB (dark: #3f3f3f) */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <StarRating rating={rating} />
          <span className="text-xs text-muted-foreground">
            {reviewCount} Reviews
          </span>
        </div>
      </div>

      {/* Contact info - UI Kit spec: icon #7C3AED followed by text */}
      <div className="w-full space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="size-4 text-primary shrink-0" />
          <span className="text-foreground">{email}</span>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          <Phone className="size-4 text-primary shrink-0" />
          <span className="text-foreground">{phone}</span>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          <MapPin className="size-4 text-primary shrink-0" />
          <span className="text-foreground">{location}</span>
        </div>
      </div>

      {/* Actions - UI Kit spec: follow (filled primary), message (outline secondary) */}
      <div className="w-full space-y-2 pt-2">
        <Button 
          variant="default" 
          size="lg" 
          className="w-full"
          onClick={onFollow}
        >
          Follow
        </Button>
        
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full"
          onClick={onMessage}
        >
          Message
        </Button>
      </div>
    </div>
  )
}

export { ProfileCard, type ProfileCardProps as ProfileCardPropsType, StarRating }
