import React from 'react';
import classnames from 'classnames';

import './index.css';

const TopBar = ({ children, className }) => {
  const _className = classnames('sea-qa-project-panel-header sea-qa-project-main-panel-header', className);
  if (!Array.isArray(children)) {
    return (
      <div className={_className}>
        <div className="sea-qa-project-main-panel-header-left">
          <div className="sea-qa-project-main-panel-header-name">
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={_className}>
      <div className="sea-qa-project-main-panel-header-left">
        <div className="sea-qa-project-main-panel-header-name">
          {children[0]}
        </div>
      </div>
      {children[1] && (
        <div className="sea-qa-project-main-panel-header-right d-flex">
          {children[1]}
        </div>
      )}
    </div>
  );
};

export default TopBar;
