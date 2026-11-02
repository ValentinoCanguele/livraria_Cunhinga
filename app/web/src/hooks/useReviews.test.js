import { describe, expect, it } from 'vitest';
import { mergeReviewHelpfulness } from '@/hooks/useReviews';

describe('mergeReviewHelpfulness', () => {
  it('associa contagem pública e voto do utilizador à avaliação certa', () => {
    const reviews = [{ id: 'review-1' }, { id: 'review-2' }];
    const votes = [
      { review_id: 'review-1', helpful_count: '4', user_voted: true },
      { review_id: 'review-2', helpful_count: 0, user_voted: false },
    ];

    expect(mergeReviewHelpfulness(reviews, votes)).toEqual([
      { id: 'review-1', helpfulCount: 4, hasHelpfulVote: true },
      { id: 'review-2', helpfulCount: 0, hasHelpfulVote: false },
    ]);
  });

  it('usa valores seguros quando a lista de contagens está vazia', () => {
    expect(mergeReviewHelpfulness([{ id: 'review-1' }], [])).toEqual([
      { id: 'review-1', helpfulCount: 0, hasHelpfulVote: false },
    ]);
  });
});