'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Button } from '@/components/ui';
import { ForcePasswordChange } from '@/components/force-password-change';
import { api, ApiError } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { grants } from '@/lib/permissions';
import type { ModuleKey, TenantMeResponse } from '@/lib/types';

/**
 * Authenticated tenant context from GET /tenant/me. Exposes the subscription
 * state (readOnly, enabledModules, trial countdown) that gates the dashboard UX
 * (Story 8.6). The backend still enforces every rule server-side.
 */
interface TenantContextValue {
  me: TenantMeResponse | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => Promise<void>;
  setMe: (me: TenantMeResponse) => void;
  /** True when the subscription is read-only — mutations must be disabled. */
  readOnly: boolean;
  enabledModules: ModuleKey[];
  isModuleEnabled: (key: ModuleKey) => boolean;
  /** True when the user's role grants the permission key (or the '*' wildcard). */
  hasPermission: (key: string) => boolean;
  /** Epic 12 (12.4 AC2) — true when the user already dismissed this hint. */
  isHintDismissed: (key: string) => boolean;
  /** Optimistically hides the hint and persists the dismissal server-side. */
  dismissHint: (key: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Shown when the signed-in session belongs to a DIFFERENT hotel than the URL's
 * slug (possible in path-based routing, where localStorage is origin-wide).
 * The backend never mixes tenants — this guard keeps the shell from rendering
 * hotel A's data under hotel B's branding (Story 8.1 AC2 defense-in-depth).
 */
function WrongTenant({ meSlug, urlSlug }: { meSlug: string; urlSlug: string }) {
  const t = useTranslations('shell.wrongTenant');
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
      <ShieldAlert size={32} className="text-gold" aria-hidden />
      <h1 className="font-display text-xl font-semibold text-ink">
        {t('title')}
      </h1>
      <p className="max-w-md text-sm text-ink-soft">{t('hint')}</p>
      <div className="mt-2 flex gap-3">
        <Button onClick={() => router.push(`/t/${meSlug}`)}>
          {t('goToMine')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            tokenStore.clear();
            router.push(`/t/${urlSlug}/login`);
          }}
        >
          {t('switchAccount')}
        </Button>
      </div>
    </div>
  );
}

export function TenantProvider({
  slug,
  children,
}: {
  /** The tenant slug from the URL — the session must belong to it. */
  slug: string;
  children: ReactNode;
}) {
  const [me, setMeState] = useState<TenantMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<TenantMeResponse>('/tenant/me');
      setMeState(data);
    } catch (err) {
      // 401s are handled by api()'s silent-refresh + hard-logout path.
      if (err instanceof ApiError) setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Epic 12 (12.4 AC2) — optimistic local hide + fire-and-forget persistence
  // (same pattern as the preferredLanguage PATCH): a failed call only means
  // the hint reappears next session.
  const dismissHint = useCallback((key: string) => {
    setMeState((prev) => {
      if (!prev) return prev;
      const dismissed = prev.user.dismissedHints ?? [];
      if (dismissed.includes(key)) return prev;
      return {
        ...prev,
        user: { ...prev.user, dismissedHints: [...dismissed, key] },
      };
    });
    api(`/tenant/me/hints/${encodeURIComponent(key)}/dismiss`, {
      method: 'POST',
    }).catch(() => {});
  }, []);

  const enabledModules = me?.subscription.enabledModules ?? [];
  const permissions = me?.user.permissions ?? [];
  const value: TenantContextValue = {
    me,
    loading,
    error,
    reload,
    setMe: setMeState,
    readOnly: me?.subscription.readOnly ?? false,
    enabledModules,
    isModuleEnabled: (key) => enabledModules.includes(key),
    hasPermission: (key) => grants(permissions, key),
    isHintDismissed: (key) => (me?.user.dismissedHints ?? []).includes(key),
    dismissHint,
  };

  if (me && me.hotel.slug !== slug) {
    return <WrongTenant meSlug={me.hotel.slug} urlSlug={slug} />;
  }

  // Story 9.7 AC4 — a temporary-password holder is forced to change it before
  // reaching any dashboard screen (the backend blocks the routes too).
  if (me?.user.mustChangePassword) {
    return (
      <TenantContext.Provider value={value}>
        <ForcePasswordChange />
      </TenantContext.Provider>
    );
  }

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
}
