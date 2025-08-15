import React from 'react';
import './index.css';

const TopBar = ({ children }) => {
  return (
    <div className="sea-qa-project-panel-header sea-qa-project-main-panel-header">
      <div className="sea-qa-project-main-panel-header-left">
        <div className="sea-qa-project-main-panel-header-name">
          {children[0]}
        </div>
      </div>
      {children[1] && (
        <div className="sea-qa-project-main-panel-header-right">
          {children[1]}
        </div>
      )}
    </div>
  );
};

export default TopBar;
