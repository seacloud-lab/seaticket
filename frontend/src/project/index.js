import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import _ from 'lodash';
import i18n from '../_i18n/i18n-seafile-editor';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPE, EVENT_BUS_TYPE, PROJECT_DEFAULT_SETTINGS } from './constants';
import { TICKET_PAGE_SLUG_ID } from './main-panel/tickets/constants';
import { PORTAL_ISSUE_PAGE_SLUG_ID } from './main-panel/portal-issues/constants';
import { KNOWLEDGE_PAGE_SLUG_ID } from './main-panel/knowledge-base/constants';
import { CONNECTION_PAGE_SLUG_ID } from './main-panel/connections/constants';
import { CenteredLoading, toaster } from '../components';
import eventBus from '../utils/event-bus';
import projectAPI from './api/project-api';
import { Utils } from '@/utils/utils';
import { DataProvider } from './hooks';
import { siteRoot } from '@/constants';

import './index.css';

const { projectName, projectUuid, workspaceID, settings: initSettings } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState([BAR_TYPE.CHAT]);
  const [settings, setSettings] = useState({});

  const resetURL = useCallback((isKeepSearch, [bar], ...children) => {
    const { origin, search } = location;
    let url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${bar}/`;
    const validChildren = children.filter(i => i);
    if ((bar === BAR_TYPE.TICKET || bar === BAR_TYPE.CONNECTION || bar === BAR_TYPE.CHAT || bar === BAR_TYPE.KNOWLEDGE || bar === BAR_TYPE.PORTAL_ISSUES) && validChildren.length > 0) {
      url = url + validChildren.join('/') + '/';
    }
    if ((bar === BAR_TYPE.TICKET || bar === BAR_TYPE.MY_TICKET || bar === BAR_TYPE.CONNECTION || bar === BAR_TYPE.KNOWLEDGE || bar === BAR_TYPE.PORTAL_ISSUES) && isKeepSearch) {
      url = url + (search || '');
    }
    history.replaceState(null, null, url);
  }, []);

  const toggleBar = useCallback((newActiveBar) => {
    const activeBarKey = newActiveBar[0];

    if (activeBarKey === 'tickets/substates') {
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_SLUG_ID.SUBSTATES);
    } else if (activeBarKey === 'tickets/types') {
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_SLUG_ID.TYPES);
    }

    // Knowledge page
    if (activeBarKey === BAR_TYPE.KNOWLEDGE) {
      eventBus.dispatch(EVENT_BUS_TYPE.KNOWLEDGE_PAGE, KNOWLEDGE_PAGE_SLUG_ID.ALL);
    } else if (activeBarKey === BAR_TYPE.KNOWLEDGE_TRASH) {
      eventBus.dispatch(EVENT_BUS_TYPE.KNOWLEDGE_PAGE, KNOWLEDGE_PAGE_SLUG_ID.TRASH);
    }

    // Portal issues page
    if (activeBarKey === BAR_TYPE.PORTAL_ISSUES) {
      eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.ALL);
    } else if (activeBarKey === BAR_TYPE.PORTAL_ISSUES_TRASH) {
      eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.TRASH);
    } else if (activeBarKey === BAR_TYPE.PORTAL_ISSUE_TYPES) {
      eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.TYPES);
    } else if (activeBarKey === BAR_TYPE.PORTAL_ISSUE_SUBSTATES) {
      eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES);
    }

    if (activeBar[0] === activeBarKey) {
      if ([BAR_TYPE.SEARCH, BAR_TYPE.SETTINGS, BAR_TYPE.SUPPORT_PORTAL].includes(activeBarKey)) return;
      if (activeBarKey === BAR_TYPE.CHAT && !location.pathname.endsWith('chat/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_PAGE, TICKET_PAGE_SLUG_ID.NEW);
        return;
      }
      if (activeBarKey === BAR_TYPE.TICKET) {
        if (newActiveBar[1]) {
          eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, newActiveBar[1]);
          return;
        }
        if (!location.pathname.endsWith('tickets/')) {
          eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_SLUG_ID.ALL);
        }
        return;
      }
      if (activeBarKey === BAR_TYPE.MY_TICKET) {
        if (!location.pathname.endsWith('my-tickets/')) {
          eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_SLUG_ID.ALL);
        }
        return;
      }
      if (activeBarKey === BAR_TYPE.TRASH) {
        if (!location.pathname.endsWith('trash/')) {
          eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, TICKET_PAGE_SLUG_ID.ALL);
        }
        return;
      }
      if (activeBarKey === BAR_TYPE.CONNECTION) {
        if (!location.pathname.endsWith('connections/') && !newActiveBar[1]) {
          eventBus.dispatch(EVENT_BUS_TYPE.CONNECTION_PAGE, CONNECTION_PAGE_SLUG_ID.ALL);
          setActiveBar(newActiveBar);
          return;
        }
        if (newActiveBar[1]) {
          eventBus.dispatch(EVENT_BUS_TYPE.CONNECTION_PAGE, newActiveBar[1]);
        }
      }
      if (activeBarKey === BAR_TYPE.PORTAL_ISSUES) {
        if (!location.pathname.endsWith('portal-issues/')) {
          eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.ALL);
        }
        return;
      }
    }

    resetURL(false, newActiveBar, newActiveBar[1]);
    setActiveBar(newActiveBar);
  }, [activeBar]);

  const modifyLocalBar = useCallback((newActiveBar) => {
    setActiveBar(newActiveBar);
  }, []);

  const modifySettings = useCallback((update, callback) => {
    return projectAPI.updateProject(workspaceID, projectName, { settings: update }).then(res => {
      setSettings({ ...settings, ...update });
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback({ error });
    });
  }, [settings]);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    let [barKey, ...children] = params;
    let bar = Object.values(BAR_TYPE).includes(barKey) ? barKey : BAR_TYPE.CHAT;
    // Activate the bar when the knowledge trash page refreshes
    if (bar === BAR_TYPE.KNOWLEDGE && children[0] === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      bar = BAR_TYPE.KNOWLEDGE_TRASH;
      children[0] = '';
    }
    // Activate the bar when portal-issues sub-pages refresh
    if (bar === BAR_TYPE.PORTAL_ISSUES && children[0] === PORTAL_ISSUE_PAGE_SLUG_ID.TRASH) {
      bar = BAR_TYPE.PORTAL_ISSUES_TRASH;
      children[0] = '';
    }
    if (bar === BAR_TYPE.PORTAL_ISSUES && children[0] === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
      bar = BAR_TYPE.PORTAL_ISSUE_TYPES;
      children[0] = '';
    }
    if (bar === BAR_TYPE.PORTAL_ISSUES && children[0] === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
      bar = BAR_TYPE.PORTAL_ISSUE_SUBSTATES;
      children[0] = '';
    }
    if (bar === BAR_TYPE.CONNECTION && children[0] && CONNECTION_PAGE_SLUG_ID.ALL !== children[0]) {
      children[0] = Number(children[0]);
    }
    resetURL(true, [bar], ...children);
    setActiveBar([bar, children[0]]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let settings = {};
    if (initSettings) {
      try {
        settings = JSON.parse(initSettings);
      } catch {
        settings = {};
      }
    }
    setSettings(_.merge({}, PROJECT_DEFAULT_SETTINGS, settings));
  }, []);

  return (
    <DataProvider projectUuid={projectUuid} projectName={projectName} workspaceID={workspaceID} enablePortal={settings?.portal?.enable_portal}>
      <I18nextProvider i18n={i18n}>
        <div className="sea-qa-project">
          {isLoading ? (
            <CenteredLoading />
          ) : (
            <>
              <SidePanel activeBar={activeBar} toggleBar={toggleBar} settings={settings} />
              <MainPanel activeBar={activeBar} settings={settings} modifySettings={modifySettings} toggleBar={toggleBar} modifyLocalBar={modifyLocalBar} />
            </>
          )}
        </div>
      </I18nextProvider>
    </DataProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
