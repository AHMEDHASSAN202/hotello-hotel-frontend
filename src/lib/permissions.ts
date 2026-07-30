/**
 * Whether a permission set grants a key. The '*' wildcard passes every check
 * (the owner holds it). Mirrors the backend PermissionsGuard so the UI gates
 * exactly the way the server does.
 */
export function grants(permissions: string[], key: string): boolean {
  return permissions.includes('*') || permissions.includes(key);
}
