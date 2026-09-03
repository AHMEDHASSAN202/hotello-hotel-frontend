import analytics from './analytics.json';
import announcements from './announcements.json';
import auth from './auth.json';
import branding from './branding.json';
import common from './common.json';
import errors from './errors.json';
import events from './events.json';
import fnb from './fnb.json';
import guidance from './guidance.json';
import hotelInfo from './hotelInfo.json';
import hotelSettings from './hotelSettings.json';
import housekeeping from './housekeeping.json';
import profile from './profile.json';
import reports from './reports.json';
import requests from './requests.json';
import roles from './roles.json';
import rooms from './rooms.json';
import shell from './shell.json';
import staff from './staff.json';
import stays from './stays.json';
import subscription from './subscription.json';

/**
 * English message bundle — the canonical key set. Every namespace is statically
 * imported so webpack bundles it and scripts/check-i18n.mjs can diff `ar`.
 */
const messages = {
  analytics,
  announcements,
  auth,
  branding,
  common,
  errors,
  events,
  fnb,
  guidance,
  hotelInfo,
  hotelSettings,
  housekeeping,
  profile,
  reports,
  requests,
  roles,
  rooms,
  shell,
  staff,
  stays,
  subscription,
};

export default messages;
