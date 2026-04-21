import { Suspense } from 'react'
import { getDevices } from '@/actions/devices'
import { DevicesPageContent } from '@/components/devices/devices-page-content'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

async function DeviceListContainer() {
  const devices = await getDevices()
  return <DevicesPageContent initialDevices={devices || []} />
}

function DeviceListSkeleton() {
  return (
    <div className="page-grid animate-in-premium-delay-1">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card h-[220px]">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function DevicesPage() {
  return (
    <div>
      <Suspense fallback={<DeviceListSkeleton />}>
        <DeviceListContainer />
      </Suspense>
    </div>
  )
}
