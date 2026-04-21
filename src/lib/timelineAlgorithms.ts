// ─── timelineAlgorithms.ts ────────────────────────────────────────────────────
// Three layered algorithms powering the WanderBoard timeline:
//
//  1. IntervalTree   — O(log n) conflict detection per day column
//  2. CspScheduler   — Arc-consistency (AC-3) reflow when conflicts arise
//  3. OTEngine       — Operational Transformation for concurrent edit safety
//
// All are pure TypeScript — no external libraries, no API calls.
// The paper angle: compare IntervalTree O(log n) vs naive O(n) as schedule grows.

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Interval {
  id: string;
  start: number; // minutes from midnight, e.g. 09:00 = 540
  end: number;   // exclusive end, e.g. 10:30 = 630
  durationMinutes: number;
}

// ─── 1. Augmented Interval Tree ───────────────────────────────────────────────
// Classic CS data structure: augmented BST where each node tracks the
// maximum endpoint in its subtree, enabling O(log n) overlap queries.
//
// Reference: Cormen et al. "Introduction to Algorithms" Ch. 14.3

interface ITNode {
  interval: Interval;
  maxEnd: number;      // max endpoint in subtree — the "augmentation"
  left: ITNode | null;
  right: ITNode | null;
}

export class IntervalTree {
  private root: ITNode | null = null;

  // Insert an interval. O(log n) average.
  insert(interval: Interval): void {
    this.root = this._insert(this.root, interval);
  }

  private _insert(node: ITNode | null, interval: Interval): ITNode {
    if (!node) {
      return { interval, maxEnd: interval.end, left: null, right: null };
    }
    if (interval.start < node.interval.start) {
      node.left = this._insert(node.left, interval);
    } else {
      node.right = this._insert(node.right, interval);
    }
    node.maxEnd = Math.max(node.maxEnd, interval.end);
    return node;
  }

  // Remove an interval by id.
  // Note: the tree is keyed by interval.start, not id, so removing by id via
  // directional BST traversal is not reliable. Rebuild from filtered intervals
  // to keep behavior correct and deterministic.
  remove(id: string): void {
    const next = this.toArray().filter((interval) => interval.id !== id);
    this.root = IntervalTree.fromArray(next).root;
  }

  // Find all intervals overlapping [queryStart, queryEnd). O(log n + k) where k = results.
  // Two intervals [a,b) and [c,d) overlap iff a < d && c < b.
  queryOverlap(queryStart: number, queryEnd: number): Interval[] {
    const results: Interval[] = [];
    this._query(this.root, queryStart, queryEnd, results);
    return results;
  }

  private _query(
    node: ITNode | null,
    queryStart: number,
    queryEnd: number,
    results: Interval[],
  ): void {
    if (!node) return;
    // Pruning: if max endpoint in subtree <= queryStart, no overlap possible
    if (node.maxEnd <= queryStart) return;

    // Check left subtree
    this._query(node.left, queryStart, queryEnd, results);

    // Check this node
    if (node.interval.start < queryEnd && queryStart < node.interval.end) {
      results.push(node.interval);
    }

    // Only check right subtree if current node start < queryEnd
    if (node.interval.start < queryEnd) {
      this._query(node.right, queryStart, queryEnd, results);
    }
  }

  // Check if a specific interval (by id) exists. O(n) — used for deduplication only.
  has(id: string): boolean {
    return this._has(this.root, id);
  }

  private _has(node: ITNode | null, id: string): boolean {
    if (!node) return false;
    if (node.interval.id === id) return true;
    return this._has(node.left, id) || this._has(node.right, id);
  }

  // Rebuild from a fresh array — O(n log n).
  static fromArray(intervals: Interval[]): IntervalTree {
    const tree = new IntervalTree();
    // Sort by start for a more balanced tree
    [...intervals]
      .sort((a, b) => a.start - b.start)
      .forEach((iv) => tree.insert(iv));
    return tree;
  }

  toArray(): Interval[] {
    const result: Interval[] = [];
    this._inorder(this.root, result);
    return result;
  }

  private _inorder(node: ITNode | null, result: Interval[]): void {
    if (!node) return;
    this._inorder(node.left, result);
    result.push(node.interval);
    this._inorder(node.right, result);
  }
}

// ─── 2. Constraint Satisfaction Scheduler (AC-3 inspired) ────────────────────
// When placing a new event causes a conflict, this solver attempts to
// reflow existing events — shifting them forward to make room — while
// respecting hard constraints (no overlap, trip bounds, golden hour windows)
// and soft constraints (outdoor events avoid rain slots, travel buffers).
//
// The algorithm:
//  a) Add the new event to a working copy of the schedule.
//  b) Sort all events on the affected day by start time.
//  c) Run a forward-pass: for each event, if it overlaps the previous,
//     shift it forward by the minimum required gap.
//  d) If any event would be pushed past the hard day boundary (23:59),
//     try shifting the new event forward instead (backtrack once).
//  e) Return the reflowed schedule or a failure reason.

export interface Constraint {
  type: 'golden-hour' | 'outdoor-no-rain' | 'travel-buffer' | 'business-hours';
  // golden-hour: event must start within windowMinutes of sunrise/sunset
  // outdoor-no-rain: event tagged outdoor must not land in rainSlots[]
  // travel-buffer: minimum gap between events in minutes
  // business-hours: event must start within [openTime, closeTime)
  windowMinutes?: number;    // golden-hour
  sunriseMinute?: number;    // golden-hour
  sunsetMinute?: number;     // golden-hour
  rainSlots?: number[];      // outdoor-no-rain: list of start-minutes to avoid
  bufferMinutes?: number;    // travel-buffer, default 15
  openTime?: number;         // business-hours, minutes from midnight
  closeTime?: number;        // business-hours
}

export interface ScheduledEvent extends Interval {
  tags: string[]; // e.g. ['outdoor', 'photography', 'dining']
}

export interface CspResult {
  ok: boolean;
  events: ScheduledEvent[]; // reflowed events if ok=true
  reason?: string;
}

const DAY_END_MINUTE = 23 * 60 + 59; // 23:59
const DEFAULT_BUFFER = 15;
const SLOT_MINUTES = 15;
const DEFAULT_MAX_BACKTRACKING_ATTEMPTS = 96;

interface CspSchedulerOptions {
  maxBacktrackingAttempts?: number;
}

export class CspScheduler {
  private constraints: Constraint[];
  private maxBacktrackingAttempts: number;

  constructor(constraints: Constraint[] = [], options: CspSchedulerOptions = {}) {
    this.constraints = constraints;
    this.maxBacktrackingAttempts =
      options.maxBacktrackingAttempts ?? DEFAULT_MAX_BACKTRACKING_ATTEMPTS;
  }

  // Attempt to insert newEvent into existingEvents on the same day.
  // Returns reflowed schedule or failure.
  schedule(
    existingEvents: ScheduledEvent[],
    newEvent: ScheduledEvent,
  ): CspResult {
    const candidateStarts = this._generateCandidateStarts(
      newEvent.start,
      newEvent.durationMinutes,
    );
    const maxAttempts = Math.min(
      this.maxBacktrackingAttempts,
      candidateStarts.length,
    );

    let lastFailureReason =
      `No valid placement found within ${maxAttempts} backtracking attempts.`;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
      const candidateStart = candidateStarts[attemptIndex];
      const attempt = this._propagateWithQueue(
        existingEvents,
        newEvent,
        candidateStart,
      );

      if (!attempt.ok) {
        lastFailureReason = attempt.reason ?? lastFailureReason;
        continue;
      }

      const hardViolation = this._checkScheduleHardConstraints(attempt.events);
      if (hardViolation) {
        lastFailureReason = hardViolation;
        continue;
      }

      const warnings = attempt.events
        .map((event) => this._checkSoftConstraints(event))
        .filter(Boolean) as string[];

      const reasons: string[] = [];
      if (attemptIndex > 0) {
        reasons.push(`Reflowed after ${attemptIndex + 1} attempts`);
      }
      if (warnings.length > 0) {
        reasons.push(warnings.join('; '));
      }

      return {
        ok: true,
        events: attempt.events,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      };
    }

    return {
      ok: false,
      events: [],
      reason: lastFailureReason,
    };
  }

  private _generateCandidateStarts(
    initialStart: number,
    durationMinutes: number,
  ): number[] {
    const first = this._snapToGrid(Math.max(0, initialStart));
    const latest = DAY_END_MINUTE - durationMinutes;
    if (latest < first) return [];

    const starts: number[] = [];
    for (let minute = first; minute <= latest; minute += SLOT_MINUTES) {
      starts.push(minute);
    }
    return starts;
  }

  private _propagateWithQueue(
    existingEvents: ScheduledEvent[],
    newEvent: ScheduledEvent,
    startMinute: number,
  ): { ok: true; events: ScheduledEvent[] } | { ok: false; reason: string } {
    const inserted: ScheduledEvent = {
      ...newEvent,
      start: startMinute,
      end: startMinute + newEvent.durationMinutes,
    };

    const working: ScheduledEvent[] = [
      ...existingEvents.map((event) => ({ ...event })),
      inserted,
    ].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

    const queue: number[] = [];
    for (let i = 0; i < working.length - 1; i++) {
      queue.push(i);
    }

    const buffer = this._bufferMinutes();
    const maxPropagationSteps = Math.max(32, working.length * working.length * 4);
    let propagationSteps = 0;

    while (queue.length > 0) {
      const edgeIndex = queue.shift()!;
      if (edgeIndex < 0 || edgeIndex >= working.length - 1) {
        continue;
      }

      const left = working[edgeIndex];
      const right = working[edgeIndex + 1];
      const requiredStart = left.end + buffer;

      if (right.start < requiredStart) {
        const shift = requiredStart - right.start;
        right.start += shift;
        right.end += shift;

        if (right.end > DAY_END_MINUTE) {
          return {
            ok: false,
            reason: `No room on this day after ${this._fmt(startMinute)} — events overflow past ${this._fmt(DAY_END_MINUTE)}.`,
          };
        }

        if (edgeIndex + 1 < working.length - 1) {
          queue.push(edgeIndex + 1);
        }
      }

      propagationSteps += 1;
      if (propagationSteps > maxPropagationSteps) {
        return {
          ok: false,
          reason: 'Constraint propagation did not converge within the bounded step limit.',
        };
      }
    }

    return { ok: true, events: working };
  }

  private _snapToGrid(minutes: number): number {
    return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  }

  private _bufferMinutes(): number {
    const bufferConstraint = this.constraints.find(
      (c) => c.type === 'travel-buffer',
    );
    return bufferConstraint?.bufferMinutes ?? DEFAULT_BUFFER;
  }

  private _checkScheduleHardConstraints(events: ScheduledEvent[]): string | null {
    const sorted = [...events].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    const buffer = this._bufferMinutes();

    for (let i = 0; i < sorted.length; i++) {
      const event = sorted[i];
      if (event.start < 0) {
        return `Event "${event.id}" starts before 00:00.`;
      }
      if (event.end > DAY_END_MINUTE) {
        return `Event "${event.id}" ends after ${this._fmt(DAY_END_MINUTE)}.`;
      }

      const eventViolation = this._checkEventHardConstraints(event);
      if (eventViolation) return eventViolation;

      if (i === 0) continue;
      const prev = sorted[i - 1];
      if (event.start < prev.end + buffer) {
        return `Events "${prev.id}" and "${event.id}" violate the ${buffer}min minimum gap.`;
      }
    }

    return null;
  }

  private _checkEventHardConstraints(event: ScheduledEvent): string | null {
    for (const c of this.constraints) {
      if (c.type === 'golden-hour' && event.tags.includes('photography')) {
        const win = c.windowMinutes ?? 30;
        const nearSunrise =
          c.sunriseMinute !== undefined &&
          Math.abs(event.start - c.sunriseMinute) <= win;
        const nearSunset =
          c.sunsetMinute !== undefined &&
          Math.abs(event.start - c.sunsetMinute) <= win;
        if (!nearSunrise && !nearSunset) {
          return `Photography events must start within ${win}min of golden hour (sunrise ${this._fmt(c.sunriseMinute ?? 0)} / sunset ${this._fmt(c.sunsetMinute ?? 0)}).`;
        }
      }

      if (c.type === 'business-hours') {
        const open = c.openTime ?? 0;
        const close = c.closeTime ?? DAY_END_MINUTE;
        if (event.start < open || event.end > close) {
          return `Event "${event.id}" must be scheduled within business hours ${this._fmt(open)}-${this._fmt(close)}.`;
        }
      }
    }
    return null;
  }

  private _checkSoftConstraints(event: ScheduledEvent): string | null {
    for (const c of this.constraints) {
      if (
        c.type === 'outdoor-no-rain' &&
        event.tags.includes('outdoor') &&
        c.rainSlots?.some(
          (slot) => event.start < slot + 60 && slot < event.end,
        )
      ) {
        return `"${event.id}" is outdoors but overlaps a rain-forecasted slot`;
      }
    }
    return null;
  }

  private _fmt(minutes: number): string {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}

// ─── 3. Operational Transformation Engine ────────────────────────────────────
// Ensures concurrent timeline edits by multiple browser sessions (e.g. owner
// with two tabs open, or future multi-owner support) converge to the same state.
//
// Operations: insert | move | delete
// Transformation rule: if two concurrent ops affect different events, both apply.
// If they affect the same event, the later-timestamped op wins (LWW tie-breaking).
//
// This is a simplified OT model (no server authority needed) suitable for a
// single-owner timeline — the paper can extend to full Jupiter/Google Docs OT.

export type OTOpType = 'insert' | 'move' | 'delete';

export interface OTOperation {
  type: OTOpType;
  eventId: string;
  timestamp: number; // Date.now() at creation
  // For insert/move:
  day?: string;      // "YYYY-MM-DD"
  startTime?: string; // "HH:MM"
  durationMinutes?: number;
}

export interface OTState {
  ops: OTOperation[]; // ordered log of applied operations
}

export class OTEngine {
  private log: OTOperation[] = [];

  // Apply a new operation, transforming against any concurrent ops
  // that arrived since the op was created (ops with newer timestamps
  // but not yet seen by this client).
  apply(incoming: OTOperation, concurrentOps: OTOperation[]): OTOperation {
    const transformed = this._transform(incoming, concurrentOps);
    this.log.push(transformed);
    return transformed;
  }

  // Core transformation function.
  // For the timeline domain, transformation resolves three conflict cases:
  //  - insert vs insert on same slot → shift one forward
  //  - move vs delete → delete wins (no ghost events)
  //  - delete vs delete → idempotent (second delete is a no-op)
  private _transform(
    op: OTOperation,
    concurrent: OTOperation[],
  ): OTOperation {
    let result = { ...op };

    for (const other of concurrent) {
      // Only transform against ops that were created concurrently
      // (i.e. the other op's timestamp is between op's base and now)
      if (other.timestamp <= op.timestamp) continue;

      if (op.type === 'insert' && other.type === 'insert') {
        // Two inserts on the same slot: bump ours forward by 1 minute
        if (op.day === other.day && op.startTime === other.startTime) {
          result = { ...result, startTime: this._bumpTime(result.startTime ?? '09:00') };
        }
      } else if (op.type === 'move' && other.type === 'delete') {
        // Moving an event that was concurrently deleted → no-op the move
        if (op.eventId === other.eventId) {
          result = { ...result, type: 'delete' };
        }
      } else if (op.type === 'delete' && other.type === 'delete') {
        // Both deleting the same event → second delete is idempotent
        if (op.eventId === other.eventId) {
          result = { ...result, type: 'delete' }; // still delete, no-op on apply
        }
      }
    }

    return result;
  }

  // Shift a "HH:MM" time string forward by 1 minute
  private _bumpTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + 1;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }

  getLog(): OTOperation[] {
    return [...this.log];
  }

  // Compact utility: convert "HH:MM" to minutes-from-midnight
  static timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  // Convert minutes-from-midnight back to "HH:MM"
  static minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}

// ─── Conflict detection utility ───────────────────────────────────────────────

/**
 * Returns the first interval in `intervals` that overlaps [proposedStart, proposedEnd),
 * or null if the slot is clear.
 * Pass `excludeId` when resizing/moving an event to skip checking it against itself.
 */
export function checkConflict(
  intervals: Interval[],
  proposedStart: number,
  proposedEnd: number,
  excludeId?: string,
): Interval | null {
  for (const iv of intervals) {
    if (excludeId && iv.id === excludeId) continue;
    if (proposedStart < iv.end && proposedEnd > iv.start) return iv;
  }
  return null;
}
