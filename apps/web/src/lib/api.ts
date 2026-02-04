export interface Webhook {
  id: number
  name: string
  url: string
  isDefault: boolean
}

export interface Reminder {
  id: number
  title: string
  content: string | null
  remindAt: string
  status: 'pending' | 'sent' | 'failed'
  webhookId: number
  webhook: { id: number; name: string }
  errorMessage: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Webhooks
export async function getWebhooks(): Promise<Webhook[]> {
  const res = await fetch('/api/webhooks')
  return res.json()
}

export async function createWebhook(data: Omit<Webhook, 'id'>): Promise<Webhook> {
  const res = await fetch('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function deleteWebhook(id: number): Promise<void> {
  await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
}

// Reminders
export async function getReminders(
  params?: { status?: string; page?: number }
): Promise<PaginatedResponse<Reminder>> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', params.page.toString())
  const res = await fetch(`/api/reminders?${searchParams}`)
  return res.json()
}

export async function createReminder(data: {
  title: string
  content?: string
  remindAt: string
  webhookId: number
}): Promise<Reminder> {
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function updateReminder(
  id: number,
  data: Partial<{ title: string; content: string; remindAt: string; webhookId: number }>
): Promise<Reminder> {
  const res = await fetch(`/api/reminders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function deleteReminder(id: number): Promise<void> {
  await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
}

export async function retryReminder(id: number): Promise<Reminder> {
  const res = await fetch(`/api/reminders/${id}/retry`, { method: 'POST' })
  return res.json()
}
