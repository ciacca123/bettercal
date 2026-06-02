import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarAggregator } from './aggregator';
import { CalendarProvider, ConnectedCalendar, TimeInterval } from '../availability/types';

describe('CalendarAggregator', () => {
  let aggregator: CalendarAggregator;
  let mockProvider1: any;
  let mockProvider2: any;

  beforeEach(() => {
    mockProvider1 = {
      getBusy: vi.fn(),
      createEvent: vi.fn(),
    };

    mockProvider2 = {
      getBusy: vi.fn(),
      createEvent: vi.fn(),
    };

    const calendars: ConnectedCalendar[] = [
      {
        name: 'Calendar 1',
        provider: mockProvider1,
        readBusy: true,
        writeTarget: false,
      },
      {
        name: 'Calendar 2',
        provider: mockProvider2,
        readBusy: true,
        writeTarget: true,
      },
    ];

    aggregator = new CalendarAggregator(calendars);
  });

  describe('getBusyAll', () => {
    it('queries all readBusy calendars in parallel', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      mockProvider1.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:00:00Z' },
      ]);

      mockProvider2.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T14:00:00Z', end: '2024-01-01T15:00:00Z' },
      ]);

      const result = await aggregator.getBusyAll(range);

      expect(result.success).toBe(true);
      expect(result.busy).toHaveLength(2);
      expect(mockProvider1.getBusy).toHaveBeenCalledWith(range);
      expect(mockProvider2.getBusy).toHaveBeenCalledWith(range);
    });

    it('merges overlapping intervals', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      mockProvider1.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:30:00Z' },
      ]);

      mockProvider2.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z' },
      ]);

      const result = await aggregator.getBusyAll(range);

      expect(result.busy).toHaveLength(1);
      expect(result.busy[0]).toEqual({
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T11:00:00Z',
      });
    });

    it('continues on provider failure and returns partial results', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      mockProvider1.getBusy.mockRejectedValueOnce(new Error('Network error'));

      mockProvider2.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T14:00:00Z', end: '2024-01-01T15:00:00Z' },
      ]);

      const result = await aggregator.getBusyAll(range);

      expect(result.success).toBe(false);
      expect(result.busy).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures![0].calendar).toBe('Calendar 1');
    });

    it('returns empty busy list when all providers fail', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      mockProvider1.getBusy.mockRejectedValueOnce(new Error('Error 1'));
      mockProvider2.getBusy.mockRejectedValueOnce(new Error('Error 2'));

      const result = await aggregator.getBusyAll(range);

      expect(result.success).toBe(false);
      expect(result.busy).toHaveLength(0);
      expect(result.failures).toHaveLength(2);
    });
  });

  describe('getBusy', () => {
    it('returns merged busy list from getBusyAll', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      mockProvider1.getBusy.mockResolvedValueOnce([
        { start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:00:00Z' },
      ]);

      mockProvider2.getBusy.mockResolvedValueOnce([]);

      const result = await aggregator.getBusy(range);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T10:00:00Z',
      });
    });
  });

  describe('createEvent', () => {
    it('routes to write-target provider', async () => {
      const input = {
        startUtc: '2024-01-15T09:00:00Z',
        endUtc: '2024-01-15T10:00:00Z',
        title: 'Test Event',
        description: 'Test',
        attendee: { name: 'John', email: 'john@example.com' },
        idempotencyKey: 'key-123',
      };

      mockProvider2.createEvent.mockResolvedValueOnce({ externalId: 'ext-123' });

      const result = await aggregator.createEvent(input);

      expect(result.externalId).toBe('ext-123');
      expect(mockProvider2.createEvent).toHaveBeenCalledWith(input);
      expect(mockProvider1.createEvent).not.toHaveBeenCalled();
    });

    it('throws if no write-target configured', async () => {
      const noWriteAggregator = new CalendarAggregator([
        {
          name: 'Read-only',
          provider: mockProvider1,
          readBusy: true,
          writeTarget: false,
        },
      ]);

      const input = {
        startUtc: '2024-01-15T09:00:00Z',
        endUtc: '2024-01-15T10:00:00Z',
        title: 'Test Event',
        description: 'Test',
        attendee: { name: 'John', email: 'john@example.com' },
        idempotencyKey: 'key-123',
      };

      await expect(noWriteAggregator.createEvent(input)).rejects.toThrow(
        'No write-target calendar configured'
      );
    });
  });
});
