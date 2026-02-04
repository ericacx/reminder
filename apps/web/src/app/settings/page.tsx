import { WebhookList } from '@/components/webhook-list'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>
      <WebhookList />
    </div>
  )
}
