import React, { useCallback, useEffect, useRef } from 'react';
import NodeGroup from './node-group';
import ResizeBar from '../../components/resize-bar';
import Header from './header';

import './index.css';

const INIT_SIDEBAR_WIDTH = 300;

const SidePanel = ({ bars, activeBar, toggleBar }) => {

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
      <div className="sea-qa-project-side-panel-container">
        <Header />
        <div className="sea-qa-project-navigation">
          {bars.map(node => (
            <NodeGroup
              key={node.key}
              node={node}
              activeNode={activeBar}
              toggleNode={toggleBar}
            />
          ))}
        </div>
      </div>
      <ResizeBar min={200} max={600} onResize={onResize} />
    </div>
  );
};

export default SidePanel;
