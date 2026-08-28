import { FnbFeedProvider } from '@/components/fnb/fnb-feed-provider';
import { HousekeepingFeedProvider } from '@/components/housekeeping/housekeeping-feed-provider';
import { LanguageSwitcher } from '@/components/language-switcher';
import { RequestsFeedProvider } from '@/components/requests/requests-feed-provider';
import { Sidebar } from '@/components/sidebar';
import { SubscriptionBanners } from '@/components/subscription-banners';
import { TenantProvider } from '@/components/tenant-provider';

/**
 * Authenticated dashboard shell: sidebar (hotel-branded, module-keyed) + topbar
 * + persistent subscription banners. Wraps everything in TenantProvider so the
 * whole tree reads readOnly / enabledModules / subscription from /tenant/me.
 */
export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <TenantProvider slug={params.slug}>
      {/* Epic 15/16 — one poller per feed app-wide (nav badge + board share it). */}
      <RequestsFeedProvider>
        <FnbFeedProvider>
        <HousekeepingFeedProvider>
        {/* Sidebar is the first flex child, so dir="rtl" moves it to the inline
            end automatically — no per-direction overrides needed. */}
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-white px-8">
              <LanguageSwitcher />
            </header>
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-6xl px-8 py-10">
                <SubscriptionBanners />
                {children}
              </div>
            </main>
          </div>
        </div>
        </HousekeepingFeedProvider>
        </FnbFeedProvider>
      </RequestsFeedProvider>
    </TenantProvider>
  );
}
