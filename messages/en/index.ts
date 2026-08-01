import auth from './auth.json';
import common from './common.json';
import errors from './errors.json';
import guidance from './guidance.json';
import profile from './profile.json';
import roles from './roles.json';
import shell from './shell.json';
import staff from './staff.json';
import subscription from './subscription.json';

/**
 * English message bundle — the canonical key set. Every namespace is statically
 * imported so webpack bundles it and scripts/check-i18n.mjs can diff `ar`.
 */
const messages = {
  auth,
  common,
  errors,
  guidance,
  profile,
  roles,
  shell,
  staff,
  subscription,
};

export default messages;
