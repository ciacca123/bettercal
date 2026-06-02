/**
 * Local-mock email transport: logs to the server console instead of sending.
 * Swap for a real Resend client in a later phase.
 */
interface BookingEmail {
  attendeeName: string;
  attendeeEmail: string;
  startUtc: string;
  eventTitle: string;
  hostEmail: string;
}

export async function sendBookingConfirmation(input: BookingEmail): Promise<void> {
  console.log(
    `[email] → ${input.attendeeEmail}: "${input.eventTitle}" confirmed for ${input.startUtc}`
  );
}

export async function sendHostNotification(input: BookingEmail): Promise<void> {
  console.log(
    `[email] → ${input.hostEmail}: new booking from ${input.attendeeName} for ${input.startUtc}`
  );
}
