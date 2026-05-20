export const DEV_TOKEN_PREFIX = 'dev-role-token:';

export interface DevSessionUserLike {
  id?: string | null;
  email?: string | null;
  token?: string | null;
}

export const isDevSessionToken = (token?: string | null) =>
  typeof token === 'string' && token.startsWith(DEV_TOKEN_PREFIX);

export const isDevSessionUser = (user?: DevSessionUserLike | null) => {
  if (!user) return false;
  return (
    isDevSessionToken(user.token) ||
    (typeof user.id === 'string' && user.id.startsWith('dev-')) ||
    (typeof user.email === 'string' && user.email.endsWith('@almeaa.local'))
  );
};
