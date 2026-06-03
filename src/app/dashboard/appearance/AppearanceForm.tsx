'use client';

import { useActionState } from 'react';
import { useEffect, useState } from 'react';
import { saveAppearanceAction, type AppearanceState } from './actions';
import type { HostAppearance } from '@/db/schema';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-6">
      <legend className="px-1 text-sm font-semibold text-neutral-700">{title}</legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      defaultValue={defaultValue ?? ''}
      placeholder={placeholder}
      className="rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 w-full"
    />
  );
}

function ColorField({
  name,
  label,
  defaultValue,
  defaultHex,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  defaultHex: string;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? defaultHex);
  const [cleared, setCleared] = useState(!defaultValue);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCleared(false);
          }}
          disabled={cleared}
          className="h-8 w-14 cursor-pointer rounded border border-neutral-200 disabled:opacity-30"
        />
        <span className="font-mono text-xs text-neutral-500">{cleared ? '—' : value}</span>
        <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
          <input
            type="checkbox"
            name={`clear${name.charAt(0).toUpperCase() + name.slice(1)}`}
            checked={cleared}
            onChange={(e) => setCleared(e.target.checked)}
            className="rounded"
          />
          Default
        </label>
      </div>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page (client component wrapping the form)
// ---------------------------------------------------------------------------

export default function AppearancePage({ ap }: { ap: HostAppearance | null }) {
  const initial: AppearanceState = { success: false };
  const [state, formAction, pending] = useActionState(saveAppearanceAction, initial);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.success) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const bookingUrl = `/demo/intro`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appearance</h1>
          <p className="mt-1 text-sm text-neutral-500">Customise how your booking page looks.</p>
        </div>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          View page ↗
        </a>
      </div>

      <form action={formAction} className="space-y-6">
        {/* Branding */}
        <Section title="Branding">
          <Field label="Brand / display name" hint="Overrides your account name on the booking page. Leave blank to use the account name.">
            <TextInput name="brandName" defaultValue={ap?.brandName} placeholder="e.g. Corrado Friscia" />
          </Field>
          <Field label="Avatar URL" hint="Link to an image (HTTPS). Leave blank to show the initials.">
            <TextInput name="avatarUrl" defaultValue={ap?.avatarUrl} placeholder="https://example.com/photo.jpg" />
          </Field>
        </Section>

        {/* Colors */}
        <Section title="Colors">
          <ColorField
            name="accentColor"
            label="Accent color"
            defaultValue={ap?.accentColor}
            defaultHex="#171717"
            hint="Avatar background and decorative elements."
          />
          <ColorField
            name="bgColor"
            label="Card background"
            defaultValue={ap?.bgColor}
            defaultHex="#ffffff"
            hint="Background of the booking card."
          />
          <ColorField
            name="textColor"
            label="Primary text"
            defaultValue={ap?.textColor}
            defaultHex="#171717"
            hint="Event title and main labels."
          />
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <Field label="Font family" hint="Any valid CSS font-family string. Leave blank for the system font.">
            <TextInput
              name="fontFamily"
              defaultValue={ap?.fontFamily}
              placeholder='e.g. Georgia, serif  or  "Inter", sans-serif'
            />
          </Field>
        </Section>

        {/* Visibility */}
        <Section title="Visibility">
          {([
            ['showDuration', 'Show duration', ap?.showDuration ?? true],
            ['showLocation', 'Show location', ap?.showLocation ?? true],
            ['showTimezone', 'Show host timezone', ap?.showTimezone ?? true],
          ] as const).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name={name}
                defaultChecked={checked}
                className="rounded"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </Section>

        {/* Labels */}
        <Section title="Labels">
          <Field label="Duration suffix" hint='Default: "minutes"'>
            <TextInput name="durationLabel" defaultValue={ap?.durationLabel} placeholder="minutes" />
          </Field>
          <Field label="Timezone prefix" hint='Default: "Host timezone:"'>
            <TextInput name="timezoneLabel" defaultValue={ap?.timezoneLabel} placeholder="Host timezone:" />
          </Field>
        </Section>

        {/* Icons */}
        <Section title="Icons">
          <div className="flex gap-6">
            {(['emoji', 'none'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer capitalize">
                <input
                  type="radio"
                  name="iconStyle"
                  value={v}
                  defaultChecked={(ap?.iconStyle ?? 'emoji') === v}
                />
                <span className="text-sm text-neutral-700">{v === 'emoji' ? '⏱ Emoji' : 'None'}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Theme */}
        <Section title="Theme">
          <div className="flex gap-6">
            {([
              ['light', 'Light'],
              ['dark', 'Dark'],
              ['auto', "Auto (follows visitor’s OS)"],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="themeMode"
                  value={v}
                  defaultChecked={(ap?.themeMode ?? 'light') === v}
                />
                <span className="text-sm text-neutral-700">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-400">
            Auto uses the CSS <code>prefers-color-scheme</code> media query — the dark palette is activated by the visitor's OS or browser setting.
          </p>
        </Section>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
