import { Prisma } from '@prisma/client';

import { InvalidTrackTransitionError } from '../catalog.errors';
import { collectPublishPrerequisiteFailures, nextTrackStatus } from './track-lifecycle';

describe('nextTrackStatus', () => {
  it.each([
    ['DRAFT', 'ready', 'READY'],
    ['READY', 'publish', 'PUBLISHED'],
    ['PUBLISHED', 'unpublish', 'UNPUBLISHED'],
    ['DRAFT', 'archive', 'ARCHIVED'],
    ['READY', 'archive', 'ARCHIVED'],
    ['PUBLISHED', 'archive', 'ARCHIVED'],
    ['UNPUBLISHED', 'archive', 'ARCHIVED'],
  ] as const)('allows %s -> %s via %s', (from, action, to) => {
    expect(nextTrackStatus(from, action)).toBe(to);
  });

  it.each([
    ['DRAFT', 'publish'],
    ['DRAFT', 'unpublish'],
    ['READY', 'unpublish'],
    ['READY', 'ready'],
    ['PUBLISHED', 'ready'],
    ['PUBLISHED', 'publish'],
    ['UNPUBLISHED', 'publish'],
    ['UNPUBLISHED', 'ready'],
    ['UNPUBLISHED', 'unpublish'],
    ['ARCHIVED', 'ready'],
    ['ARCHIVED', 'publish'],
    ['ARCHIVED', 'unpublish'],
    ['ARCHIVED', 'archive'],
  ] as const)('rejects %s -> (%s)', (from, action) => {
    expect(() => nextTrackStatus(from, action)).toThrow(InvalidTrackTransitionError);
  });
});

describe('collectPublishPrerequisiteFailures', () => {
  const validInput = {
    title: 'A Real Title',
    flacFileUrl: 'https://cdn.example.com/track.flac',
    coverImageUrl: 'https://cdn.example.com/cover.jpg',
    type: 'FREE' as const,
    price: null,
    albumId: null,
    albumExists: false,
    artistIsActive: true,
    hasLyrics: true,
  };

  it('passes with no reasons when every prerequisite is met', () => {
    expect(collectPublishPrerequisiteFailures(validInput)).toEqual([]);
  });

  it('fails when the artist is not active', () => {
    const reasons = collectPublishPrerequisiteFailures({ ...validInput, artistIsActive: false });
    expect(reasons).toContain("the track's artist must be active");
  });

  it('fails when lyrics are missing', () => {
    const reasons = collectPublishPrerequisiteFailures({ ...validInput, hasLyrics: false });
    expect(reasons).toContain('lyrics are required before publishing');
  });

  it('fails when an albumId is set but the album cannot be found', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      albumId: 'album-1',
      albumExists: false,
    });
    expect(reasons).toContain('the associated album could not be found');
  });

  it('passes when albumId is set and the album exists', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      albumId: 'album-1',
      albumExists: true,
    });
    expect(reasons).toEqual([]);
  });

  it('fails a paid track with no price', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      type: 'PAID',
      price: null,
    });
    expect(reasons).toContain('a positive price is required for paid tracks');
  });

  it('fails a paid track with a zero or negative price', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      type: 'PAID',
      price: new Prisma.Decimal(0),
    });
    expect(reasons).toContain('a positive price is required for paid tracks');
  });

  it('passes a paid track with a positive price', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      type: 'PAID',
      price: new Prisma.Decimal('4.99'),
    });
    expect(reasons).toEqual([]);
  });

  it('collects every failing reason at once, not just the first', () => {
    const reasons = collectPublishPrerequisiteFailures({
      ...validInput,
      artistIsActive: false,
      hasLyrics: false,
      type: 'PAID',
      price: null,
    });
    expect(reasons).toHaveLength(3);
  });
});
