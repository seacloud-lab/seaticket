import React, { useCallback, useEffect, useRef } from 'react';
import ResizeBar from '../../components/resize-bar';
import Header from './header';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '../constants';
import Nav from './nav';
import ConnectionsNav from './nav/connections-nav';
import TicketsMoreNav from './nav/tickets-more-nav';

import './index.css';

const INIT_SIDEBAR_WIDTH = 300;

const SidePanel = ({ activeBar, toggleBar }) => {
  const ref = useRef(null);

  const onResize = useCallback((width) => {
    localStorage.setItem('project_panel_width', width);
    ref.current.style.width = `${width}px`;
  }, []);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem('project_panel_width') || INIT_SIDEBAR_WIDTH);
    ref.current.style.width = `${width}px`;
  }, []);

  return (
    <>
      <div className="sea-qa-project-side-panel" ref={ref}>
        <div className="sea-qa-project-side-panel-container">
          <Header />
          <div className="sea-qa-project-navigation sea-qa-nav-list">
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.CHAT]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SEARCH]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <ConnectionsNav nav={BAR_TYPE_CONFIG[BAR_TYPE.CONNECTION]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.SETTINGS]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.EXTERNAL_PORTAL]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.ANALYZE]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <div className="sea-qa-project-side-panel-subtitle">{window.gettext('Tickets')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.TICKET]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.MY_TICKET]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <TicketsMoreNav onClick={toggleBar} />
            <div className="sea-qa-project-side-panel-subtitle">{window.gettext('Documents')}</div>
            <Nav nav={BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE]} activeBar={activeBar} level={1} onClick={toggleBar} />
          </div>
        </div>
        <ResizeBar min={200} max={600} onResize={onResize} />
      </div>
    </>
  );
};

export default SidePanel;
