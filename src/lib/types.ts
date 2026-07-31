export type PreferredLanguage = 'en' | 'ar';

export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'canceled'
  | 'expired';

/** Module keys used by `enabledModules`. */
export type ModuleKey =
  | 'transportation'
  | 'housekeeping'
  | 'fnb'
  | 'guest_app_branding'
  | 'analytics';

/* ------------------------------------------------- Public tenant context */

export interface TenantContextPublic {
  slug: string;
  nameEn: string;
  nameAr: string;
  /** Path relative to the API base; render as `${API}/${logoUrl}` when non-null. */
  logoUrl: string | null;
  status: 'active' | 'suspended';
  defaultLanguage: PreferredLanguage;
}

/* --------------------------------------------------------------- Auth */

/** The role reference embedded on a user (Epic 09 — role is the source of truth). */
export interface TenantRoleRef {
  id: string;
  nameEn: string;
  nameAr: string;
  isSystem: boolean;
}

export interface TenantUser {
  id: string;
  name: string;
  /** Null for username-only staff accounts (Epic 09); owners always have one. */
  email: string | null;
  username?: string | null;
  role: TenantRoleRef | null;
  /** Flattened from the role — clients gate on this array. */
  permissions: string[];
  preferredLanguage: PreferredLanguage;
  lastLoginAt?: string | null;
  /** Story 9.7 AC4 — the shell forces the change-password screen when true. */
  mustChangePassword?: boolean;
}

export interface TenantLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: TenantUser;
  hotel: { slug: string };
}

export interface TenantRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MessageResponse {
  message: string;
}

export interface SetupPreviewResponse {
  name: string;
  email: string;
  hotelNameEn: string;
  hotelNameAr: string;
}

export interface SetupResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: TenantUser;
  hotel: { slug: string };
}

/* ----------------------------------------------------------- /tenant/me */

export interface TenantMeHotel {
  slug: string;
  nameEn: string;
  nameAr: string;
  logoUrl: string | null;
  defaultLanguage: PreferredLanguage;
  status: 'active' | 'suspended';
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  readOnly: boolean;
  enabledModules: ModuleKey[];
  planNameEn: string | null;
  planNameAr: string | null;
}

export interface TenantMeResponse {
  user: TenantUser & { lastLoginAt: string | null };
  hotel: TenantMeHotel;
  subscription: SubscriptionState;
}

/* ------------------------------------------------------------- Staff (Epic 09) */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A tenant role for the invite/edit dropdowns (GET /tenant/roles). */
export interface TenantRole extends TenantRoleRef {
  descriptionEn: string | null;
  descriptionAr: string | null;
  permissions: string[];
}

export type StaffStatus = 'pending' | 'active' | 'disabled';

export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  status: StaffStatus;
  lastLoginAt: string | null;
  inviteSentAt: string | null;
  createdAt: string;
  role: TenantRoleRef | null;
}

/** One-time credentials returned by direct-create (9.7) and manager reset (9.8). */
export interface StaffCredentials {
  username: string | null;
  tempPassword: string;
  loginUrl: string;
}

export interface CreateStaffDirectResponse {
  staff: StaffMember;
  credentials: StaffCredentials;
}

export interface ResetPasswordResponse {
  credentials: StaffCredentials;
}

/* ------------------------------------------------------------ Roles (Epic 10) */

/** A role in the management list (GET /tenant/roles), with its staff count. */
export interface TenantRoleSummary extends TenantRoleRef {
  descriptionEn: string | null;
  descriptionAr: string | null;
  permissions: string[];
  staffCount: number;
  createdAt: string;
}

/** A single role's detail (GET /tenant/roles/:id). */
export type TenantRoleDetail = TenantRoleSummary;

/** One permission in the localized catalog (GET /tenant/roles/permissions/catalog). */
export interface TenantPermissionDef {
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

/** A catalog group; `module` (when present) means it is plan-gated. */
export interface TenantPermissionGroup {
  group: string;
  labelEn: string;
  labelAr: string;
  module?: string;
  permissions: TenantPermissionDef[];
}

export type TenantPermissionCatalog = TenantPermissionGroup[];
