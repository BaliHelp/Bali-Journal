import { redirect } from 'next/navigation'

// Advertiser sign-up no longer has its own separate page/flow - placing an
// order on /ads handles account creation (or attaching an Advertiser
// profile to an existing session) inline. This route stays only so old
// links/bookmarks don't 404.
export default function AdvertiserRegisterRedirect() {
  redirect('/ads')
}
