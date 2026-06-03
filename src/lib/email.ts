import nodemailer from 'nodemailer';

interface BookingEmail {
  attendeeName: string;
  attendeeEmail: string;
  startUtc: string;
  eventTitle: string;
  hostEmail: string;
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587'),
    secure: parseInt(SMTP_PORT ?? '587') === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const FROM = () => process.env.EMAIL_FROM ?? 'BetterCal <noreply@bettercal.local>';

export async function sendBookingConfirmation(input: BookingEmail): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    console.log(`[email] → ${input.attendeeEmail}: "${input.eventTitle}" confirmed for ${input.startUtc}`);
    return;
  }

  await transport.sendMail({
    from: FROM(),
    to: input.attendeeEmail,
    subject: `Prenotazione confermata: ${input.eventTitle}`,
    html: `
      <p>Ciao ${input.attendeeName},</p>
      <p>La tua prenotazione è confermata:</p>
      <ul>
        <li><strong>Evento:</strong> ${input.eventTitle}</li>
        <li><strong>Data:</strong> ${input.startUtc}</li>
      </ul>
      <p>A presto!</p>
    `,
  });
}

export async function sendHostNotification(input: BookingEmail): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    console.log(`[email] → ${input.hostEmail}: new booking from ${input.attendeeName} for ${input.startUtc}`);
    return;
  }

  await transport.sendMail({
    from: FROM(),
    to: input.hostEmail,
    subject: `Nuova prenotazione: ${input.attendeeName} — ${input.eventTitle}`,
    html: `
      <p>Nuova prenotazione ricevuta:</p>
      <ul>
        <li><strong>Chi:</strong> ${input.attendeeName} (${input.attendeeEmail})</li>
        <li><strong>Evento:</strong> ${input.eventTitle}</li>
        <li><strong>Data:</strong> ${input.startUtc}</li>
      </ul>
    `,
  });
}
