import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { gettext, mediaUrl } from '@/constants';
import { PortalFeaturedArticlesProvider } from './hooks';
import PasswordPanel from './password-panel';
import Portal from './portal';

const { projectUuid, needPassword, csrfToken, projectName, portalName, portalLogo } = window.app.pageOptions;

const PortalEntry = () => {
  useEffect(() => {
    const displayName = portalName || gettext('Support portal');
    document.title = `${displayName} - ${gettext('Portal')}`;
    const logo = portalLogo || `${mediaUrl}img/portal-logo.png`;
    const existingFavicon = document.querySelector('link[rel~="icon"]');
    if (existingFavicon) {
      existingFavicon.href = logo;
    }
  }, []);

  if (needPassword) {
    return <PasswordPanel displayName={portalName || projectName} csrfToken={csrfToken} />;
  }

  return (
    <PortalFeaturedArticlesProvider projectUuid={projectUuid}>
      <Portal />
    </PortalFeaturedArticlesProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<PortalEntry />);
