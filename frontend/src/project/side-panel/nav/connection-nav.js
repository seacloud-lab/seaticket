import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { CONNECTION_TYPES } from '../../main-panel/connections/constants';
import { getConnectionIcon } from '../../main-panel/connections/utils';
import { NAVIGATION_BASE_PADDING, NAVIGATION_LEVEL_INDENT } from '@/constants';

const ConnectionNav = ({ nav, level, activeBar, onClick }) => {
  const { id, type, name } = nav;
  const connectionOption = useMemo(() => CONNECTION_TYPES.find(option => option.type === type), [type]);
  const isActive = useMemo(() => activeBar[1] === id, [activeBar, id]);

  const handleClick = useCallback(() => {
    if (isActive) return;
    onClick?.(id);
  }, [isActive, id, onClick]);

  return (
    <div
      className={classnames('seaqa-project-navigation-item', { 'seaqa-project-navigation-item-active': isActive })}
      style={{ paddingLeft: level > 1 ? (level - 1) * NAVIGATION_LEVEL_INDENT + NAVIGATION_BASE_PADDING : NAVIGATION_BASE_PADDING }}
      onClick={handleClick}
      title={name}
    >
      <img src={getConnectionIcon(type)} alt={connectionOption?.name} className="connection-icon seaqa-project-navigation-item-icon"/>
      <span className="seaqa-project-navigation-item-name">{name}</span>
    </div>
  );
};

export default ConnectionNav;
