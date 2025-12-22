import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { CollaboratorsProvider } from '@/sea-metadata';
import i18n from '../_i18n/i18n-seafile-editor';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPE, EVENT_BUS_TYPE } from './constants';
import { TICKET_PAGE_SLUG_ID } from './main-panel/tickets/constants';
import { CONNECTION_PAGE_SLUG_ID } from './main-panel/connections/constants';
import { CenteredLoading, toaster } from '../components';
import eventBus from '../utils/event-bus';
import { ConnectionsProvider } from './main-panel/connections/hooks';
import { AIChatToolsProvider } from './main-panel/ask/hooks';
import projectAPI from './api/project-api';
import { Utils } from '@/utils/utils';
import userAPI from '@/api/user-api';

import './index.css';

const { projectName, projectUuid, workspaceID, settings: initSettings } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState([BAR_TYPE.CHAT]);
  const [settings, setSettings] = useState({});

  const resetURL = useCallback((isKeepSearch, [bar], ...children) => {
    const { origin, search } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${bar}/`;
    const validChildren = children.filter(i => i);
    if ((bar === BAR_TYPE.TICKET || bar === BAR_TYPE.CONNECTION || bar === BAR_TYPE.CHAT || bar === BAR_TYPE.KNOWLEDGE) && validChildren.length > 0) {
      url = url + validChildren.join('/') + '/';
    }
    if ((bar === BAR_TYPE.TICKET || bar === BAR_TYPE.MY_TICKET || bar === BAR_TYPE.CONNECTION || bar === BAR_TYPE.KNOWLEDGE) && isKeepSearch) {
      url = url + (search || '');
    }
    history.replaceState(null, null, url);
  }, []);

  const toggleBar = useCallback((newActiveBar) => {
    const activeBarKey = newActiveBar[0];
    if (activeBar[0] === activeBarKey) {
      if ([BAR_TYPE.SEARCH, BAR_TYPE.SETTINGS].includes(activeBarKey)) return;
      if (activeBarKey === BAR_TYPE.CHAT && !location.pathname.endsWith('chat/')) {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_PAGE, TICKET_PAGE_SLUG_ID.NEW);
        return;
      }
      if (activeBarKey === BAR_TYPE.TICKET) {
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
    }

    resetURL(false, newActiveBar, newActiveBar[1]);
    setActiveBar(newActiveBar);
  }, [activeBar]);

  const modifyLocalBar = useCallback((newActiveBar) => {
    setActiveBar(newActiveBar);
  }, []);

  const modifySettings = useCallback((update, callback) => {
    projectAPI.updateProject(workspaceID, projectName, { settings: update }).then(res => {
      setSettings({ ...settings, ...update });
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback({ error });
    });
  }, [settings]);

  const listUserInfo = useCallback((...params) => {
    return userAPI.listUserInfo(...params);
  }, []);

  const getCollaborators = useCallback(() => {
    return projectAPI.listProjectRelatedUsers(projectUuid);
  }, []);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [barKey, ...children] = params;
    const bar = Object.values(BAR_TYPE).includes(barKey) ? barKey : BAR_TYPE.CHAT;
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
    setSettings(settings);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="sea-qa-project">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <CollaboratorsProvider listUserInfo={listUserInfo} getCollaborators={getCollaborators}>
            <AIChatToolsProvider >
              <ConnectionsProvider projectUuid={projectUuid} >
                <SidePanel activeBar={activeBar} toggleBar={toggleBar} />
                <MainPanel activeBar={activeBar} settings={settings} modifySettings={modifySettings} toggleBar={toggleBar} modifyLocalBar={modifyLocalBar} />
              </ConnectionsProvider>
            </AIChatToolsProvider>
          </CollaboratorsProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
