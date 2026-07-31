'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin / permissions) — silently no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? t('actions.copy')}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:text-ink"
    >
      {copied ? (
        <Check size={14} className="text-success" aria-hidden />
      ) : (
        <Copy size={14} aria-hidden />
      )}
      {copied ? t('actions.copied') : t('actions.copy')}
    </button>
  );
}
