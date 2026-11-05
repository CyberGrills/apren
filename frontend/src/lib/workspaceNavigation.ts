import type { Role } from '@7even/contracts';

export function loginPathForWorkspace(roles?: readonly Role[]): '/admin/login' | '/login' {
  return roles?.length === 1 && roles[0] === 'ADMIN' ? '/admin/login' : '/login';
}

export function safeWorkspaceReturnTo(requested: string | null, admin = false): string {
  const fallback = admin ? '/admin' : '/workspace';
  if (
    !requested?.startsWith('/') ||
    requested.startsWith('//') ||
    requested.includes('\\') ||
    Array.from(requested).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return fallback;
  if (admin) {
    const path = new URL(requested, 'https://seven.invalid').pathname.replace(/\/+$/, '');
    if (!(path === '/admin' || path.startsWith('/admin/')) || path === '/admin/login') {
      return fallback;
    }
  }
  return requested;
}
