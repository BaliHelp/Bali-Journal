import { AdMedia, DEVICE_CLASS, getActiveAds, type AdDeviceValue, type AdPositionValue } from './ad-slot'
import { AdCarousel } from './ad-carousel'

interface RotatingAdSlotProps {
  position: AdPositionValue
  device?: AdDeviceValue
  className?: string
}

/**
 * Like AdSlot, but for positions that can carry more than one active ad at
 * once (e.g. HEADER) - shows a single ad statically when there's only one
 * (no timer overhead), or rotates through them every 4s via AdCarousel when
 * there are several. Renders nothing when the position has no active ad.
 */
export async function RotatingAdSlot({ position, device = 'BOTH', className = '' }: RotatingAdSlotProps) {
  const ads = await getActiveAds(position, device, 5)
  if (ads.length === 0) return null

  return (
    <div className={`${DEVICE_CLASS[device]} ${className} justify-center items-center overflow-hidden`}>
      {ads.length === 1 ? <AdMedia ad={ads[0]} /> : <AdCarousel ads={ads} />}
    </div>
  )
}
