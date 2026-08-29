import type { AdPositionValue } from '@/components/ads/ad-slot'

/**
 * Every position a slot can render at, with a human label + suggested
 * IAB-ish size - shared by the admin Ad Slot form (src/app/admin/page.tsx)
 * and the public rate-card page (src/app/ads/page.tsx) so the labels stay
 * in sync in exactly one place.
 */
export const AD_POSITIONS: { value: AdPositionValue; label: string; width: number; height: number }[] = [
  // HEADER intentionally omitted - the banner slot below the nav was
  // removed from every page (see layout.tsx), so it's no longer offered
  // for sale here. The one pre-existing HEADER AdSlot row was left in the
  // database (harmless, unused) but had its pricePerDay cleared so it
  // no longer appears on /ads or the advertiser self-service slot list.
  { value: 'HOME_HERO_LEFT', label: 'Beranda - Rail Kiri Hero', width: 160, height: 600 },
  { value: 'HOME_HERO_MINI', label: 'Beranda - Mini Box (bawah rail kiri)', width: 160, height: 160 },
  { value: 'HOME_HERO_BELOW', label: 'Beranda - Banner Bawah Hero', width: 800, height: 150 },
  { value: 'ARTICLE_LEFT', label: 'Artikel - Rail Kiri', width: 160, height: 600 },
  { value: 'ARTICLE_LEFT_BOTTOM', label: 'Artikel - Rail Kiri Bawah', width: 160, height: 300 },
  { value: 'ARTICLE_RIGHT_TOP', label: 'Artikel - Rail Kanan Atas', width: 300, height: 250 },
  { value: 'ARTICLE_RIGHT_BOTTOM', label: 'Artikel - Rail Kanan Bawah', width: 300, height: 600 },
  { value: 'IN_ARTICLE', label: 'Dalam Artikel (antar paragraf)', width: 336, height: 280 },
  { value: 'MOBILE_BANNER', label: 'Mobile Banner', width: 320, height: 50 },
  { value: 'FOOTER', label: 'Footer (bawah halaman)', width: 728, height: 90 },
]

export function adPositionLabel(position: string): string {
  return AD_POSITIONS.find((p) => p.value === position)?.label ?? position
}
