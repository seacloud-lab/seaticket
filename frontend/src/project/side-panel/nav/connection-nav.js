import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPES, SUPPORT_DETAILS_CONNECTION_TYPES } from '../../main-panel/connections/constants';

const ConnectionNav = ({ nav, level, activeBar, onClick }) => {

  const connectionOption = useMemo(() => {
    const { type } = nav;
    return CONNECTION_TYPES.find(c => c.type === type);
  }, [nav]);

  const isActive = useMemo(() => {
    const { id } = nav;
    return activeBar[1] === String(id);
  }, [activeBar, nav]);

  const handleClick = useCallback((type) => {
    if (isActive) return;
    const { id } = nav;
    if (!SUPPORT_DETAILS_CONNECTION_TYPES.includes(type)) return;
    onClick && onClick(id);
  }, [isActive, nav, onClick]);

  const { name } = nav;

  return (
    <div
      className={classnames('sea-qa-project-navigation-item', {
        'sea-qa-project-navigation-item-active': isActive,
      })}
      style={{ paddingLeft: level > 1 ? (level - 1) * 20 + 8 : 8 }}
      onClick={() => handleClick(connectionOption.type)}
      title={name}
    >
      <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="connection-icon sea-qa-project-navigation-item-icon" />
      <span className="sea-qa-project-navigation-item-name">{name}</span>
    </div>
  );
};

export default ConnectionNav;
