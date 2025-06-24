import React, { useCallback, useEffect, useRef } from 'react';
import Tab from './tab';
import ResizeBar from '../../components/resize-bar';

import './index.css';

const INIT_SIDEBAR_WIDTH = 300;

const SidePanel = ({ tabs, activeTab, toggleTab }) => {
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
    <div className="sea-qa-project-side-panel" ref={ref}>
      <div className="sea-qa-project-navigation">
        {tabs.map(tabGroup => (<Tab key={tabGroup.key} tab={tabGroup} activeTab={activeTab} toggleTab={toggleTab} />))}
      </div>
      <ResizeBar min={200} max={600} onResize={onResize} />
    </div>
  );
};

export default SidePanel;
