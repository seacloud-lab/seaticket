import React, { useCallback } from 'react';
import TopBarShell from '../../top-bar';

const TopBar = ({ title }) => {

  const renderLeftChildren = useCallback(() => {
    return (<span className="text-truncate" title={title}>{title}</span>);
  }, []);

  const renderRightChildren = useCallback(() => {
    return null;
  }, []);

  return (
    <TopBarShell>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBarShell>
  );
};

export default TopBar;
