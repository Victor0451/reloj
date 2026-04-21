import { SyncDashboard } from '@/components/devices/sync-dashboard'
import { RecentSyncErrors } from '@/components/devices/recent-sync-errors'

export default function SyncStatusPage() {
  return (
    <div className="space-y-8">
      <SyncDashboard />
      <RecentSyncErrors />
    </div>
  )
}
