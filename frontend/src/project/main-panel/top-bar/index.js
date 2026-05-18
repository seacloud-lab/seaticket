import React from 'react';
import classnames from 'classnames';

import './index.css';

const TopBar = ({ children, className }) => {
  const _className = classnames('seaqa-project-panel-header seaqa-project-main-panel-header', className);
  if (!Array.isArray(children)) {
    return (
      <div className={_className}>
        <div className="seaqa-project-main-panel-header-content">
          <div className="seaqa-project-main-panel-header-left">
            <div className="seaqa-project-main-panel-header-name">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={_className}>
      <div className="seaqa-project-main-panel-header-content">
        <div className="seaqa-project-main-panel-header-left">
          <div className="seaqa-project-main-panel-header-name">
            {children[0]}
          </div>
        </div>
        {children[1] && (
          <div className="seaqa-project-main-panel-header-right d-flex">
            {children[1]}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
