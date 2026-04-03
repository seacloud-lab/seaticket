import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon, Logo } from '@/components';
import { BARS } from './constants';

const SidePanel = ({
  currentTab,
  isSidePanelClosed,
  onCloseSidePanel,
  tabItemClick,
}) => {
  const onClick = useCallback((tab) => {
    tabItemClick && tabItemClick(tab);
    onCloseSidePanel && onCloseSidePanel();
  }, [tabItemClick, onCloseSidePanel]);

  return (
    <div className={`side-panel ${isSidePanelClosed ? '' : 'left-zero'}`}>
      <div className="side-panel-north">
        <Logo onCloseSidePanel={onCloseSidePanel}/>
      </div>
      <div className="side-panel-center">
        <div className="side-nav">
          <div className="side-nav-con">
            <span className="side-nav-title">{gettext('Admin')}</span>
            <ul className="nav nav-pills flex-column nav-container mt-3">
              {BARS.filter(bar => bar).map(bar => {
                const { icon, name, value, link, href, isExternal, isActive } = bar;
                const active = isActive ? isActive(currentTab) : false;
                return (
                  <li className={classnames('nav-item', { 'active': active })} key={value}>
                    {isExternal ? (
                      <a
                        className={classnames('nav-link ellipsis', { 'active': active })}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon symbol={icon} />
                        <span className="nav-text">{name}</span>
                      </a>
                    ) : (
                      <Link
                        className={classnames('nav-link ellipsis', { 'active': active })}
                        to={link}
                        onClick={() => onClick(value)}
                      >
                        <Icon symbol={icon} />
                        <span className="nav-text">{name}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

SidePanel.propTypes = {
  isSidePanelClosed: PropTypes.bool.isRequired,
  currentTab: PropTypes.string.isRequired,
  onCloseSidePanel: PropTypes.func.isRequired,
  tabItemClick: PropTypes.func.isRequired
};

export default SidePanel;
