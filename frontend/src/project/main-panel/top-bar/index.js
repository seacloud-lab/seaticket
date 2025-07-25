import React from 'react';
import './index.css';

const TopBar = ({ children }) => {
  return (
    <div className="sea-qa-project-panel-header sea-qa-project-main-panel-header">
      <div className="sea-qa-project-main-panel-header-tip">
        <div className="sea-qa-project-main-panel-header-name">
          {children}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
