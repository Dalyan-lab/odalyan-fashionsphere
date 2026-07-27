import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export interface ReviewDto {
  id: string;
  rating: number;
  comment?: string | null;
  author: string;
  createdAt: string;
  mine?: boolean;
}

export interface ProductReviewsDto {
  average: number; // moyenne des notes (0 si aucun avis)
  count: number;
  reviews: ReviewDto[];
}
