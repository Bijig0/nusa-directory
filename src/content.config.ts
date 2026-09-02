import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** Entry ids are `<locale>/<slug>` (from the folder + file name); the same slug exists in both locales. */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
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
    updated: z.coerce.date(),
  }),
});

export const collections = { blog, pages };
