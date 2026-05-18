import React from 'react';

import './index.css';

const SettingsSection = ({ title, children }) => {
  return (
    <>
      <div className="seaqa-section-settings">{title}</div>
      {children}
    </>
  );
};

export default SettingsSection;
