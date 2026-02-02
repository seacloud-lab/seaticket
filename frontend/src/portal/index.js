import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../_i18n/i18n-seafile-editor';
import LeftBar from './left-bar';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { CenteredLoading } from '../components';
import { PORTAL_PAGE } from './constants';
import { DataProvider } from '@/project/hooks';
import { portalAPI } from './api';

import './index.css';

const { projectUuid, isEditMode, showKBInPortal } = window.app.pageOptions;

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(PORTAL_PAGE.SUBMIT_TICKET);
  const [enableKB, setEnableKB] = useState(showKBInPortal === true);

  const onPageChange = useCallback((page) => {
    setActivePage(page);
    const { origin } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const url = `${origin}/${basePath}/${projectUuid}/${page}/`;
    history.replaceState(null, null, url);
  }, []);

  useEffect(() => {
    const { pathname } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const regex = new RegExp(`/${basePath}/${projectUuid}/([^/]*)`);
    const match = pathname.match(regex);
    if (match && match[1]) {
      const pageKey = match[1];
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        setActivePage(pageKey);
      }
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    const handler = (e) => setEnableKB(!!(e.detail && e.detail.enabled));
    window.addEventListener('portal:kb-visibility', handler);
    return () => window.removeEventListener('portal:kb-visibility', handler);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <DataProvider projectUuid={projectUuid} api={portalAPI}>
        <div className="sea-qa-portal">
          {isLoading ? (
            <CenteredLoading />
          ) : (
            <>
              {isEditMode && <LeftBar />}
              <SidePanel activePage={activePage} onPageChange={onPageChange} enableKB={enableKB} />
              <MainPanel activePage={activePage} projectUuid={projectUuid} onPageChange={onPageChange} />
            </>
          )}
        </div>
      </DataProvider>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Portal />);
