import { db } from '@/lib/db'

interface AdSlotProps {
  position: 'HEADER' | 'SIDEBAR' | 'IN_ARTICLE' | 'FOOTER' | 'MOBILE_BANNER'
  /** Which viewport this instance renders for - controls the responsive show/hide class (CSS-only, no layout shift/JS device detection). */
  device?: 'DESKTOP' | 'MOBILE' | 'BOTH'
  className?: string
}

const DEVICE_CLASS: Record<NonNullable<AdSlotProps['device']>, string> = {
  DESKTOP: 'hidden md:block',
  MOBILE: 'block md:hidden',
  BOTH: '',
}

/**
 * Server component - queries active ads directly (no extra round-trip via
 * the public /api/ads/active endpoint, that one exists for client-side
 * fetches if a page ever needs to refresh ads without a full reload).
 * Renders nothing if there's no active ad for this slot/device, so it never
 * leaves an empty gap.
 */
export async function AdSlot({ position, device = 'BOTH', className = '' }: AdSlotProps) {
  const now = new Date()
  const ads = await db.ad.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      slot: { position, ...(device !== 'BOTH' ? { device: { in: [device, 'BOTH'] } } : {}) },
    },
    include: { slot: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })

  const ad = ads[0]
  if (!ad) return null

  const media =
    ad.mediaType === 'VIDEO' ? (
      <video
        src={ad.mediaUrl}
        autoPlay
        muted
        loop
        playsInline
        width={ad.slot.width}
        height={ad.slot.height}
        className="max-w-full h-auto"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.mediaUrl}
        alt={ad.advertiserName}
        width={ad.slot.width}
        height={ad.slot.height}
        className="max-w-full h-auto"
      />
    )

  return (
    <div className={`${DEVICE_CLASS[device]} ${className} flex justify-center items-center overflow-hidden`}>
      <span className="sr-only">Iklan: {ad.advertiserName}</span>
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored">
          {media}
        </a>
      ) : (
        media
      )}
    </div>
  )
}
