'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { HintCard, PageIntro } from '@/components/guidance';
import { AboutCard } from '@/components/hotel-info/about-card';
import { EntryModal } from '@/components/hotel-info/entry-modal';
import { EssentialsCard } from '@/components/hotel-info/essentials-card';
import {
  SectionBlock,
  type RepeatableSection,
} from '@/components/hotel-info/section-block';
import { useTenant } from '@/components/tenant-provider';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { HotelInfoOverview, InfoEntryManage } from '@/lib/types';

const SECTIONS: RepeatableSection[] = ['facilities', 'services', 'house_rules'];

/**
 * Epic 17, Story 17.1 — the directory the guest app's Hotel Info tile
 * renders: Essentials (pinned first for guests), three repeatable sections
 * and the About block. One GET feeds the whole page; every mutation
 * refetches (the established no-optimistic-updates pattern).
 */
export default function HotelInfoPage() {
  const t = useTranslations('hotelInfo');
  const g = useTranslations('guidance.hotelInfo');
  const { hasPermission } = useTenant();
  const resolveError = useApiError();
  const canManage = hasPermission('hotel_info.manage');

  const [overview, setOverview] = useState<HotelInfoOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    section: RepeatableSection;
    entry: InfoEntryManage | null;
  }>({ open: false, section: 'facilities', entry: null });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOverview(await api<HotelInfoOverview>('/tenant/hotel-info'));
    } catch (err) {
      setLoadError(resolveError(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noPermission.title')}
        hint={t('noPermission.hint')}
      />
    );
  }

  const entriesOf = (section: RepeatableSection): InfoEntryManage[] => {
    if (!overview) return [];
    if (section === 'facilities') return overview.facilities;
    if (section === 'services') return overview.services;
    return overview.houseRules;
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{g('intro')}</PageIntro>
      <div className="mt-4">
        <HintCard hintKey="hotelInfo.firstRun" title={g('hint.title')}>
          {g('hint.body')}
        </HintCard>
      </div>

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      ) : overview === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <EssentialsCard
            essentials={overview.essentials}
            checkoutTime={overview.checkoutTime}
            onSaved={() => void load()}
          />
          {SECTIONS.map((section) => (
            <SectionBlock
              key={section}
              section={section}
              entries={entriesOf(section)}
              onAdd={() => setModal({ open: true, section, entry: null })}
              onEdit={(entry) => setModal({ open: true, section, entry })}
              onChanged={() => void load()}
            />
          ))}
          <AboutCard about={overview.about} onSaved={() => void load()} />
        </div>
      )}

      <EntryModal
        open={modal.open}
        section={modal.section}
        entry={modal.entry}
        onClose={() => setModal((m) => ({ ...m, open: false, entry: null }))}
        onSaved={() => void load()}
      />
    </div>
  );
}
