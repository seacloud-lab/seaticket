import React from 'react';
import classnames from 'classnames';

import './index.css';

const SettingsItem = ({ title, className, children }) => {
  return (
    <div className={classnames('seaqa-project-settings-item w-100', className)}>
      <div className="seaqa-project-settings-item-header text-truncate w-100">
        {title}
      </div>
      <div className="seaqa-project-settings-item-body w-100">
        {children}
      </div>
    </div>
  );
};

export default SettingsItem;
