import { siteRoot } from '@/constants';

const getPageOptions = () => (window.app && window.app.pageOptions) || {};

const ensureTrailingSlash = (path) => {
  if (!path) {
    return '/';
  }
  return path.endsWith('/') ? path : `${path}/`;
};

const getSiteRoot = () => ensureTrailingSlash(siteRoot || '/');

const trimSlashes = (value) => String(value).replace(/^\/+|\/+$/g, '');

export const getPortalBasePath = () => {
  const { projectUuid, isEditMode, isPortalCustomDomain, portalBaseUrl } = getPageOptions();
  if (isPortalCustomDomain && !isEditMode) {
    return ensureTrailingSlash(portalBaseUrl || '/');
  }
  const basePath = isEditMode ? 'portal-edit' : 'portal';
  return ensureTrailingSlash(`${getSiteRoot()}${basePath}/${projectUuid}/`);
};

export const buildPortalPath = (...segments) => {
  const basePath = getPortalBasePath();
  const cleanedSegments = segments
    .filter(segment => segment !== undefined && segment !== null && segment !== '')
    .map(segment => trimSlashes(segment));

  if (cleanedSegments.length === 0) {
    return basePath;
  }

  if (basePath === '/') {
    return `/${cleanedSegments.join('/')}/`;
  }

  return `${basePath}${cleanedSegments.join('/')}/`;
};

export const getPortalPathSegments = (pathname = decodeURIComponent(window.location.pathname)) => {
  const basePath = getPortalBasePath();
  if (basePath === '/') {
    return trimSlashes(pathname).split('/').filter(Boolean);
  }

  if (!pathname.startsWith(basePath)) {
    return [];
  }

  return pathname.slice(basePath.length).split('/').filter(Boolean);
};

export const getPortalHomePath = () => {
  return buildPortalPath();
};

export const getPortalLoginPath = () => {
  return buildPortalPath('login');
};

export const getPortalAnonymousValidatePath = () => {
  return buildPortalPath('anonymous-validate');
};

export const getPortalLogoutPath = () => {
  const { projectUuid, isEditMode, isPortalCustomDomain } = getPageOptions();
  if (isPortalCustomDomain && !isEditMode) {
    return buildPortalPath('logout');
  }
  return `${getSiteRoot()}portal-external/logout/${projectUuid}/`;
};

export const getDefaultPortalPublicUrl = () => {
  const { projectUuid } = getPageOptions();
  return `${window.location.origin}${getSiteRoot()}portal/${projectUuid}/`;
};

export const getPortalPublicUrl = () => {
  const { isPortalCustomDomain, portalBaseUrl } = getPageOptions();
  if (isPortalCustomDomain) {
    return `${window.location.origin}${ensureTrailingSlash(portalBaseUrl || '/')}`;
  }
  return getDefaultPortalPublicUrl();
};
