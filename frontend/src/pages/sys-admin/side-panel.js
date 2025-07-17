import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import Logo from '../../components/logo';
import Icon from '../../components/icon';
import { gettext, siteRoot, isDefaultAdmin, canViewSystemInfo, canManageUser, canManageGroup, multiTenancy,
  canManageOrganization,
} from '../../constants';

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

  renderItem = (activeClass, linkTo, iconClass, text) => {
    return (
      <li className="nav-item">
        <Link
          className={`nav-link ellipsis ${this.getActiveClass(activeClass)}`}
          to={siteRoot + linkTo}
          onClick={() => this.tabItemClick(activeClass)}
        >
          <Icon symbol={iconClass} />
          <span className="nav-text align-middle">{text}</span>
        </Link>
      </li>
    );
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
              <ul className="nav nav-pills flex-column nav-container mt-2">
                {canViewSystemInfo &&
                  this.renderItem('info', 'sys/info/', 'info', gettext('Info'))
                }
                {isDefaultAdmin &&
                  this.renderItem('projects', 'sys/all-projects/', 'home', gettext('Projects'))
                }
                {canManageUser &&
                  this.renderItem('users', 'sys/users/', 'mine', gettext('Users'))
                }
                {canManageGroup &&
                  this.renderItem('groups', 'sys/groups/', 'groups', gettext('Groups'))
                }
                {multiTenancy && canManageOrganization &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('organizations')}`}
                      to={siteRoot + 'sys/organizations/'}
                      onClick={() => this.tabItemClick('organizations')}
                    >
                      <Icon symbol="organization" aria-hidden="true" />
                      <span className="nav-text align-middle">{gettext('Organizations')}</span>
                    </Link>
                  </li>
                }
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
