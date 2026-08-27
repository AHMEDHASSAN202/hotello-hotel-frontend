import auth from './auth.json';
import branding from './branding.json';
import common from './common.json';
import errors from './errors.json';
import fnb from './fnb.json';
import guidance from './guidance.json';
import hotelInfo from './hotelInfo.json';
import profile from './profile.json';
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
  auth,
  branding,
  common,
  errors,
  fnb,
  guidance,
  hotelInfo,
  profile,
  requests,
  roles,
  rooms,
  shell,
  staff,
  stays,
  subscription,
};

export default messages;
