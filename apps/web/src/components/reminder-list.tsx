'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ReminderForm } from './reminder-form'
import {
  getReminders,
  deleteReminder,
  retryReminder,
  Reminder,
  PaginatedResponse
} from '@/lib/api'
import { toast } from 'sonner'

type Status = 'pending' | 'sent' | 'failed'

const statusLabels: Record<Status, string> = {
  pending: '待推送',
  sent: '已推送',
  failed: '失败'
}

const statusColors: Record<Status, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  sent: 'text-green-600 bg-green-50',
  failed: 'text-red-600 bg-red-50'
}

export function ReminderList() {
  const [data, setData] = useState<PaginatedResponse<Reminder> | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const fetchData = useCallback(async () => {
    const result = await getReminders({
      status: statusFilter === 'all' ? undefined : statusFilter
    })
    setData(result)
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setFormOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个提醒吗？')) return
    await deleteReminder(id)
    toast.success('删除成功')
    fetchData()
  }

  const handleRetry = async (id: number) => {
    await retryReminder(id)
    toast.success('已重新排队，等待推送')
    fetchData()
  }

  const handleCreate = () => {
    setEditingReminder(null)
    setFormOpen(true)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">提醒列表</h1>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as Status | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待推送</SelectItem>
              <SelectItem value="sent">已推送</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate}>新建提醒</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>提醒时间</TableHead>
              <TableHead>推送群</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((reminder) => (
              <TableRow key={reminder.id}>
                <TableCell className="font-medium">{reminder.title}</TableCell>
                <TableCell>{formatDate(reminder.remindAt)}</TableCell>
                <TableCell>{reminder.webhook.name}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-sm ${statusColors[reminder.status]}`}
                  >
                    {statusLabels[reminder.status]}
                  </span>
                  {reminder.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{reminder.errorMessage}</p>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {reminder.status === 'pending' && (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(reminder)}>
                      编辑
                    </Button>
                  )}
                  {reminder.status === 'failed' && (
                    <Button variant="ghost" size="sm" onClick={() => handleRetry(reminder.id)}>
                      重试
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDelete(reminder.id)}
                  >
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  暂无提醒
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ReminderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        reminder={editingReminder}
        onSuccess={fetchData}
      />
    </div>
  )
}
