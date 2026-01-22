import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon, Logo } from '@/components';
import { BARS } from './constants';

const propTypes = {
  isSidePanelClosed: PropTypes.bool.isRequired,
  onCloseSidePanel: PropTypes.func.isRequired,
  currentTab: PropTypes.string.isRequired,
  tabItemClick: PropTypes.func.isRequired
};

class SidePanel extends React.Component {

  tabItemClick = (tab) => {
    this.props.tabItemClick(tab);
    this.props.onCloseSidePanel();
  };

  render() {
    return (
      <div className={`side-panel ${this.props.isSidePanelClosed ? '' : 'left-zero'}`}>
        <div className="side-panel-north">
          <Logo onCloseSidePanel={this.props.onCloseSidePanel}/>
        </div>
        <div className="side-panel-center">
          <div className="side-nav">
            <div className="side-nav-con">
              <span className="side-nav-title">{gettext('System admin')}</span>
              <ul className="nav nav-pills flex-column nav-container mt-3">
                {BARS.filter(item => item).map(bar => {
                  const { icon, name, value, link, isActive } = bar;
                  return (
                    <li className={classnames('nav-item', { 'active': isActive(this.props.currentTab) })} key={value}>
                      <Link
                        className={classnames('nav-link ellipsis', { 'active': isActive(this.props.currentTab) })}
                        to={link}
                        onClick={() => this.tabItemClick(value)}
                      >
                        <Icon symbol={icon} />
                        <span className="nav-text align-middle">{name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

SidePanel.propTypes = propTypes;

export default SidePanel;
