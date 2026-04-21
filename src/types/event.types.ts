/**
 * Event-related types for the reloj system.
 *
 * Note: EventWithPerson is also defined inline in src/actions/events.ts
 * to avoid circular imports. Keep in sync.
 */

import type { Database } from './database.types'

export type EventRecord = Database['public']['Tables']['access_events']['Row']

export interface EventWithPerson extends Omit<EventRecord, 'raw_payload'> {
  person_name: string | null
  raw_payload?: unknown | null
}

export interface ListEventsOptions {
  dateStart?: string
  dateEnd?: string
  eventType?: string
  employeeId?: string
}

export interface ListEventsResult {
  events: EventWithPerson[]
  nextCursor: string | null
  hasMore: boolean
  totalCount: number
}
