import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import Logo from '../../components/logo';
import Icon from '../../components/icon';
import { gettext, siteRoot, isPro, isDefaultAdmin, canViewSystemInfo, canManageUser, canManageGroup, canManageExternalLink,
  canViewAdminLog, multiTenancy, multiInstitution, enableGuestInvitation, enableWorkWeixin, canViewAuditLog, otherPermission,
  constanceEnabled, canConfigSystem, enableAbuseReport, canViewStatistic, canManageOrganization, enableAddressBookV2, canManageApp
} from '../../utils/constants';

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

  renderItem = (activeClass, linkTo, iconClass, text, isSvgIcon = false) => {
    return (
      <li className="nav-item">
        <Link
          className={`nav-link ellipsis ${this.getActiveClass(activeClass)}`}
          to={siteRoot + linkTo}
          onClick={() => this.tabItemClick(activeClass)}
        >
          {isSvgIcon ? (
            <Icon symbol={iconClass} />
          ) : (
            <span className={`dtable-font dtable-icon-${iconClass}`} aria-hidden="true"></span>
          )}
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
                {canViewStatistic &&
                  this.renderItem('statistics', 'sys/statistics/users/', 'statistic', gettext('Statistic'))
                }
                {constanceEnabled && canConfigSystem &&
                  this.renderItem('web-settings', 'sys/web-settings/', 'settings', gettext('Settings'))
                }
                {isDefaultAdmin &&
                  this.renderItem('dtables', 'sys/all-dtables/', 'dtable-logo', gettext('Bases'))
                }
                {canManageApp &&
                  this.renderItem('apps', 'sys/all-apps/', 'external-apps', gettext('Apps'), true)
                }
                {isDefaultAdmin &&
                  this.renderItem('forms', 'sys/all-forms/', 'form', gettext('Forms'))
                }
                {canManageUser &&
                  this.renderItem('users', 'sys/users/', 'mine', gettext('Users'))
                }
                {canManageGroup &&
                  this.renderItem('groups', 'sys/groups/', 'groups', gettext('Groups'))
                }
                {isPro && !multiTenancy && isDefaultAdmin && enableAddressBookV2 &&
                  this.renderItem('departments-v2', 'sys/departments-v2/', 'organization', gettext('Departments'))
                }
                {canManageExternalLink &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('externalLinks')}`}
                      to={siteRoot + 'sys/external-links/'}
                      onClick={() => this.tabItemClick('externalLinks')}
                    >
                      <span className="dtable-font dtable-icon-share" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('External links')}</span>
                    </Link>
                  </li>
                }
                {multiTenancy && canManageOrganization &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('organizations')}`}
                      to={siteRoot + 'sys/organizations/'}
                      onClick={() => this.tabItemClick('organizations')}
                    >
                      <span className="dtable-font dtable-icon-organization" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Organizations')}</span>
                    </Link>
                  </li>
                }
                {multiInstitution && isDefaultAdmin &&
                  <li className="nav-item">
                    <a className='nav-link ellipsis' href={siteRoot + 'sys/instadmin/'}>
                      <span className="dtable-font dtable-icon-organizationn" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Institutions')}</span>
                    </a>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('notifications')}`}
                      to={siteRoot + 'sys/notifications/'}
                      onClick={() => this.tabItemClick('notifications')}
                    >
                      <span className="dtable-font dtable-icon-discussion" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Notifications')}</span>
                    </Link>
                  </li>
                }
                {canViewAuditLog &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('auditlogs')}`}
                      to={siteRoot + 'sys/logs/login'}
                      onClick={() => this.props.tabItemClick('auditlogs')}
                    >
                      <Icon symbol="activities"/>
                      <span className="nav-text">{gettext('Audit logs')}</span>
                    </Link>
                  </li>
                }
                {isPro && canViewAdminLog &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('adminLogs')}`}
                      to={siteRoot + 'sys/admin-logs/operation'}
                      onClick={() => this.tabItemClick('adminLogs')}
                    >
                      <span className="dtable-font dtable-icon-admin-op-log" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Admin logs')}</span>
                    </Link>
                  </li>
                }

                {enableGuestInvitation && isDefaultAdmin &&
                  <li className="nav-item">
                    <a className='nav-link ellipsis' href={siteRoot + 'sys/invitationadmin/'}>
                      <span className="dtable-font dtable-icon-invite" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Invitations')}</span>
                    </a>
                  </li>
                }
                {isDefaultAdmin && enableWorkWeixin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('work-weixin')}`}
                      to={siteRoot + 'sys/work-weixin/'}
                      onClick={() => this.tabItemClick('work-weixin')}
                    >
                      <span className="dtable-font dtable-icon-enterprise-wechat" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{'企业微信集成'}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('sys-plugins')}`}
                      to={siteRoot + 'sys/plugins/'}
                      onClick={() => this.tabItemClick('sys-plugins')}
                    >
                      <span className="dtable-font dtable-icon-assembly" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Plugins')}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('notification-rules')}`}
                      to={siteRoot + 'sys/notification-rules/'}
                      onClick={() => this.tabItemClick('notification-rules')}
                    >
                      <span className="dtable-font dtable-icon-rules" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Rules')}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('common-datasets')}`}
                      to={siteRoot + 'sys/common-datasets/'}
                      onClick={() => this.tabItemClick('common-datasets')}
                    >
                      <span className="dtable-font dtable-icon-common-dataset" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Common datasets')}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin && enableAbuseReport &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('abuse-reports')}`}
                      to={siteRoot + 'sys/abuse-reports/'}
                      onClick={() => this.tabItemClick('abuse-reports')}
                    >
                      <span className="dtable-font dtable-icon-abuse-report" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Abuse reports')}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('email-sending-logs')}`}
                      to={siteRoot + 'sys/email-sending-logs/'}
                      onClick={() => this.tabItemClick('email-sending-logs')}
                    >
                      <span className="dtable-font dtable-icon-email" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Email sending logs')}</span>
                    </Link>
                  </li>
                }
                {isDefaultAdmin &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('workflows')}`}
                      to={siteRoot + 'sys/workflows/'}
                      onClick={() => this.tabItemClick('workflows')}
                    >
                      <span className="dtable-font dtable-icon-workflow" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Workflows')}</span>
                    </Link>
                  </li>
                }
                {otherPermission &&
                  <li className="nav-item">
                    <Link
                      className={`nav-link ellipsis ${this.getActiveClass('virus-files')}`}
                      to={siteRoot + 'sys/virus-files/all/'}
                      onClick={() => this.tabItemClick('virus-files')}
                    >
                      <span className="dtable-font dtable-icon-scan-code" aria-hidden="true"></span>
                      <span className="nav-text align-middle">{gettext('Virus scan')}</span>
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
