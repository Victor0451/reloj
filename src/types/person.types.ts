export interface PersonRecord {
  id: string
  employee_id: string | null
  name: string
  department: string | null
  card_number: string | null
  face_photo_url: string | null
  device_employee_no: number | null
  status: 'active' | 'inactive' | 'pending_sync'
  created_at: string
  updated_at: string
}

export interface CreatePersonInput {
  name: string
  employee_id?: string
  department?: string
  card_number?: string
  face_photo_url?: string
}

export interface UpdatePersonInput extends Partial<CreatePersonInput> {}

export interface ListPersonsOptions {
  page?: number
  pageSize?: number
  search?: string
  statusFilter?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface CsvRow {
  name: string
  employee_id?: string
  department?: string
  card_number?: string
}

export interface BatchResult {
  created: number
  skipped: number
  errors: { row: number; error: string }[]
}
