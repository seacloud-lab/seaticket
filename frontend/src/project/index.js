import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../_i18n/i18n-seafile-editor';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPES, BAR_TYPE, EVENT_BUS_TYPE, TICKET_PAGE_TYPE, CONNECTION_PAGE_TYPE } from './constants';
import { CenteredLoading } from '../components';
import eventBus from '../utils/event-bus';

import './index.css';

const { projectName, workspaceID } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState(BAR_TYPES[0]);

  const bars = useMemo(() => [
    {
      key: '_',
      name: '',
      children: BAR_TYPES
    }
  ], []);

  const resetURL = useCallback((bar, ...children) => {
    const { origin, search } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${bar.key}/`;
    const validChildren = children.filter(i => i);
    if ((bar.key === BAR_TYPE.TICKET || bar.key === BAR_TYPE.CONNECTION) && validChildren.length > 0) {
      url = url + validChildren.join('/') + '/';
    }
    if (bar.key === BAR_TYPE.TICKET) {
      url = url + (search || '');
    }
    history.replaceState(null, null, url);
  }, []);

  const toggleBar = useCallback((bar) => {
    if (activeBar?.key === bar.key) {
      if (bar.key === BAR_TYPE.TICKET && !location.pathname.endsWith('ticket/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_TYPE.ALL);
      }
      if (bar.key === BAR_TYPE.CONNECTION && !location.pathname.endsWith('connections/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.CONNECTION_PAGE, CONNECTION_PAGE_TYPE.ALL);
      }
      return;
    }
    resetURL(bar);
    setActiveBar(bar);
  }, [activeBar]);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [barKey, ...children] = params;
    const bar = BAR_TYPES.find(b => b.key === barKey) || BAR_TYPES[0];
    resetURL(bar, ...children);
    setActiveBar(bar);
    setLoading(false);
  }, []);

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
