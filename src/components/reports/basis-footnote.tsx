import { useTranslations } from 'next-intl';

export interface BasisFootnoteProps {
  basis: 'delivered_only' | 'events_starting_in_period' | 'delivered_booked';
}

export function BasisFootnote({ basis }: BasisFootnoteProps) {
  const t = useTranslations('reports.basis');
  return <p className="text-xs italic text-ink-soft">{t(basis)}</p>;
}
