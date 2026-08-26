import { db } from '@/lib/db'
import type { Ad, AdSlot as AdSlotModel } from '@prisma/client'

export type AdPositionValue =
  | 'HEADER'
  | 'SIDEBAR'
  | 'IN_ARTICLE'
  | 'FOOTER'
  | 'MOBILE_BANNER'
  | 'HOME_HERO_LEFT'
  | 'HOME_HERO_MINI'
  | 'HOME_HERO_BELOW'
  | 'ARTICLE_LEFT'
  | 'ARTICLE_RIGHT_TOP'
  | 'ARTICLE_RIGHT_BOTTOM'

export type AdDeviceValue = 'DESKTOP' | 'MOBILE' | 'BOTH'

export type AdWithSlot = Ad & { slot: AdSlotModel }

interface AdSlotProps {
  position: AdPositionValue
  /** Which viewport this instance renders for - controls the responsive show/hide class (CSS-only, no layout shift/JS device detection). */
  device?: AdDeviceValue
  className?: string
  /** Fill the parent container (object-cover) instead of rendering at the creative's own intrinsic size - for rails meant to match a sibling's height (e.g. the homepage hero side rail), not for fixed-format banners. */
  fill?: boolean
}

export const DEVICE_CLASS: Record<AdDeviceValue, string> = {
  DESKTOP: 'hidden md:flex',
  MOBILE: 'flex md:hidden',
  BOTH: 'flex',
}

/**
 * Shared query, used by the AdSlot component itself AND by pages that need
 * to know ahead of render whether a position has an active ad - e.g. the
 * homepage hero rail and the article side rails only reserve their grid
 * column when there's actually something to show in it, instead of leaving
 * a blank box (mirrors the DEVICE_CLASS split: DESKTOP/MOBILE must be
 * queried separately since a slot can have ads for one but not the other).
 */
export async function getActiveAd(position: AdPositionValue, device: AdDeviceValue = 'BOTH'): Promise<AdWithSlot | null> {
  const ads = await getActiveAds(position, device, 1)
  return ads[0] ?? null
}

/** Same query as getActiveAd but returns up to `limit` ads - used by RotatingAdSlot to decide whether a position needs a carousel. */
export async function getActiveAds(position: AdPositionValue, device: AdDeviceValue = 'BOTH', limit = 5): Promise<AdWithSlot[]> {
  const now = new Date()
  return db.ad.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      slot: { position, ...(device !== 'BOTH' ? { device: { in: [device, 'BOTH'] } } : {}) },
    },
    include: { slot: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Renders one ad's creative (image/video) wrapped in its click-through link, if any. Shared by AdSlot (single) and AdCarousel (rotating). */
export function AdMedia({ ad, fill = false }: { ad: AdWithSlot; fill?: boolean }) {
  const mediaClass = fill ? 'w-full h-full object-cover' : 'max-w-full h-auto'
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
        className={mediaClass}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.mediaUrl}
        alt={ad.advertiserName}
        width={ad.slot.width}
        height={ad.slot.height}
        className={mediaClass}
      />
    )

  return (
    <>
      <span className="sr-only">Iklan: {ad.advertiserName}</span>
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className={fill ? 'block w-full h-full' : undefined}>
          {media}
        </a>
      ) : (
        media
      )}
    </>
  )
}

/**
 * Server component - queries active ads directly (no extra round-trip via
 * the public /api/ads/active endpoint, that one exists for client-side
 * fetches if a page ever needs to refresh ads without a full reload).
 * Renders nothing if there's no active ad for this slot/device, so it never
 * leaves an empty gap.
 */
export async function AdSlot({ position, device = 'BOTH', className = '', fill = false }: AdSlotProps) {
  const ad = await getActiveAd(position, device)
  if (!ad) return null

  return (
    <div className={`${DEVICE_CLASS[device]} ${className} justify-center items-center overflow-hidden`}>
      <AdMedia ad={ad} fill={fill} />
    </div>
  )
}
