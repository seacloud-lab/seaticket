import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Icon, IconButton } from '../../../components';
import { useConnections } from '@/project/main-panel/connections/hooks';
import ConnectionNav from './connection-nav';
import { NAVIGATION_BASE_PADDING, NAVIGATION_LEVEL_INDENT } from '@/constants';

import './index.css';

const ConnectionsNav = ({ nav, level, activeBar, onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);
  const { connections, reloadConnections } = useConnections();

  const toggleShowChildren = useCallback((event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    if (!isShowChildren) {
      reloadConnections();
    }
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren, reloadConnections]);

  const toggleConnectionView = useCallback((connectionId) => {
    onClick([nav.key, connectionId]);
  }, [nav, onClick]);

  const { key, name, icon } = nav;
  let isActive = activeBar[0] === key;
  if (isActive && isShowChildren && activeBar[1]) {
    isActive = connections.find(c => c.id === String(activeBar[1])) ? true : false;
  }

  return (
    <>
      <div
        className={classnames('seaqa-project-navigation-item', {
          'seaqa-project-navigation-item-active': isActive,
        })}
        style={{ paddingLeft: level > 1 ? (level - 1) * NAVIGATION_LEVEL_INDENT + NAVIGATION_BASE_PADDING : NAVIGATION_BASE_PADDING }}
        onClick={() => onClick([nav.key])}
        title={name}
      >
        {icon && (<Icon symbol={icon} className="seaqa-project-navigation-item-icon" />)}
        <span className="seaqa-project-navigation-item-name">{name}</span>
        <IconButton icon="arrow-down-b" className={classnames('', { 'rotate-icon-90': !isShowChildren })} onClick={toggleShowChildren} />
      </div>
      <div
        className={classnames('w-100 o-hidden', { 'side-panel-slide': isShowChildren, 'side-panel-slide-up': !isShowChildren })}
        style={{ height: isShowChildren ? connections.length * 32 : 0, opacity: isShowChildren ? 1 : 0 }}
      >
        {connections.map(connection => {
          return (
            <ConnectionNav
              key={connection.id}
              nav={connection}
              activeBar={activeBar}
              level={2}
              onClick={toggleConnectionView}
            />
          );
        })}
      </div>
    </>
  );
};

export default ConnectionsNav;
