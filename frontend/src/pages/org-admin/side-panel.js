import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import Logo from '../../components/logo';
import { gettext, siteRoot } from '../../constants';
import { Icon } from '../../components';


const propTypes = {
  isSidePanelClosed: PropTypes.bool.isRequired,
  onCloseSidePanel: PropTypes.func.isRequired,
  currentTab: PropTypes.string.isRequired,
  tabItemClick: PropTypes.func.isRequired
};

class SidePanel extends React.Component {

  getActiveClass = (tab) => {
    return this.props.currentTab === tab ? 'active' : '';
  };

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
              <span className="side-nav-title">{gettext('Admin')}</span>
              <ul className="nav nav-pills flex-column nav-container mt-2">
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('orgmanage')}`} to={siteRoot + 'org/orgmanage/'} onClick={() => this.tabItemClick('orgmanage')} >
                    <Icon symbol="info" />
                    <span className="nav-text">{gettext('Info')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('settings')}`} to={siteRoot + 'org/settings/'} onClick={() => this.tabItemClick('settings')} >
                    <Icon symbol="settings" />
                    <span className="nav-text">{gettext('Settings')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('users') || this.getActiveClass('admins')}`} to={siteRoot + 'org/useradmin/'} onClick={() => this.tabItemClick('users')} >
                    <Icon symbol="mine" />
                    <span className="nav-text">{gettext('Users')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('projects') || this.getActiveClass('trash')}`} to={siteRoot + 'org/projectadmin/'} onClick={() => this.tabItemClick('projects')}>
                    <Icon symbol="home" />
                    <span className="nav-text">{gettext('Projects')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('groupadmin')}`} to={siteRoot + 'org/groupadmin/'} onClick={() => this.tabItemClick('groupadmin')}>
                    <Icon symbol="groups" />
                    <span className="nav-text">{gettext('Groups')}</span>
                  </Link>
                </li>
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
