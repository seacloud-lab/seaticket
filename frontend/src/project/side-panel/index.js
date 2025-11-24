import React, { useCallback, useEffect, useRef } from 'react';
import ResizeBar from '../../components/resize-bar';
import Header from './header';
import { BAR_TYPES } from '../constants';
import Nav from './nav';
import ConnectionsNav from './nav/connections-nav';

import './index.css';

const INIT_SIDEBAR_WIDTH = 300;
const { isProjectAdmin } = window.app.pageOptions;

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
            <Nav nav={BAR_TYPES[0]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPES[1]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <ConnectionsNav nav={BAR_TYPES[2]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPES[3]} activeBar={activeBar} level={1} onClick={toggleBar} />
            {isProjectAdmin && (
              <Nav nav={BAR_TYPES[4]} activeBar={activeBar} level={1} onClick={toggleBar} />
            )}
            <div className="sea-qa-project-side-panel-subtitle">{window.gettext('Tickets')}</div>
            <Nav nav={BAR_TYPES[5]} activeBar={activeBar} level={1} onClick={toggleBar} />
            <Nav nav={BAR_TYPES[6]} activeBar={activeBar} level={1} onClick={toggleBar} />
          </div>
        </div>
        <ResizeBar min={200} max={600} onResize={onResize} />
      </div>
    </>
  );
};

export default SidePanel;
