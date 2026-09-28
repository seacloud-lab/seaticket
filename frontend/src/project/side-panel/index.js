import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import CustomModalHeader from '@/components/modal-header';
import { gettext, mediaUrl } from '@/constants';
import { PortalSettingsProvider } from '@/portal/hooks';
import Settings from '@/portal/main-panel/settings';
import ResizeBar from '../../components/resize-bar';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '../constants';
import Header from './header';
import Nav from './nav';
import ConnectionsNav from './nav/connections-nav';
import DefaultMoreNav from './nav/default-more-nav';
import InboxNav from './nav/inbox-nav';
import KnowledgeMoreNav from './nav/knowledge-more-nav';
import PortalIssuesMoreNav from './nav/portal-issues-more-nav';
import TicketsMoreNav from './nav/tickets-more-nav';

import './index.css';
import '@/portal/left-bar/portal-settings-dialog.css';

const INIT_SIDEBAR_WIDTH = 300;
const { isProjectAdmin } = window.app.pageOptions;

const SidePanel = ({ activeBar, toggleBar, settings }) => {
  const ref = useRef(null);
  const [isShowPortalSettings, setIsShowPortalSettings] = useState(false);

  const onResize = useCallback((width) => {
    localStorage.setItem('project_panel_width', width);
    ref.current.style.width = `${width}px`;
  }, []);

  const closePortalSettings = useCallback(() => {
    setIsShowPortalSettings(false);
  }, []);

  const openPortalSettings = useCallback(() => {
    setIsShowPortalSettings(true);
  }, []);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_panel_width') || INIT_SIDEBAR_WIDTH);
    ref.current.style.width = `${width}px`;
  }, []);

  const commonProps = {
    activeBar: activeBar,
    level: 1,
    onClick: toggleBar
  };

  return (
    <>
      <div className="seaqa-project-side-panel" ref={ref}>
        <div className="seaqa-project-side-panel-container">
          <Header />
          <div className="seaqa-project-navigation seaqa-nav-list">
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.CHAT]} {...commonProps} />
            {settings?.agent?.enabled && <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.AGENT]} {...commonProps} />}
            <ConnectionsNav nav={BAR_TYPE_CONFIG[BAR_TYPE.CONNECTION]} {...commonProps} />
            <InboxNav nav={BAR_TYPE_CONFIG[BAR_TYPE.INBOX]} level={1} />
            {isProjectAdmin &&
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SKILLS]} {...commonProps} />
            }
            {isProjectAdmin &&
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SETTINGS]} {...commonProps} />
            }
            <DefaultMoreNav onClick={toggleBar} />
            <div className="seaqa-project-side-panel-subtitle">{gettext('Tickets')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.TICKET]} {...commonProps} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.MY_TICKET]} {...commonProps} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.NEW_TICKET]} {...commonProps} />
            <TicketsMoreNav onClick={toggleBar} />
            <div className="seaqa-project-side-panel-subtitle">{gettext('Documents')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE]} {...commonProps} />
            <KnowledgeMoreNav { ...commonProps } />
            {settings?.portal?.enable_portal && (
              <>
                <div className="seaqa-project-side-panel-subtitle">{gettext('Support portal')}</div>
                <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SUPPORT_PORTAL]} {...commonProps} />
                <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_ISSUES]} {...commonProps} />
                {isProjectAdmin && <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_CUSTOMERS_AND_USERS]} {...commonProps} />}
                {isProjectAdmin && <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.PORTAL_SETTINGS]} {...commonProps} onClick={openPortalSettings} />}
                <PortalIssuesMoreNav onClick={toggleBar} isProjectAdmin={isProjectAdmin} />
              </>
            )}
          </div>
        </div>
        <ResizeBar min={200} max={600} onResize={onResize} />
      </div>
      {isShowPortalSettings && (
        <Modal isOpen={true} toggle={closePortalSettings} className="portal-settings-dialog">
          <CustomModalHeader toggle={closePortalSettings}>{gettext('Settings')}</CustomModalHeader>
          <ModalBody>
            <PortalSettingsProvider
              projectUuid={window.app.pageOptions.projectUuid}
              name={window.app.pageOptions.portalName || gettext('Support portal')}
              logo={window.app.pageOptions.portalLogo || `${mediaUrl}img/portal-logo.png`}
              syncPageMetadata={false}
            >
              <Settings />
            </PortalSettingsProvider>
          </ModalBody>
        </Modal>
      )}
    </>
  );
};

export default SidePanel;
