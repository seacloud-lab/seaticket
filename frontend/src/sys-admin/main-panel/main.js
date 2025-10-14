import classnames from 'classnames';
import React from 'react';

const Main = ({ className, title, titleClassName, children }) => {

  return (
    <div className={classnames('main-panel-center flex-row', className)}>
      <div className="cur-view-container">
        <div className={classnames('heading main-panel-header', titleClassName)}>{title}</div>
        <div className="cur-view-content container mw-100 px-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Main;
