# Handoff: Jurnal Kotabunan (fork dari Bali Journal)

> **Untuk siapa file ini:** dokumen ini ditulis supaya sesi Claude/AI BARU yang
> mengerjakan repo `JurnalKotabunan` bisa langsung paham konteksnya tanpa
> perlu didiagnosis ulang dari nol. Taruh file ini di root repo
> `JurnalKotabunan` (idealnya sebagai `CLAUDE.md` di sana, atau ditempel
> langsung sebagai pesan pertama di chat baru).
>
> Ditulis: 2026-09-02, dari repo `Bali-Journal` (github.com/BaliHelp/Bali-Journal)
> di commit `6a280fc` (branch `main`).

## 1. Apa proyek ini

**Jurnal Kotabunan** adalah situs berita baru dengan brand berbeda dari
**Bali Journal** (github.com/BaliHelp/Bali-Journal, live di
www.balijournal.com), tapi berbagi codebase yang sama persis (di-fork dari
repo Bali Journal apa adanya).

- Domain utama brand: **kotabunan.com** — akan punya BEBERAPA subdomain
  untuk layanan berbeda.
- Domain khusus untuk situs berita (repo ini): **jurnal.kotabunan.com**
  (BUKAN kotabunan.com telanjang — itu penting, jangan disamakan).
- Repo: `github.com/damnbayu-droid/JurnalKotabunan.git`
- Database: Supabase **akun yang sama** dengan Bali Journal, tapi **branch
  project yang berbeda** (jadi connection string/API key TETAP harus
  didapat baru, bukan reuse dari Bali Journal).
- Tujuan eksplisit dari pemilik proyek: **API/backend Kotabunan harus
  berbeda dari Bali Journal** — bukan cuma domain yang beda. Jangan
  copy-paste key/token dari Bali Journal ke sini kecuali memang sengaja
  mau dishare.

## 2. Apa yang SUDAH beres di codebase ini (jangan didiagnosis ulang)

Codebase yang di-fork sudah melalui banyak perbaikan. Kalau menemukan
gejala di bawah, itu SUDAH ditangani di kode — periksa dulu sebelum
menganggapnya bug baru:

- **Prisma pool timeout**: `DATABASE_URL` WAJIB pakai
  `connection_limit=1&pool_timeout=60` (tier Supabase pooled project ini
  cuma sanggup 1 koneksi; default 10s timeout gagal saat `next build`
  karena static generation query DB dari banyak halaman sekaligus).
- **Image storage**: Supabase Storage (bucket `article-images`, public)
  sebagai penyimpanan utama, Vercel Blob sebagai fallback otomatis kalau
  Supabase gagal. Disk lokal TIDAK dipakai lagi (dulu pernah, gagal di
  Vercel karena filesystem read-only/ephemeral).
- **RLS Supabase**: RLS aktif di semua tabel, tanpa policy permissive
  (`USING (true)`) — app ini tidak pernah pakai PostgREST/supabase-js,
  semua akses lewat Prisma dengan role `postgres` (bypass RLS by design
  sebagai table owner), jadi RLS ketat ini aman dan tidak akan mematahkan
  apa pun.
- **Next.js route params**: di banyak route dinamis, `params` adalah
  `Promise<{...}>` (bukan objek langsung) — kalau bikin route baru, ikuti
  pola `await params` yang sudah ada di route lain, jangan destructure
  langsung.
- **Anti-fabrikasi kutipan AI**: `src/lib/ai/journalism-style.ts` punya
  aturan eksplisit larangan AI mengarang kutipan yang diatribusikan ke
  tokoh publik sungguhan — pernah kejadian nyata, sudah dipagari.
- **AI provider rotation**: generate artikel pakai beberapa "shift"
  provider (MyAI OS gateway sebagai utama, OpenRouter/Groq sebagai
  overflow, Gemini langsung untuk gambar + NSFW check) supaya rate limit
  satu provider tidak memblokir seluruh pipeline. Field `MYAI_FIELDS.WIE`
  di MyAI OS pernah ketahuan rusak/di-hijack — beberapa titik pemanggilan
  sudah dipindah ke field `'chatbot'` + model `gpt-4o-mini` sebagai
  pengganti yang terbukti aman (masih ada 1 titik, `news-generator.ts`,
  yang belum ikut diperbaiki per rencana yang sedang berjalan — cek
  `git log` untuk status terbaru).
- **IndexNow**: key dibaca dari `process.env.INDEXNOW_KEY` (BUKAN
  hardcoded lagi — baru diperbaiki, lihat §4 karena ini butuh key baru
  untuk Kotabunan juga).
- **Admin Dashboard**: sudah ada panel Schedule (auto-generate terjadwal),
  Trash (soft-delete artikel), Metrics, Email (balas Contact Form lewat
  Resend), dan AI Agent Memory (pgvector, dipakai proses legal-risk).
- **Newsletter**: form subscribe di Footer benar-benar terhubung ke flow
  nyata (welcome email + digest email saat artikel baru terbit via
  Resend) — bukan dekorasi.
- **Breaking News & Popular Carousel**: breaking news bar menampilkan
  judul artikel 7 hari terakhir yang bisa diklik; carousel Popular News di
  landing page auto-scroll pelan & swipeable (perhatikan: JANGAN
  tambahkan `scroll-smooth`/`scroll-snap-type` di CSS-nya lagi — itu
  pernah bentrok dengan animasi `scrollLeft` berbasis rAF dan sudah
  sengaja dihapus).
- **Legal-risk scoring**: sempat ada bug `riskScore`/`categories` selalu
  0 untuk artikel lama (sudah diperbaiki 31 Agustus 2026) — jangan percaya
  data risk artikel yang dibuat SEBELUM tanggal itu tanpa verifikasi ulang.

## 3. Checklist WAJIB diganti untuk Kotabunan (jangan skip satupun)

Semua ini nilainya SEKARANG masih milik Bali Journal (literal, hardcoded,
atau environment lama) dan harus diganti sebelum go-live:

### a. Identitas brand di kode
- [ ] `src/lib/site-config.ts` — `SITE_NAME`, `SITE_URL`
      (`https://jurnal.kotabunan.com`), `SITE_DOMAIN`
      (`jurnal.kotabunan.com`), `COMPANY_NAME`, `COMPANY_SHORT_NAME`.
- [ ] `src/app/layout.tsx` — **banyak string brand di-hardcode langsung**,
      TIDAK otomatis ikut `site-config.ts`: `metadataBase` URL, title
      default + template, `keywords` array, `authors`/`creator`/
      `publisher`, Open Graph `title`/`url`/`siteName`/`alt`, Twitter
      `title`/`creator` handle. Semua perlu diganti manual satu-satu.
- [ ] `src/components/seo/article-json-ld.tsx` — nama organisasi (komentar
      soal "division of PT Indonesia Oncharge"), link social
      (`facebook.com/balijournal`, dst.) hardcoded.
- [ ] `src/components/layout/footer.tsx` — teks brand "Bali **Journal**"
      di-hardcode langsung di JSX (bukan pakai `SITE_NAME`), DAN alamat
      `mailto:info@balijournal.com` juga hardcoded di bagian bawah field
      Newsletter. Ganti keduanya.
- [ ] `src/app/manifest.ts` (PWA manifest, route dinamis Next.js — bukan
      file `public/manifest.json` statis) — cek `name`/`short_name`/
      `description` ikut `SITE_NAME` atau tidak, sesuaikan.
- [ ] Asset visual di `public/`: `Logo.webp`, `favicon.ico` +
      `favicon-16x16.png`/`favicon-32x32.png`/`favicon-48x48.png`,
      `apple-touch-icon.png`, `icon-192.png`/`icon-512.png`, `og-image.jpg`
      — semua ini logo quill maroon milik Bali Journal, ganti total ke
      brand Kotabunan.

### b. Environment (`.env`) — mulai dari `.env.example` yang sudah dirapikan
- [ ] `DATABASE_URL`/`DIRECT_URL` — connection string dari **branch
      project Supabase Kotabunan**, BUKAN project Bali Journal (walau
      1 akun sama). Tetap pertahankan `connection_limit=1&pool_timeout=60`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/
      `SUPABASE_SERVICE_ROLE_KEY` — dari branch project Kotabunan, lalu
      bikin bucket `article-images` (public) di situ juga, sama seperti
      Bali Journal.
- [ ] `BLOB_READ_WRITE_TOKEN` — buat Blob store baru di Vercel project
      Kotabunan (bukan reuse dari project Bali Journal).
- [ ] `CRON_SECRET` — random string baru (`openssl rand -hex 32`).
- [ ] `QSTASH_URL`/`QSTASH_TOKEN` — akun/token Upstash QStash baru. Kalau
      reuse token dari Bali Journal, delayed callback `auto-check-fatality`
      akan salah kirim ke domain yang salah (lihat catatan SITE-SPECIFIC di
      `.env.example`).
- [ ] `INDEXNOW_KEY` — key BARU dari Bing Webmaster Tools untuk
      `jurnal.kotabunan.com` (bukan pakai punya `balijournal.com`), lalu
      buat file `public/<key-baru>.txt` isinya key itu sendiri (hapus file
      `.txt` lama milik Bali Journal kalau ikut ter-copy).
- [ ] `RESEND_API_KEY` — verifikasi domain `jurnal.kotabunan.com` (atau
      `kotabunan.com`) di https://resend.com/domains dulu, baru buat key.
      Update `RESEND_FROM_NAME` dan `RESEND_FROM_EMAIL` juga (jangan
      biarkan "Bali Journal"/`contact@balijournal.com` — itu akan
      mengaku-aku sebagai situs yang bukan didirikan).
- [ ] `MYAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`,
      `GEMINI_API_KEY`/`GEMINI_API_KEY1-5`, `UNSPLASH_ACCESS_KEY` — sesuai
      permintaan eksplisit pemilik proyek ("pastikan penggunaan API dll
      berbeda dengan Bali Journal"), buat akun/key TERPISAH untuk semuanya,
      jangan reuse walau secara teknis bisa.
- [ ] `NEXTAUTH_SECRET`/`NEXTAUTH_URL` — dead config (tidak dipakai di
      manapun di `src/`, auth asli pakai sistem session token custom di
      `src/lib/auth/session.ts`), boleh isi asal-asalan asal tidak kosong.

### c. Infrastruktur
- [ ] Vercel project baru untuk Kotabunan (jangan pakai project Bali
      Journal yang sama, supaya domain/env terpisah bersih).
- [ ] `vercel.json` cron entries — pastikan tetap 4 job (daily-news,
      schedule-check, indexnow-submit, newsletter-notify) aktif di project
      baru (Vercel Cron perlu didaftarkan ulang per-project).
- [ ] Domain `jurnal.kotabunan.com` di-pointing ke project Vercel
      Kotabunan yang baru.

## 4. File referensi penting (untuk orientasi cepat)

- `src/lib/site-config.ts` — pusat identitas brand (tapi TIDAK lengkap,
  lihat §3a untuk tempat lain yang perlu diganti manual).
- `.env.example` (baru dirapikan 2026-09-02) — setiap variabel sudah
  dikomentari lengkap alasan/fungsi/cara dapatnya, dan baris yang ditandai
  **SITE-SPECIFIC** artinya wajib diganti, bukan sekadar "sebaiknya".
- `src/lib/ai/journalism-style.ts` — aturan gaya penulisan + larangan
  fabrikasi kutipan.
- `src/lib/images/image-service.ts` — logic generate & simpan gambar
  artikel (rotasi generator, fallback storage).
- `prisma/schema.prisma` — schema DB lengkap (Article punya status
  `TRASHED`, field risk-scoring, `likeCount`/`shareCount`, dll — semua
  sudah dipakai nyata, bukan kolom mati).

## 5. Yang TIDAK perlu dikerjakan ulang

- Riset/desain fitur (Admin Dashboard panel-panel di atas, Newsletter,
  Breaking News, dst.) — semua sudah didesain dan diimplementasi penuh di
  Bali Journal, tinggal rebranding + env config seperti checklist di atas.
  Kalau ada permintaan fitur baru dari pemilik proyek untuk Kotabunan yang
  BEDA dari Bali Journal, itu murni pekerjaan baru — bukan bagian dari
  daftar di sini.
