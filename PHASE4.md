# Project: lean scheduling app — Phase 4: UI/UX refinement & form wiring

## Prerequisite
Phases 1–3 are complete, tested, production-ready. All core logic, Server Actions, DB, OAuth,
booking guard and emails exist and work. This phase is presentation + wiring ONLY.
Do NOT change core logic, schema, the slot engine, the providers, or the booking guard.
Wire the UI to the EXISTING Server Actions; if an action's shape is awkward for the UI, adapt
the UI or add a thin read-only view helper — do not alter booking/availability behavior.

## Goal
Turn the working foundation into a polished, fast, accessible product with a clean, neutral,
Cal.com-inspired aesthetic. Refine the public booking flow (the hero) and the host dashboard,
and wire every form to its Server Action with proper validation, loading, error and success states.

## Milestone 4.1 — Design system (clean, neutral, border-driven)

### Token set (Tailwind config + CSS variables)
Build a small, cohesive design system with these principles:

#### Surfaces
- App background: `bg-neutral-50` (near-white, very subtle)
- Cards/surfaces: `bg-white` with `border border-neutral-200` (1px, no shadows)
- Subtle overlays/popovers: `shadow-sm` only (avoid heavy shadows)
- Dark mode: `dark:bg-neutral-950` / `dark:bg-neutral-900` surfaces with `dark:border-neutral-800`

#### Color palette
- **Primary text**: `text-neutral-900` (near-black, high contrast)
- **Secondary text**: `text-neutral-500` (muted, secondary information)
- **Accent**: `text-blue-600` for links and focus rings (single, restrained accent)
- **Success**: `text-green-600` for confirmations (subtle use)
- **Danger**: `text-red-600` for errors/destructive actions

#### Buttons
```
Primary (solid):
  bg-neutral-900 text-white hover:bg-neutral-800 focus:ring-2 ring-blue-400

Secondary (outlined):
  border border-neutral-300 text-neutral-900 hover:bg-neutral-50

Ghost:
  text-neutral-900 hover:bg-neutral-100
```

#### Radius & spacing
- **Radius**: 8px (base) on cards, inputs, buttons, dialogs — consistent everywhere
- **Spacing scale**: 4px, 8px, 12px, 16px, 24px, 32px (Tailwind default)
- **Line height**: 1.6 on body text (generous, readable)
- **Letter spacing**: default (no tightening)

#### Typography
- **Font**: Inter or system sans (`font-sans` from Tailwind)
- **Hierarchy**:
  - H1: `text-4xl font-semibold` (page titles)
  - H2: `text-2xl font-semibold` (section headers)
  - H3: `text-lg font-semibold` (subsections)
  - Body: `text-base leading-relaxed`
  - Small: `text-sm text-neutral-500`

#### Accessibility
- **Focus rings**: 2px, visible, `ring-blue-400` or `ring-blue-500`
- **Contrast**: WCAG AA minimum (test with axe)
- **Interactive elements**: visible `:focus-visible`, not just on hover

### Base components (minimal, composable)
Build these with Tailwind + optionally Radix UI primitives (headless, accessible):

1. **Button** (primary, secondary, ghost, sm/md/lg, disabled, loading)
2. **Input** (text, email, password, number, focus ring, error state)
3. **Select** (dropdown, native or Radix Combobox)
4. **Textarea** (auto-expanding, max-height)
5. **Label** (associated with input via htmlFor)
6. **Card** (white bg, border, rounded, padding presets)
7. **Badge** (status: pending/confirmed/cancelled/failed — color-coded)
8. **Dialog** (modal overlay, trap focus, esc to close)
9. **Popover** (non-modal overlay for timezone switcher, etc.)
10. **Toast** (system for notifications: success, error, info)
11. **Skeleton** (gray placeholder, pulse animation for async data)
12. **Spinner** (small, centered, for button loading states)

**Rule**: No heavy UI kit (Material, Chakra, etc.). Use Radix for primitives (Dialog, Popover, Select) where needed for a11y, but style everything with Tailwind.

## Milestone 4.2 — Public booking flow (hero screen) `/[username]/[eventSlug]`

### Layout
```
┌─────────────────────────────────────────┐
│  BetterCal (logo)                       │ ← Header (minimal)
├──────────────────┬──────────────────────┤
│                  │                      │
│  Left panel      │  Right panel         │
│  ────────────    │  ────────────        │
│  • Avatar        │  Month calendar      │
│  • Name          │  ↓                   │
│  • Title         │  Time slots          │
│  • Duration      │  (timezone picker)   │
│  • Location      │  ↓                   │
│  • Description   │  Booking form        │
│  • Timezone      │  ↓                   │
│                  │  Confirmation        │
└──────────────────┴──────────────────────┘
```

**Mobile (< 768px)**:
- Single column, stacked: left panel, then right
- Calendar and form full-width

**Desktop (≥ 768px)**:
- Side-by-side, left 40% / right 60%

### Left panel
- **Host avatar**: 64px, rounded, fallback to initials
- **Host name**: `text-lg font-semibold`
- **Event title**: `text-2xl font-semibold` (color: neutral-900)
- **Duration**: `text-sm text-neutral-500` (e.g., "30 minutes")
- **Location**: `text-sm` + icon (if provided)
- **Description/notes**: `text-sm leading-relaxed` (truncated to 3 lines, "show more" if needed)
- **Host timezone**: `text-xs text-neutral-500` (e.g., "Your timezone: Europe/Rome")

### Right panel — date selection
- **Month calendar**: 7×6 grid (Sun–Sat, starts on Sunday)
  - **Today**: blue ring, bold text
  - **Selected date**: blue background + white text
  - **Available dates**: `cursor-pointer`, hover `bg-neutral-100`
  - **Unavailable dates**: `text-neutral-300`, `cursor-not-allowed`, no hover
  - **Prev/next month buttons**: at the top, disabled if no slots in adjacent months
- **Empty state** (no availability): `text-neutral-500`, "No availability in [month]. [Jump to next available date →]"

### Right panel — time selection
- **Selected date heading**: `text-lg font-semibold` (e.g., "Monday, June 5, 2026")
- **Timezone indicator + switcher**:
  - Display: `"Your timezone: Europe/Rome"` (clickable)
  - Popover: searchable input (autocomplete for all IANA timezones)
  - On select: re-fetch slots + re-render (with skeleton loader)
  - Save to localStorage for next visit
- **Slot list**: time buttons in a 2-column grid (mobile) / 3-column (desktop)
  - Button style: `border border-neutral-300 p-3 text-center text-sm hover:bg-neutral-100`
  - Selected slot: `bg-blue-600 text-white border-blue-600`
  - Empty state: `text-neutral-500`, "No slots available [on this day in your timezone]"
- **Jump to next available**: if selected date has no slots, show a link to next date with availability

### Right panel — booking form (after selecting a time)
- **Form fields**:
  - Name (required, text input)
  - Email (required, email input, validate format)
  - Timezone (pre-filled from left panel, read-only display or select to change)
  - Notes (optional, textarea, max 500 chars)
- **Validation**: zod on client (inline errors below fields) + server (surface if client fails)
- **Submit button**: 
  - Text: "Book appointment"
  - Disabled while pending + show spinner
  - On submission: call `createBooking()` action
- **Error handling**:
  - `"Slot no longer available"` → Toast error + auto-refresh slot list (gray out current slot, show others)
  - `"Calendar not connected"` → Toast error + suggest checking dashboard
  - Generic errors → Toast + "Try again" button
- **Success**: 
  - Transition to confirmation screen (next section)
  - Confetti animation optional (nice-to-have, can defer)

### Right panel — confirmation screen
- **Heading**: "🎉 All set!" or "Booking confirmed"
- **Details card**:
  - Event title
  - Date/time (in viewer's timezone)
  - Duration (e.g., "30 minutes")
  - Location (if provided)
- **Attendee info**: name + email (read-only)
- **Actions**:
  - "Add to calendar" button:
    - If Google Calendar: Generate Google Calendar URL (easy link)
    - Always: .ics download button (file generated on server)
  - "Back to bookings" link (or "Book another time")
- **Email confirmation note**: "A confirmation has been sent to [email]"

### Edge cases & error states
1. **Slot no longer available** (concurrent booking):
   - Message: "This slot was just booked. Here are other times available."
   - Action: Auto-refresh slot list, highlight next available slot
2. **Calendar error** (provider offline):
   - Toast: "Calendar sync failed. Your booking may not appear in calendar."
   - Booking still confirmed in DB + email sent
3. **Network offline** while submitting:
   - "Check your connection and try again"
4. **Too many requests** (spam prevention):
   - "Please wait a moment before booking another slot"

## Milestone 4.3 — Host dashboard (authed, `/dashboard/*`)

### Dashboard sidebar
- **Logo/brand**: top-left
- **Nav links**: 
  - Dashboard (home)
  - Event types
  - Availability
  - Connected Calendars
  - Bookings
- **User section** (bottom):
  - User email + avatar (small, clickable for settings — stretch goal)
  - Sign out button

### `/dashboard` (home)
- **Welcome card**: "Welcome back, [name]! Here's your week."
- **Quick stats** (optional): upcoming bookings this week, connected calendars count
- **Quick actions**: "Create event type", "Edit availability", "Connect calendar"
- **Upcoming bookings** (next 7 days):
  - Card list or table (responsive)
  - Each booking: date/time, attendee, event type, status
  - Click to view details (modal or navigate to booking view)

### `/dashboard/event-types`
- **List view**:
  - Table (desktop) or card list (mobile): slug, title, duration, status (active/inactive)
  - Actions: edit, duplicate, delete, view public link
- **Create/edit form** (modal or dedicated page):
  - Slug (auto-generated from title, editable, validated unique per user)
  - Title (required)
  - Duration (select: 15, 30, 45, 60 min)
  - Buffer before (0, 15, 30 min)
  - Buffer after (0, 15, 30 min)
  - Min notice (0, 15, 30, 60, 120 min)
  - Slot interval (15, 30 min)
  - Range (days into future: 7, 14, 30, 60)
  - Location (optional, text)
  - Description (optional, textarea)
  - Active toggle (enable/disable bookings)
  - Save button → calls server action
  - Validation: zod, display errors inline
  - Success: redirect to list, toast "Saved"

### `/dashboard/availability`
- **Weekly hours editor**:
  - Grid: 7 rows (Sun–Sat), 2 columns (start time, end time)
  - Each cell: time input (HH:MM) or "Off" button
  - Copy previous day, copy to all week buttons (UX helpers)
  - Save button → calls server action
- **Date overrides** (collapsed section):
  - List of date overrides + edit/delete buttons
  - "Add override" button → modal:
    - Date picker
    - Radio: "Unavailable" or "Custom hours"
    - If custom: time range inputs
    - Save button
  - Validation: dates can't be in the past
- **Timezone display**: current user timezone (from profile, linked to dashboard settings — stretch)

### `/dashboard/calendars`
- **Connected calendars list**:
  - Each calendar card: provider logo, name, status (connected ✓ / error ✗)
  - Toggles: read-busy (on/off), write-target (only one per provider type)
  - Delete button
- **Google Calendar**:
  - "Connect Google Calendar" button
  - Triggers OAuth flow (sign in if needed)
  - On callback: creates connected_calendar, shows success toast
  - If already connected: show disconnect button + read-busy toggle + write-target selector
- **CalDAV**:
  - Form (collapsed until needed):
    - Server URL (input, required)
    - Username (input, required)
    - Password (password input, required, never stored plaintext)
    - Read calendar URLs (comma-separated, or multi-select if fetched from server)
    - Write calendar URL (dropdown or text)
    - "Test connection" button → calls validation action, shows spinner
    - On success: enable save, show green checkmark
    - On failure: show error, disable save
    - Save button → encrypts + stores
    - Success: adds to list above
- **Partial failure handling** (if configured in Phase 3):
  - Info box: "⚠️ Calendar sync partially failed. X of Y calendars available."
  - Bookings still proceed, but notify host

### `/dashboard/bookings`
- **Filter/sort**: upcoming, past, status (pending, confirmed, cancelled, failed)
- **List** (table on desktop, cards on mobile):
  - Date/time, attendee name + email, event type, status badge, actions
  - Click row to view details → modal/drawer:
    - Full details (event, time, attendee, notes)
    - Status + history (when created, when confirmed, etc.)
    - Cancel button (stretch goal — Phase 5)
    - Send reminder button (stretch goal)
    - Delete button (admin only, or after cancellation)
- **Empty state**: "No bookings yet. Share your public link to start receiving bookings."

## Milestone 4.4 — States, responsiveness, a11y

### Loading & skeleton states
- Slot list fetching: skeleton loaders (3–5 fake slots, gray, pulsing)
- Availability editor loading: fields disabled, skeleton on list
- Bookings list: skeleton cards matching the card height
- **Principle**: Always show a placeholder while async work is pending; never a blank screen

### Error handling & recovery
- **Toast system**:
  - Position: top-right (desktop) / top-center (mobile)
  - Variants: success (green), error (red), info (blue)
  - Auto-dismiss after 4 seconds (error: 6 seconds), manual close available
  - Max 3 toasts on screen at once
- **Error boundaries** (optional but recommended):
  - Wrap each major section
  - "Something went wrong. Reload the page." + reload button
- **Server action errors**:
  - Return typed `{ success: false, error: "..." }` from actions
  - Show error in toast or inline (context-dependent)
  - Never show generic "Error" — be specific

### Responsive design
- **Mobile-first**: Design for 375px (iPhone SE) up
- **Breakpoints**: 640px (sm), 768px (md), 1024px (lg) — use Tailwind defaults
- **Booking page** (most critical on mobile):
  - Calendar: full-width, font-size increases slightly (tap targets > 44px)
  - Slots: 2-column grid on mobile, 3-column on desktop
  - Form: full-width, inputs stack vertically
  - Touch-friendly: buttons ≥ 44×44px
- **Dashboard**: sidebar collapses to hamburger menu on mobile
- **Tables**: scroll horizontally on mobile, or convert to cards

### Accessibility (a11y)
- **Keyboard navigation**:
  - All buttons/inputs focusable (Tab key)
  - Calendar: arrow keys to navigate dates (or custom, at minimum tab-focusable)
  - Slot list: arrow keys (or enter/space to select)
  - Dialog: Esc to close, Tab trapped within
  - Skip-to-content link at page top (hidden, focusable)
- **ARIA labels**:
  - Buttons with icons: `aria-label="Close"` (not just X)
  - Form fields: `<label htmlFor="fieldId">` (not placeholder-only)
  - Status badges: `<span aria-label="status: confirmed">`
  - Loading spinner: `aria-busy="true"` on submit button
  - Errors: `aria-invalid="true"` on input, `aria-describedby="error-id"` pointing to error message
- **Color contrast**:
  - Text on background ≥ 4.5:1 (AAA on body text)
  - Neutral-900 on white: 21:1 ✓
  - Neutral-500 on white: ~7:1 ✓
  - Links (blue-600) on white: ~6:1 ✓
- **Testing**: Run axe CLI on booking page + dashboard; fix all critical violations
  - Tolerate "low impact" (informational only)

## Form wiring rules

### Server Actions (recap from Phase 3, wire these)
- `createBooking(eventSlug, startUtc, attendeeName, attendeeEmail, attendeeTimezone)` → `{ success, bookingId?, error? }`
- `createEventType(...)` → `{ success, eventTypeId?, error? }`
- `updateEventType(id, ...)` → `{ success, error? }`
- `deleteEventType(id)` → `{ success, error? }`
- `updateWeeklyAvailability(weekday, startTime, endTime)` → `{ success, error? }`
- `createDateOverride(date, intervals)` → `{ success, error? }`
- `deleteDateOverride(id)` → `{ success, error? }`
- `connectCalDAV(url, username, password)` → `{ success, error? }`
- `disconnectCalendar(id)` → `{ success, error? }`
- `getSlots(eventSlug, startDate, endDate)` → `{ slots, warning? }`

### Form patterns (use `useActionState` or `useFormStatus` in client components)

```typescript
// Pattern 1: Server Action with useActionState (React 19+)
export default function MyForm() {
  const [state, formAction, isPending] = useActionState(
    myServerAction,
    { success: false }
  );

  return (
    <form action={formAction} className="space-y-4">
      <Input 
        name="fieldName" 
        aria-invalid={state.error ? "true" : "false"}
        aria-describedby={state.error ? "error-id" : undefined}
      />
      {state.error && <span id="error-id" className="text-red-600 text-sm">{state.error}</span>}
      
      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner /> : "Submit"}
      </Button>

      {state.success && <Toast>Saved successfully</Toast>}
    </form>
  );
}

// Pattern 2: Client component with useFormStatus (shows pending on any submit in form)
"use client";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending}>{pending ? <Spinner /> : "Submit"}</Button>;
}
```

### Validation (zod on both client + server)

```typescript
// Shared schema (or in a separate file)
const bookingSchema = z.object({
  attendeeName: z.string().min(1, "Name is required").max(100),
  attendeeEmail: z.string().email("Invalid email"),
  notes: z.string().max(500).optional(),
});

// Client: validate on blur/change for UX
<Input 
  name="attendeeName"
  onBlur={(e) => {
    const result = bookingSchema.shape.attendeeName.safeParse(e.target.value);
    setError(result.success ? null : result.error.message);
  }}
/>

// Server: validate before action, return errors
export async function createBooking(data) {
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  // ... proceed
}
```

### Toast notifications (custom context or simple library)

```typescript
// Toast system (simple context-based)
type Toast = { id: string; type: "success" | "error" | "info"; message: string };

// In component:
const { addToast } = useToast();

// Show toast on success
if (state.success) {
  addToast({ type: "success", message: "Booking confirmed!" });
}

// Show toast on error
if (state.error) {
  addToast({ type: "error", message: state.error });
}
```

## Required tests

### Component tests (Vitest + React Testing Library)
- **Button**: renders with correct variant (primary/secondary/ghost), disabled state, loading spinner
- **Input**: renders, accepts input, shows error message, focus ring visible
- **Select**: opens dropdown, selects option, disabled state
- **Badge**: renders with correct status color (pending=yellow, confirmed=green, failed=red)
- **Calendar**: clicking date selects it, past/unavailable dates disabled, arrow keys navigate
- **Timezone popover**: opens, filters options, selects timezone, closes on selection

### Integration tests (Vitest + mocked Server Actions)
- **Booking flow**:
  - Load event page → slots fetched (mocked action) + rendered
  - Click date → time slots appear
  - Switch timezone → slots re-rendered in new timezone
  - Submit form → calls createBooking action
  - Success → confirmation screen shown
  - Error "slot no longer available" → toast shown, slot list refreshed
- **Availability editor**:
  - Edit weekly hours → save button enabled
  - Click save → updateWeeklyAvailability called
  - Success → toast "Saved"
  - Validation: time ranges can't be backwards (end before start)
- **Event type form**:
  - Create: slug auto-generated from title, can be edited
  - Slug uniqueness: server returns error if duplicate → display error inline
  - Save → createEventType called → redirects to list

### A11y tests (axe-core)
```typescript
import { axe, toHaveNoViolations } from "jest-axe";

test("booking page has no a11y violations", async () => {
  const { container } = render(<BookingPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Acceptance criteria

### UI & Design
- [x] Clean, neutral design system implemented (Tailwind config + base components)
- [x] Booking page polished on mobile + desktop; matches Cal.com simplicity aesthetic
- [x] Dashboard fully navigable, all pages styled consistently
- [x] Dark mode supported (Tailwind dark: classes) — optional, nice-to-have

### Form wiring
- [x] Every form wired to its Server Action
- [x] Client-side zod validation on inputs (immediate feedback)
- [x] Server-side zod validation on actions (trust boundary)
- [x] Loading states: spinners, disabled buttons, skeleton loaders
- [x] Error handling: typed errors from actions, displayed as toasts/inline messages
- [x] Success feedback: toasts, redirects, or screen transitions
- [x] No dead buttons or silent failures

### Responsiveness
- [x] Booking page mobile-first, works on 375px+ screens
- [x] All tables/grids reflow on mobile, tap targets ≥ 44px
- [x] Sidebar collapses on mobile (hamburger menu)

### Accessibility
- [x] Keyboard navigation: Tab/Shift+Tab, arrow keys, Esc, Enter
- [x] ARIA labels + descriptions on all interactive elements
- [x] Focus rings visible, color contrast ≥ 4.5:1
- [x] No critical a11y violations on axe audit (bookings + dashboard)

### Tests
- [x] Component tests for base components (Button, Input, etc.)
- [x] Integration tests for booking flow (select date → submit → confirm)
- [x] Integration tests for forms (event type, availability)
- [x] A11y smoke test: axe on booking page + dashboard

### Core logic untouched
- [x] All Phase 1–3 tests still green
- [x] No changes to slot engine, providers, booking guard, schema

## Out of scope (Future — Phase 5+)
- Teams, round-robin, payments
- Reschedule + cancel flows (or minimal version as stretch goal)
- Embeds, public widgets, iframes
- Theming, white-label, branding customization
- i18n, localization
- Advanced scheduling (recurring, group events)
- Custom domain per user (SaaS feature)

Keep structure clean for these; modularize components and actions so they can be extended.

---

## Next steps
1. Build token set + base components (Tailwind + Radix primitives)
2. Implement booking page UI (left panel + calendar + form + confirm)
3. Implement dashboard pages (availability, event types, calendars, bookings)
4. Wire forms to Server Actions (useActionState, zod, error handling)
5. Test responsiveness + a11y
6. Deploy & gather feedback
