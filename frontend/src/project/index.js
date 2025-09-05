import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../_i18n/i18n-seafile-editor';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPE, EVENT_BUS_TYPE } from './constants';
import { TICKET_PAGE_TYPE } from './main-panel/tickets/constants';
import { CONNECTION_PAGE_TYPE } from './main-panel/connections/constants';
import { CenteredLoading } from '../components';
import eventBus from '../utils/event-bus';
import { ConnectionsProvider } from './main-panel/connections/hooks';

import './index.css';

const { projectName, projectUuid, workspaceID } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState([BAR_TYPE.ASK]);

  const resetURL = useCallback(([bar], ...children) => {
    const { origin, search } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${bar}/`;
    const validChildren = children.filter(i => i);
    if ((bar === BAR_TYPE.TICKET || bar === BAR_TYPE.CONNECTION || bar === BAR_TYPE.ASK) && validChildren.length > 0) {
      url = url + validChildren.join('/') + '/';
    }
    if (bar === BAR_TYPE.TICKET || bar === BAR_TYPE.CONNECTION) {
      url = url + (search || '');
    }
    history.replaceState(null, null, url);
  }, []);

  const toggleBar = useCallback((newActiveBar) => {
    const activeBarKey = newActiveBar[0];
    if (activeBar[0] === activeBarKey) {
      if ([BAR_TYPE.SEARCH].includes(activeBarKey)) return;
      if (activeBarKey === BAR_TYPE.ASK && !location.pathname.endsWith('ask/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_PAGE, TICKET_PAGE_TYPE.NEW);
        return;
      }
      if (activeBarKey === BAR_TYPE.TICKET && !location.pathname.endsWith('tickets/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_TYPE.ALL);
        return;
      }
      if (activeBarKey === BAR_TYPE.CONNECTION) {
        if (!location.pathname.endsWith('connections/') && !newActiveBar[1]) {
          eventBus.dispatch(EVENT_BUS_TYPE.CONNECTION_PAGE, CONNECTION_PAGE_TYPE.ALL);
          setActiveBar(newActiveBar);
          return;
        }
        if (newActiveBar[1]) {
          eventBus.dispatch(EVENT_BUS_TYPE.CONNECTION_PAGE, newActiveBar[1]);
        }
      }
    }

    resetURL(newActiveBar, newActiveBar[1]);
    setActiveBar(newActiveBar);
  }, [activeBar]);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [barKey, ...children] = params;
    const bar = Object.values(BAR_TYPE).includes(barKey) ? barKey : BAR_TYPE.ASK;
    resetURL([bar], ...children);
    setActiveBar([bar, children[0]]);
    setLoading(false);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="sea-qa-project">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <ConnectionsProvider projectUuid={projectUuid} >
            <SidePanel activeBar={activeBar} toggleBar={toggleBar} />
            <MainPanel activeBar={activeBar} />
          </ConnectionsProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
