import { z } from 'zod';
export const trackSchema = z.object({
    site: z.string().min(1).max(100),
    page: z.string().min(1).max(2048),
    title: z.string().max(512).optional(),
});
