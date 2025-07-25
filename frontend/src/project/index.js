import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../_i18n/i18n-seafile-editor';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPES, BAR_TYPE, EVENT_BUS_TYPE, TICKET_PAGE_TYPE } from './constants';
import { CenteredLoading } from '../components';
import eventBus from '../utils/event-bus';

import './index.css';

const { projectName } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState(BAR_TYPES[1]);

  const bars = useMemo(() => [
    {
      key: '_',
      name: '',
      children: BAR_TYPES
    }
  ], []);

  const toggleBar = useCallback((bar) => {
    if (activeBar?.key === bar.key) {
      if (bar.key === BAR_TYPE.TICKET && !location.pathname.endsWith('ticket/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_TYPE.ALL);
      }
      return;
    }
    setActiveBar(bar);
  }, [activeBar]);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const paramsString = decodePathname.slice(projectNameIndex + projectName.length + 1);
    const params = paramsString.split('/');
    const [barKey] = params;
    const bar = BAR_TYPES.find(b => b.key === barKey);
    setActiveBar(bar || BAR_TYPES[1]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!activeBar?.key) return;
    if (isLoading) return;
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length + 1);
    history.replaceState(null, null, origin + newPathname + activeBar.key + '/');
  }, [isLoading, activeBar]);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="sea-qa-project">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <>
            <SidePanel bars={bars} activeBar={activeBar} toggleBar={toggleBar} />
            <MainPanel activeBar={activeBar} />
          </>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
