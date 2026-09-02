import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    locale: z.enum(['id', 'en']),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    city: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    locale: z.enum(['id', 'en']),
    updated: z.coerce.date(),
  }),
});

export const collections = { blog, pages };
