'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { getWebhooks, createWebhook, deleteWebhook, Webhook } from '@/lib/api'
import { toast } from 'sonner'

export function WebhookList() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', url: '', isDefault: false })

  const fetchWebhooks = async () => {
    const data = await getWebhooks()
    setWebhooks(data)
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createWebhook(formData)
      toast.success('添加成功')
      setFormOpen(false)
      setFormData({ name: '', url: '', isDefault: false })
      fetchWebhooks()
    } catch {
      toast.error('添加失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 Webhook 吗？')) return
    try {
      await deleteWebhook(id)
      toast.success('删除成功')
      fetchWebhooks()
    } catch {
      toast.error('删除失败，可能有提醒正在使用')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">企业微信 Webhook</h2>
        <Button onClick={() => setFormOpen(true)}>添加 Webhook</Button>
      </div>

      <div className="grid gap-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardHeader className="py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  {webhook.name}
                  {webhook.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => handleDelete(webhook.id)}
                >
                  删除
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-0 pb-4">
              <code className="text-xs text-muted-foreground break-all">{webhook.url}</code>
            </CardContent>
          </Card>
        ))}
        {webhooks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无 Webhook，请先添加
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 Webhook</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  placeholder="如：产品群"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <Label htmlFor="isDefault">设为默认</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '添加中...' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
