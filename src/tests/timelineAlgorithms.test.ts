import { describe, expect, it } from 'vitest';
import {
  IntervalTree,
  CspScheduler,
  OTEngine,
  type OTOperation,
  type ScheduledEvent,
} from '@/lib/timelineAlgorithms';

describe('IntervalTree', () => {
  it('returns overlaps for a query window', () => {
    const tree = new IntervalTree();
    tree.insert({ id: 'a', start: 540, end: 600, durationMinutes: 60 }); // 09:00-10:00
    tree.insert({ id: 'b', start: 615, end: 675, durationMinutes: 60 }); // 10:15-11:15
    tree.insert({ id: 'c', start: 690, end: 750, durationMinutes: 60 }); // 11:30-12:30

    const overlaps = tree.queryOverlap(585, 645); // 09:45-10:45
    expect(overlaps.map((iv) => iv.id).sort()).toEqual(['a', 'b']);
  });

  it('removes an interval by id regardless of lexical id order', () => {
    const tree = new IntervalTree();
    tree.insert({ id: 'z-last', start: 540, end: 600, durationMinutes: 60 });
    tree.insert({ id: 'a-first', start: 610, end: 650, durationMinutes: 40 });
    tree.insert({ id: 'm-middle', start: 660, end: 700, durationMinutes: 40 });

    tree.remove('a-first');

    const overlaps = tree.queryOverlap(605, 655);
    expect(overlaps).toHaveLength(0);
    expect(tree.has('a-first')).toBe(false);
    expect(tree.has('z-last')).toBe(true);
    expect(tree.has('m-middle')).toBe(true);
  });
});

describe('CspScheduler', () => {
  it('reflows to satisfy travel buffer', () => {
    const scheduler = new CspScheduler([{ type: 'travel-buffer', bufferMinutes: 15 }]);

    const existing: ScheduledEvent[] = [
      { id: 'e1', start: 540, end: 600, durationMinutes: 60, tags: [] },
      { id: 'e2', start: 620, end: 680, durationMinutes: 60, tags: [] },
    ];

    const incoming: ScheduledEvent = {
      id: 'new',
      start: 590,
      end: 650,
      durationMinutes: 60,
      tags: [],
    };

    const result = scheduler.schedule(existing, incoming);
    expect(result.ok).toBe(true);
    expect(result.events.map((e) => ({ id: e.id, start: e.start, end: e.end }))).toEqual([
      { id: 'e1', start: 540, end: 600 },
      { id: 'new', start: 615, end: 675 },
      { id: 'e2', start: 690, end: 750 },
    ]);
  });

  it('uses bounded backtracking to find a later golden-hour slot', () => {
    const scheduler = new CspScheduler([
      {
        type: 'golden-hour',
        windowMinutes: 30,
        sunriseMinute: 360,
        sunsetMinute: 1080,
      },
    ]);

    const result = scheduler.schedule([], {
      id: 'photo',
      start: 720,
      end: 780,
      durationMinutes: 60,
      tags: ['photography'],
    });

    expect(result.ok).toBe(true);
    expect(result.events.find((e) => e.id === 'photo')?.start).toBe(1050);
    expect(result.reason).toContain('Reflowed after');
  });

  it('fails when bounded backtracking limit is too small', () => {
    const scheduler = new CspScheduler(
      [
        {
          type: 'golden-hour',
          windowMinutes: 30,
          sunriseMinute: 360,
          sunsetMinute: 1080,
        },
      ],
      { maxBacktrackingAttempts: 5 },
    );

    const result = scheduler.schedule([], {
      id: 'photo',
      start: 720,
      end: 780,
      durationMinutes: 60,
      tags: ['photography'],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('golden hour');
  });

  it('returns a warning when outdoor event overlaps rain slot', () => {
    const scheduler = new CspScheduler([
      {
        type: 'outdoor-no-rain',
        rainSlots: [600],
      },
    ]);

    const result = scheduler.schedule([], {
      id: 'hike',
      start: 590,
      end: 650,
      durationMinutes: 60,
      tags: ['outdoor'],
    });

    expect(result.ok).toBe(true);
    expect(result.reason).toContain('rain-forecasted slot');
  });
});

describe('OTEngine', () => {
  it('bumps insert time when concurrent insert targets same slot', () => {
    const ot = new OTEngine();

    const base: OTOperation = {
      type: 'insert',
      eventId: 'e1',
      timestamp: 100,
      day: '2026-04-21',
      startTime: '09:00',
      durationMinutes: 60,
    };

    const transformed = ot.apply(base, [
      {
        type: 'insert',
        eventId: 'e2',
        timestamp: 110,
        day: '2026-04-21',
        startTime: '09:00',
        durationMinutes: 60,
      },
    ]);

    expect(transformed.startTime).toBe('09:01');
  });

  it('turns move into delete when concurrent delete hits same event', () => {
    const ot = new OTEngine();

    const transformed = ot.apply(
      {
        type: 'move',
        eventId: 'e1',
        timestamp: 100,
        day: '2026-04-21',
        startTime: '10:00',
      },
      [{ type: 'delete', eventId: 'e1', timestamp: 120 }],
    );

    expect(transformed.type).toBe('delete');
  });
});
