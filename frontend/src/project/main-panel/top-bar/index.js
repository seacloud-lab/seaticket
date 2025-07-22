import React, { useMemo } from 'react';
import { name, avatarURL, username } from '../../../constants';
import Account from '../../components/account';

import './index.css';

const TopBar = ({ children }) => {
  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

  return (
    <div className="sea-qa-project-panel-header sea-qa-project-main-panel-header">
      <div className="sea-qa-project-main-panel-header-tip">
        <div className="sea-qa-project-main-panel-header-name">
          {children}
        </div>
      </div>
      <Account user={user} />
    </div>
  );
};

export default TopBar;
