import { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://www.balijournal.com' // Replace with your actual domain

    // 1. Static Routes
    const staticRoutes = [
        '',
        '/about',
        '/contact',
        '/login',
        '/register',
        '/submit-report',
        '/transparency',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }))

    // 2. Dynamic Articles
    const articles = await db.article.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true }
    })

    const articleRoutes = articles.map((article) => ({
        url: `${baseUrl}/article/${article.slug}`,
        lastModified: article.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    // 3. Category Routes
    const categories = ['tourism', 'investment', 'incidents', 'local', 'jobs', 'opinion']
    const categoryRoutes = categories.map(cat => ({
        url: `${baseUrl}/category/${cat}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.9,
    }))

    return [...staticRoutes, ...categoryRoutes, ...articleRoutes]
}
