import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Pure promo banner (no DB query) inviting anyone to advertise - sits right above the footer on every page. */
export function PlaceAdsCTA() {
  return (
    <section className="border-y bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-semibold">Ingin memasang iklan di Bali Journal?</p>
            <p className="text-sm text-muted-foreground">Jangkau pembaca Bali - daftar sebagai pengiklan, mulai dari harga terjangkau.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/advertiser/register">Place Ads</Link>
        </Button>
      </div>
    </section>
  )
}
