import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(), // public booking handle, e.g. "demo"
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  timeZone: text('time_zone').notNull().default('UTC'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Connected calendars (provider 'mock' in the infrastructure-only build)
export const connectedCalendars = pgTable('connected_calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['google', 'caldav', 'mock'] }).notNull(),
  externalAccountId: text('external_account_id'),
  readBusy: boolean('read_busy').notNull().default(true),
  writeTarget: boolean('write_target').notNull().default(false),
  readCalendarIds: jsonb('read_calendar_ids').$type<string[]>(),
  writeCalendarId: text('write_calendar_id'),
  encryptedCredentials: text('encrypted_credentials'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Event types
export const eventTypes = pgTable(
  'event_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    durationMin: integer('duration_min').notNull(),
    bufferBeforeMin: integer('buffer_before_min').notNull().default(0),
    bufferAfterMin: integer('buffer_after_min').notNull().default(0),
    minNoticeMin: integer('min_notice_min').notNull().default(0),
    slotIntervalMin: integer('slot_interval_min').notNull().default(30),
    rangeDays: integer('range_days').notNull().default(30),
    location: text('location'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('uniq_user_slug').on(t.userId, t.slug)]
);

// Weekly availability
export const weeklyAvailability = pgTable('weekly_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 0-6 (Sun-Sat)
  startTime: text('start_time').notNull(), // "HH:mm"
  endTime: text('end_time').notNull(), // "HH:mm"
});

// Date overrides
export const dateOverrides = pgTable(
  'date_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // "YYYY-MM-DD"
    intervals: jsonb('intervals')
      .$type<Array<{ startTime: string; endTime: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [uniqueIndex('uniq_user_date').on(t.userId, t.date)]
);

// Bookings
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventTypeId: uuid('event_type_id')
      .notNull()
      .references(() => eventTypes.id),
    startUtc: timestamp('start_utc', { withTimezone: true }).notNull(),
    endUtc: timestamp('end_utc', { withTimezone: true }).notNull(),
    attendeeName: text('attendee_name').notNull(),
    attendeeEmail: text('attendee_email').notNull(),
    attendeeTimezone: text('attendee_timezone').notNull(),
    status: text('status', {
      enum: ['pending', 'confirmed', 'cancelled', 'failed'],
    })
      .notNull()
      .default('pending'),
    externalEventId: text('external_event_id'),
    calendarId: uuid('calendar_id').references(() => connectedCalendars.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Hard double-booking guard: only active bookings reserve a slot.
    uniqueIndex('uniq_active_slot')
      .on(t.calendarId, t.startUtc)
      .where(sql`status in ('pending','confirmed')`),
    index('idx_bookings_event_type').on(t.eventTypeId),
  ]
);

export type User = typeof users.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type WeeklyAvailability = typeof weeklyAvailability.$inferSelect;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type ConnectedCalendar = typeof connectedCalendars.$inferSelect;
