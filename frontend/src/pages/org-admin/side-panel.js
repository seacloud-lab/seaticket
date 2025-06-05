import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import Logo from '../../components/logo';
import { gettext, siteRoot, enableSubscription, enableOrgDepartment, enableOrgWorkWeixin, enableOrgDingtalk, orgCorpBindType, enableAddressBookV2, enableMultiSAML, canUseSAML } from '../../utils/constants';
import Icon from '../../components/icon';

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
                    <span className="dtable-font dtable-icon-info"></span>
                    <span className="nav-text">{gettext('Info')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('settings')}`} to={siteRoot + 'org/settings/'} onClick={() => this.tabItemClick('settings')} >
                    <span className="dtable-font dtable-icon-settings"></span>
                    <span className="nav-text">{gettext('Settings')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('users') || this.getActiveClass('admins')}`} to={siteRoot + 'org/useradmin/'} onClick={() => this.tabItemClick('users')} >
                    <span className="dtable-font dtable-icon-mine"></span>
                    <span className="nav-text">{gettext('Users')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('bases') || this.getActiveClass('trash')}`} to={siteRoot + 'org/dtableadmin/'} onClick={() => this.tabItemClick('bases')}>
                    <span className="dtable-font dtable-icon-dtable-logo"></span>
                    <span className="nav-text">{gettext('Bases')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('dtablelinkex') || this.getActiveClass('viewlinkex')}`} to={siteRoot + 'org/external-link/'} onClick={() => this.tabItemClick('dtablelinkex')}>
                    <span className="dtable-font dtable-icon-share"></span>
                    <span className="nav-text">{gettext('External links')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('groupadmin')}`} to={siteRoot + 'org/groupadmin/'} onClick={() => this.tabItemClick('groupadmin')}>
                    <span className="dtable-font dtable-icon-groups"></span>
                    <span className="nav-text">{gettext('Groups')}</span>
                  </Link>
                </li>
                {enableOrgDepartment && enableAddressBookV2 &&
                  <li className="nav-item">
                    <Link className={`nav-link ellipsis ${this.getActiveClass('departmentadmin-v2')}`} to={siteRoot + 'org/departmentadmin-v2/'} onClick={() => this.tabItemClick('departmentadmin-v2')} >
                      <span className="dtable-font dtable-icon-organization"></span>
                      <span className="nav-text">{gettext('Departments')}</span>
                    </Link>
                  </li>
                }
                {enableSubscription &&
                  <li className="nav-item">
                    <Link className={`nav-link ellipsis ${this.getActiveClass('subscription')}`} to={siteRoot + 'org/subscription/'} onClick={() => this.tabItemClick('subscription')} >
                      <span className="dtable-font dtable-icon-currency"></span>
                      <span className="nav-text">{'付费管理'}</span>
                    </Link>
                  </li>
                }
                {(enableOrgWorkWeixin && orgCorpBindType !== 'org-dingtalk') &&
                  <li className="nav-item">
                    <Link className={`nav-link ellipsis ${this.getActiveClass('work-weixin')}`} to={siteRoot + 'org/work-weixin/'} onClick={() => this.tabItemClick('work-weixin')} >
                      <span className="dtable-font dtable-icon-enterprise-wechat"></span>
                      <span className="nav-text">{'企业微信集成'}</span>
                    </Link>
                  </li>
                }
                {(enableOrgDingtalk && orgCorpBindType !== 'org-work-weixin') &&
                  <li className="nav-item">
                    <Link className={`nav-link ellipsis ${this.getActiveClass('dingtalk')}`} to={siteRoot + 'org/dingtalk/'} onClick={() => this.tabItemClick('dingtalk')} >
                      <span className="dtable-font dtable-icon-dingtalk"></span>
                      <span className="nav-text">{'钉钉集成'}</span>
                    </Link>
                  </li>
                }
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('auditlogs')}`} to={siteRoot + 'org/login-logs/'} onClick={() => this.tabItemClick('auditlogs')}>
                    <Icon symbol="activities"/>
                    <span className="nav-text">{gettext('Audit logs')}</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ellipsis ${this.getActiveClass('adminlogs')}`} to={siteRoot + 'org/admin-logs/operation/'} onClick={() => this.tabItemClick('adminlogs')}>
                    <span className="dtable-font dtable-icon-admin-op-log"></span>
                    <span className="nav-text">{gettext('Admin logs')}</span>
                  </Link>
                </li>
                {enableMultiSAML && canUseSAML &&
                  <li className="nav-item">
                    <Link className={`nav-link ellipsis ${this.getActiveClass('SAML config')}`} to={siteRoot + 'org/saml-config/'} onClick={() => this.tabItemClick('SAML config')} >
                      <span className="dtable-font dtable-icon-settings"></span>
                      <span className="nav-text">{gettext('SAML config')}</span>
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
