import React, { useCallback, useEffect, useRef } from 'react';
import ResizeBar from '../../components/resize-bar';
import Header from './header';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '../constants';
import Nav from './nav';
import ConnectionsNav from './nav/connections-nav';
import TicketsMoreNav from './nav/tickets-more-nav';
import KnowledgeMoreNav from './nav/knowledge-more-nav';
import DefaultMoreNav from './nav/default-more-nav';
import InboxNav from './nav/inbox-nav';
import { gettext } from '@/constants';

import './index.css';

const INIT_SIDEBAR_WIDTH = 300;
const { isProjectAdmin } = window.app.pageOptions;

const SidePanel = ({ activeBar, toggleBar, settings }) => {
  const ref = useRef(null);

  const onResize = useCallback((width) => {
    localStorage.setItem('project_panel_width', width);
    ref.current.style.width = `${width}px`;
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
      <div className="sea-qa-project-side-panel" ref={ref}>
        <div className="sea-qa-project-side-panel-container">
          <Header />
          <div className="sea-qa-project-navigation sea-qa-nav-list">
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.CHAT]} {...commonProps} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.AGENT]} {...commonProps} />
            <ConnectionsNav nav={BAR_TYPE_CONFIG[BAR_TYPE.CONNECTION]} {...commonProps} />
            <InboxNav nav={BAR_TYPE_CONFIG[BAR_TYPE.INBOX]} level={1} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.ANALYZE]} {...commonProps} />
            {settings?.portal?.enable_portal && (
              <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SUPPORT_PORTAL]} {...commonProps} />
            )}
            {isProjectAdmin &&
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SETTINGS]} {...commonProps} />
            }
            <DefaultMoreNav onClick={toggleBar} />
            <div className="sea-qa-project-side-panel-subtitle">{gettext('Tickets')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.TICKET]} {...commonProps} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.MY_TICKET]} {...commonProps} />
            <TicketsMoreNav onClick={toggleBar} />
            <div className="sea-qa-project-side-panel-subtitle">{gettext('Documents')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE]} {...commonProps} />
            <KnowledgeMoreNav { ...commonProps } />
          </div>
        </div>
        <ResizeBar min={200} max={600} onResize={onResize} />
      </div>
    </>
  );
};

export default SidePanel;
