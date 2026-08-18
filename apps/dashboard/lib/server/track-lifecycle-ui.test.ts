import assert from 'node:assert/strict';
import { test } from 'node:test';

import { availableTrackActions, trackActionLabel } from './track-lifecycle-ui.ts';

void test('DRAFT allows ready and archive only', () => {
  assert.deepEqual(availableTrackActions('DRAFT'), ['ready', 'archive']);
});

void test('READY allows publish and archive only', () => {
  assert.deepEqual(availableTrackActions('READY'), ['publish', 'archive']);
});

void test('PUBLISHED allows unpublish and archive only', () => {
  assert.deepEqual(availableTrackActions('PUBLISHED'), ['unpublish', 'archive']);
});

void test('UNPUBLISHED allows archive only — no re-publish shortcut', () => {
  assert.deepEqual(availableTrackActions('UNPUBLISHED'), ['archive']);
});

void test('ARCHIVED is terminal — no actions available', () => {
  assert.deepEqual(availableTrackActions('ARCHIVED'), []);
});

void test('trackActionLabel has a human label for every lifecycle action', () => {
  assert.equal(trackActionLabel('ready'), 'Mark ready');
  assert.equal(trackActionLabel('publish'), 'Publish');
  assert.equal(trackActionLabel('unpublish'), 'Unpublish');
  assert.equal(trackActionLabel('archive'), 'Archive');
});
