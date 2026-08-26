import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
})

export const advertiserRegisterSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  companyName: z.string().min(2, 'Nama perusahaan minimal 2 karakter').max(200),
  phone: z.string().min(8, 'Nomor telepon minimal 8 digit').max(20),
})

export const articleSchema = z.object({
  title: z.string().min(10, 'Judul minimal 10 karakter').max(200, 'Judul maksimal 200 karakter'),
  excerpt: z.string().min(50, 'Ringkasan minimal 50 karakter').max(300, 'Ringkasan maksimal 300 karakter'),
  content: z.string().min(200, 'Konten minimal 200 karakter'),
  category: z.enum(['TOURISM', 'INVESTMENT', 'INCIDENTS', 'LOCAL', 'JOBS', 'OPINION']),
  featuredImageUrl: z.string().url('URL gambar tidak valid').optional().nullable(),
  featuredImageAlt: z.string().min(10, 'Alt text minimal 10 karakter').optional().nullable(),
  imageSource: z.string().min(5, 'Sumber gambar harus diisi').optional().nullable(),
})

export const commentSchema = z.object({
  content: z.string().min(10, 'Komentar minimal 10 karakter').max(1000, 'Komentar maksimal 1000 karakter'),
  articleId: z.string().uuid('ID artikel tidak valid'),
  parentId: z.string().uuid('ID parent tidak valid').optional(),
})

export const evidenceSchema = z.object({
  fileUrl: z.string().url('URL file tidak valid'),
  type: z.enum(['document', 'image', 'video', 'audio']),
  source: z.string().min(3, 'Sumber harus diisi'),
  description: z.string().max(500, 'Deskripsi maksimal 500 karakter').optional(),
})

export const subscriberSchema = z.object({
  email: z.string().email('Email tidak valid'),
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AdvertiserRegisterInput = z.infer<typeof advertiserRegisterSchema>
export type ArticleInput = z.infer<typeof articleSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type EvidenceInput = z.infer<typeof evidenceSchema>
export type SubscriberInput = z.infer<typeof subscriberSchema>
