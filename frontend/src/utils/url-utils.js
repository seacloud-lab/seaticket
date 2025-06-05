import { siteRoot } from './constants';

export const generateBaseImageThumbnailUrl = ({ workspaceId, dtableUuid, partUrl, size = 256 }) => {
  if (!partUrl) return '';
  return `${siteRoot}thumbnail/workspace/${workspaceId}/asset/${dtableUuid}${partUrl}?size=${size}`;
};

export const isDigitalSignsUrl = (url) => {
  return url && url.includes('/digital-signs/') && !url.includes('http');
};
