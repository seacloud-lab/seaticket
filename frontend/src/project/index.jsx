import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR } from './constants';

import './index.css';

const Project = () => {
  const [activeBar, setActiveBar] = useState({ key: BAR.SEARCH });

  const toggleBar = useCallback((bar) => {
    if (activeBar?.key === bar.key) return;
    setActiveBar(bar);
  }, [activeBar]);

  return (
    <div className="sea-qa-project">
      <SidePanel activeBar={activeBar} toggleBar={toggleBar} />
      <MainPanel activeBar={activeBar} />
    </div>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
