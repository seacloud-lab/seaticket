import React from 'react';

import './index.css';

const SettingsSection = ({ title, children }) => {
  return (
    <>
      <div className="sea-qa-section-settings">{title}</div>
      {children}
    </>
  );
};

export default SettingsSection;
