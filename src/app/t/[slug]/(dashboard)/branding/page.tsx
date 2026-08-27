'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccentPicker } from '@/components/branding/accent-picker';
import { DEMO_BRANDING } from '@/components/branding/guest-tokens';
import { PhonePreview } from '@/components/branding/phone-preview';
import { ConfirmModal, ConsequenceNote, PageIntro } from '@/components/guidance';
import { ModuleUpsell } from '@/components/module-upsell';
import {
  NameFields,
  type NameFieldValues,
  namesToFields,
} from '@/components/name-fields';
import { PhotoPicker, isValidPhoto } from '@/components/photo-picker';
import { useTenant } from '@/components/tenant-provider';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, apiUpload, assetUrl } from '@/lib/api';
import { isAccentAllowed, isHexColor } from '@/lib/contrast';
import { useApiError } from '@/lib/errors';
import type { BrandingManageView, RequestTranslationMap } from '@/lib/types';

/**
 * Guest App Branding (Epic 18, Stories 18.1 + 18.3). Exactly three knobs —
 * accent color, home cover photo, welcome message — each mirrored live in a
 * phone mock built from the real guest tokens. Hotels without the module in
 * their plan get the same layout wrapped in the upsell shell, filled with
 * sample branding and no network traffic.
 */

/** Welcome payload keys ↔ the flat NameFields keys that back them. */
const WELCOME_KEYS = [
  ['welcomeEn', 'nameEn'],
  ['welcomeAr', 'nameAr'],
  ['welcomeRu', 'nameRu'],
  ['welcomeFr', 'nameFr'],
  ['welcomeIt', 'nameIt'],
  ['welcomeEs', 'nameEs'],
  ['welcomeDe', 'nameDe'],
] as const;

const WELCOME_MAX = 80;

export default function BrandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations('branding');
  const g = useTranslations('guidance.branding');
  const { me, isModuleEnabled, hasPermission, readOnly } = useTenant();
  const resolveError = useApiError();

  const canManage = hasPermission('branding.manage');
  const enabled = isModuleEnabled('guest_app_branding');
  /** Module not in the plan: the knobs render as an inert sample (18.3). */
  const locked = !enabled;

  const [view, setView] = useState<BrandingManageView | null>(null);
  const [loading, setLoading] = useState(canManage && enabled);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accent, setAccent] = useState('');
  const [welcome, setWelcome] = useState<NameFieldValues>({});
  const [previewLocale, setPreviewLocale] = useState<'en' | 'ar'>('en');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const applyView = useCallback((v: BrandingManageView) => {
    setView(v);
    setAccent(v.brandAccentColor ?? '');
    setWelcome(namesToFields(v.welcomeMessage));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      applyView(await api<BrandingManageView>('/tenant/branding'));
    } catch (err) {
      setLoadError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }, [applyView, resolveError]);

  useEffect(() => {
    if (canManage && enabled) void load();
  }, [canManage, enabled, load]);

  const hexValid = accent === '' || isHexColor(accent);
  const accentBlocked = accent !== '' && hexValid && !isAccentAllowed(accent);

  const welcomePayload = () =>
    Object.fromEntries(
      WELCOME_KEYS.map(([key, field]) => [key, (welcome[field] ?? '').trim()]),
    );

  /** What the phone shows while typing — falls back to the saved copy. */
  const previewWelcome: RequestTranslationMap | null = useMemo(() => {
    const en = (welcome.nameEn ?? '').trim();
    const ar = (welcome.nameAr ?? '').trim();
    return en || ar ? { en, ar } : null;
  }, [welcome]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      applyView(
        await api<BrandingManageView>('/tenant/branding', {
          method: 'PATCH',
          body: JSON.stringify({
            brandAccentColor: accent,
            ...welcomePayload(),
          }),
        }),
      );
      setSaved(true);
    } catch (err) {
      setSaveError(resolveError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    if (!isValidPhoto(file)) {
      setCoverError(t('cover.hint'));
      return;
    }
    setCoverBusy(true);
    setCoverError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      applyView(
        await apiUpload<BrandingManageView>('/tenant/branding/cover', body),
      );
    } catch (err) {
      setCoverError(resolveError(err));
    } finally {
      setCoverBusy(false);
    }
  };

  const removeCover = async () => {
    setCoverBusy(true);
    setCoverError(null);
    try {
      applyView(
        await api<BrandingManageView>('/tenant/branding/cover', {
          method: 'DELETE',
        }),
      );
    } catch (err) {
      setCoverError(resolveError(err));
    } finally {
      setCoverBusy(false);
    }
  };

  const resetAll = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const cleared = Object.fromEntries(WELCOME_KEYS.map(([key]) => [key, '']));
      applyView(
        await api<BrandingManageView>('/tenant/branding', {
          method: 'PATCH',
          body: JSON.stringify({ brandAccentColor: '', ...cleared }),
        }),
      );
      if (view?.coverThumbUrl) {
        applyView(
          await api<BrandingManageView>('/tenant/branding/cover', {
            method: 'DELETE',
          }),
        );
      }
      setSaved(false);
      setResetOpen(false);
    } catch (err) {
      setResetError(resolveError(err));
    } finally {
      setResetting(false);
    }
  };

  /** Clears every welcome language locally; the user still presses Save. */
  const resetWelcome = () => {
    setWelcome(namesToFields(null));
    setSaved(false);
  };

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noPermission.title')}
        hint={t('noPermission.hint')}
      />
    );
  }

  if (enabled && loading) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-[560px]" />
      </div>
    );
  }
  if (enabled && loadError) {
    return <ErrorState message={loadError} onRetry={load} />;
  }

  const hotelName = me?.hotel.nameEn ?? '';
  const logoUrl = me?.hotel.logoUrl ? assetUrl(me.hotel.logoUrl) : null;
  const coverUrl = view?.coverThumbUrl ? assetUrl(view.coverThumbUrl) : null;
  /** Only a valid, readable accent reaches the mock — never a half-typed hex. */
  const previewAccent =
    hexValid && !accentBlocked && accent !== '' ? accent : null;

  const disableMutations = readOnly || saving;
  /** Locked knobs are disabled, not just inert — they stay out of the tab order. */
  const knobsDisabled = locked || disableMutations;
  const welcomeValues = locked
    ? namesToFields(DEMO_BRANDING.welcome)
    : welcome;

  /**
   * One layout for both states: locked hotels see the same three knobs filled
   * with sample branding (18.3 AC1), so the upgrade is a preview of the real
   * screen rather than a screenshot of it.
   */
  const body = (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-10">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            {t('accent.label')}
          </h2>
          <AccentPicker
            value={locked ? DEMO_BRANDING.accent : accent}
            onChange={(hex) => {
              setAccent(hex);
              setSaved(false);
            }}
            disabled={knobsDisabled}
          />
        </section>

        <section>
          <PhotoPicker
            label={t('cover.label')}
            hint={t('cover.hint')}
            previewClassName="h-24 w-44"
            currentUrl={locked ? null : coverUrl}
            pending={null}
            canRemove={!locked && Boolean(view?.coverThumbUrl)}
            uploadLabel={t('cover.upload')}
            replaceLabel={t('cover.replace')}
            removeLabel={t('cover.remove')}
            error={coverError}
            disabled={knobsDisabled || coverBusy}
            onPick={(file) => void uploadCover(file)}
            onRemove={() => void removeCover()}
          />
        </section>

        <section>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              {t('welcome.title')}
            </h2>
            {locked ? null : (
              <button
                type="button"
                onClick={resetWelcome}
                disabled={disableMutations}
                className="text-sm font-medium text-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
              >
                {t('welcome.reset')}
              </button>
            )}
          </div>
          <p className="mb-3 text-sm text-ink-soft">{t('welcome.help')}</p>
          <NameFields
            values={welcomeValues}
            onChange={(key, value) => {
              setWelcome((w) => ({ ...w, [key]: value }));
              setSaved(false);
            }}
            namespace="branding.welcome"
            maxLength={WELCOME_MAX}
            disabled={knobsDisabled}
          />
        </section>

        {locked ? null : (
          <>
            <section className="rounded-xl border border-line bg-paper p-4 text-sm text-ink-soft">
              {t('logoNote.text')}{' '}
              <Link
                href={`/t/${slug}/profile`}
                className="font-semibold text-ink underline underline-offset-2"
              >
                {t('logoNote.link')}
              </Link>
            </section>

            <div className="border-t border-line pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={() => void save()}
                  loading={saving}
                  disabled={disableMutations || accentBlocked || !hexValid}
                >
                  {t('save')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={disableMutations}
                  onClick={() => setResetOpen(true)}
                >
                  {t('reset.all')}
                </Button>
                {saved ? (
                  <span role="status" className="text-sm text-success">
                    {t('saved')}
                  </span>
                ) : null}
                {saveError ? (
                  <span role="alert" className="text-sm text-danger">
                    {saveError}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                {readOnly ? t('readOnlyHint') : t('propagation')}
              </p>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">
            {t('preview.title')}
          </span>
          <div className="flex gap-1">
            <Button
              variant={previewLocale === 'en' ? 'primary' : 'ghost'}
              disabled={locked}
              onClick={() => setPreviewLocale('en')}
            >
              {t('preview.english')}
            </Button>
            <Button
              variant={previewLocale === 'ar' ? 'primary' : 'ghost'}
              disabled={locked}
              onClick={() => setPreviewLocale('ar')}
            >
              {t('preview.arabic')}
            </Button>
          </div>
        </div>
        <PhonePreview
          accent={locked ? DEMO_BRANDING.accent : previewAccent}
          coverUrl={locked ? null : coverUrl}
          welcome={locked ? DEMO_BRANDING.welcome : previewWelcome}
          previewLocale={previewLocale}
          hotelName={hotelName}
          logoUrl={logoUrl}
          demoCover={locked}
        />
        <p className="mt-3 text-xs text-ink-soft">{t('preview.caption')}</p>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{g('intro')}</PageIntro>

      <div className="mt-8">
        {locked ? (
          <ModuleUpsell moduleKey="guest_app_branding">{body}</ModuleUpsell>
        ) : (
          body
        )}
      </div>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('reset.confirmTitle')}
        confirmLabel={t('reset.all')}
        onConfirm={() => void resetAll()}
        destructive
        loading={resetting}
        error={resetError}
      >
        <p className="text-sm text-ink">{t('reset.confirmBody')}</p>
        <ConsequenceNote tone="danger">{t('reset.consequence')}</ConsequenceNote>
      </ConfirmModal>
    </div>
  );
}
