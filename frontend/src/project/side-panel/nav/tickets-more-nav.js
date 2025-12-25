import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Icon, IconButton } from '../../../components';
import { BAR_TYPES } from '../../constants';
import Nav from '../nav';

import './index.css';

const TicketsMoreNav = ({ activeBar, onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);

  const toggleShowChildren = useCallback((event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren]);

  return (
    <>
      <div
        className={classnames('sea-qa-project-navigation-item')}
        style={{ paddingLeft: 8 }}
      >
        <Icon symbol={'more'} className="sea-qa-project-navigation-item-icon" />
        <span className="sea-qa-project-navigation-item-name">{window.gettext('More')}</span>
        <IconButton icon="down" className={classnames({ 'rotate-icon-90': !isShowChildren })} onClick={toggleShowChildren} />
      </div>
      <div
        className={classnames('w-100 o-hidden', { 'side-panel-slide': isShowChildren, 'side-panel-slide-up': !isShowChildren })}
        style={{ height: isShowChildren ? 4 * 32 : 0, opacity: isShowChildren ? 1 : 0 }}
      >
        <Nav nav={BAR_TYPES[8]} activeBar={activeBar} level={2} onClick={onClick} />
        <Nav nav={BAR_TYPES[9]} activeBar={activeBar} level={2} onClick={onClick} />
        <Nav nav={BAR_TYPES[10]} activeBar={activeBar} level={2} onClick={onClick} />
        <Nav nav={BAR_TYPES[11]} activeBar={activeBar} level={2} onClick={onClick} />
      </div>
    </>
  );
};

export default TicketsMoreNav;
