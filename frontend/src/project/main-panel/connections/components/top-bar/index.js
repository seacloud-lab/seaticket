import React, { useCallback } from 'react';
import BasicTopBar from '../../../top-bar';
import { useConnectionsPage } from '../../hooks';
import { CONNECTION_PAGE_TYPE } from '../../constants';
import { IconButton } from '@/components';

import './index.css';

const TopBar = ({ title }) => {
  const { pageType, pageName, togglePageType } = useConnectionsPage();

  const renderLeftChildren = useCallback(() => {
    if (pageType === CONNECTION_PAGE_TYPE.ALL) {
      return (
        <div className="w-100 text-truncate">{title}</div>
      );
    }

    const toggleBtn = (
      <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-connections-btn" onClick={() => togglePageType(CONNECTION_PAGE_TYPE.ALL)} />
    );

    return (
      <>
        {toggleBtn}
        <span className="text-truncate" title={pageName}>{pageName}</span>
      </>
    );
  }, [pageType, title, pageName, togglePageType]);
  return (
    <BasicTopBar>
      {renderLeftChildren()}
    </BasicTopBar>
  );
};

export default TopBar;
