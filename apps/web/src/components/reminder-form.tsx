'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { getWebhooks, createReminder, updateReminder, Webhook, Reminder } from '@/lib/api'
import { toast } from 'sonner'

interface ReminderFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder | null
  onSuccess: () => void
}

export function ReminderForm({ open, onOpenChange, reminder, onSuccess }: ReminderFormProps) {
  const [loading, setLoading] = useState(false)
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    remindAt: '',
    webhookId: ''
  })

  useEffect(() => {
    if (open) {
      getWebhooks().then(setWebhooks)
      if (reminder) {
        setFormData({
          title: reminder.title,
          content: reminder.content || '',
          remindAt: new Date(reminder.remindAt).toISOString().slice(0, 16),
          webhookId: reminder.webhookId.toString()
        })
      } else {
        setFormData({ title: '', content: '', remindAt: '', webhookId: '' })
      }
    }
  }, [open, reminder])

  // 设置默认 webhook
  useEffect(() => {
    if (!formData.webhookId && webhooks.length > 0) {
      const defaultWebhook = webhooks.find((w) => w.isDefault) || webhooks[0]
      setFormData((prev) => ({ ...prev, webhookId: defaultWebhook.id.toString() }))
    }
  }, [webhooks, formData.webhookId])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (reminder) {
        await updateReminder(reminder.id, {
          ...formData,
          webhookId: parseInt(formData.webhookId)
        })
        toast.success('更新成功')
      } else {
        await createReminder({
          ...formData,
          webhookId: parseInt(formData.webhookId)
        })
        toast.success('创建成功')
      }
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reminder ? '编辑提醒' : '新建提醒'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remindAt">提醒时间 *</Label>
              <Input
                id="remindAt"
                type="datetime-local"
                value={formData.remindAt}
                onChange={(e) => setFormData({ ...formData, remindAt: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook">推送群 *</Label>
              <Select
                value={formData.webhookId}
                onValueChange={(value) => setFormData({ ...formData, webhookId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择推送群" />
                </SelectTrigger>
                <SelectContent>
                  {webhooks.map((webhook) => (
                    <SelectItem key={webhook.id} value={webhook.id.toString()}>
                      {webhook.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
