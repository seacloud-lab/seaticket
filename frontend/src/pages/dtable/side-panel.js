import React from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import isHotkey from 'is-hotkey';
import { Link } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { helpLink, cloudMode, isOrgContext, showWechatSupportGroup, showTemplatesLink, seatableMarketUrl,
  mediaUrl, logoPath, logoWidth, logoHeight, siteTitle, enableUserGuide, enableOrgCommonDataset,
  enableTellAFriend, friendInvitationLink, enableInviteAFriend, customNavItems, enableUniversalApp,
  isPro, enableAddressBookV2, enableDepartmentAdminManageMemberBases,
} from '../../utils/constants';
import WechatDialog from './dialog/wechat-dialog';
import { Utils } from '../../utils/utils';
import { dtableWebAPI } from '../../api/dtable-web-api';
import html5DragDropContext from '../../utils/html5DragDropContext';
import { isWorkWeixin } from '../../components-form/utils/weixin-utils';
import SidePanelGroupItem from './side-panel-group-item';
import Icon from '../../components/icon';
import { isDingTalkBuiltInBrowser } from '../../components-form/utils/utils';

const gettext = window.gettext;
const siteRoot = window.app.config.siteRoot;

const propTypes = {
  isUpdateSidePanelGroups: PropTypes.bool,
  isOpenGroupExpanded: PropTypes.bool,
  isSidePanelClosed: PropTypes.bool.isRequired,
  currentTab: PropTypes.string.isRequired,
  onTabClick: PropTypes.func.isRequired,
  onCloseSidePanel: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func,
  toggleGroupExpanded: PropTypes.func,
  showWorkflow: PropTypes.bool.isRequired,
  isDesktop: PropTypes.bool.isRequired,
};

const GROUP_ITEM_HEIGHT = 28;

class SidePanel extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowWechatDialog: false,
      isDataLoading: true,
      isExpandedMoreList: this.props.currentTab.includes('more/'),
      workspaceList: [],
      groupItems: []
    };
    this.groupsHeight = 0;
    this.moreHeight = 1 * GROUP_ITEM_HEIGHT; // 1 is data sync
    this.workflowsHeight = 4 * GROUP_ITEM_HEIGHT;
    this.isDesktop = Utils.isDesktop();
    this.isWorkWeixin = isWorkWeixin(window.navigator.userAgent.toLowerCase());
  }

  componentDidMount() {
    this.initTableData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isUpdateSidePanelGroups) {
      this.initTableData();
      this.props.updateSidePanelGroups(false);
    }
  }

  async initTableData() {
    try {
      let workspaceData = await dtableWebAPI.listWorkspaces(false);
      let workspaceList = workspaceData.data.workspace_list;
      this.groupsHeight = workspaceList.length * GROUP_ITEM_HEIGHT + 1;
      let groupItems = workspaceList.filter(workspace => {
        return workspace.type === 'group';
      });
      this.setState({
        isDataLoading: false,
        workspaceList,
        groupItems
      });
    } catch (error) {
      this.errorCallbackHandle(error);
    }
  }

  errorCallbackHandle = (error) => {
    if (error.response) {
      toaster.danger(gettext('Error'));
    } else {
      toaster.danger(gettext('Please check the network.'));
    }
  };

  toggleWechatDialog = () => {
    this.setState({ isShowWechatDialog: !this.state.isShowWechatDialog });
  };

  onKeyDown = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (isHotkey('enter', e)) {
      this.onBasesListExtended(e);
    }
  };

  onTabClick = (tab, event) => {
    event.stopPropagation();
    this.props.onTabClick(tab);
    this.props.onCloseSidePanel();
  };

  onGroupTabClick = (event, tab) => {
    event.stopPropagation();
    this.props.onTabClick(tab);
    this.props.onCloseSidePanel();
  };

  getActiveClass = (tab) => {
    return this.props.currentTab === tab ? 'active' : '';
  };

  onOpenSeaTableMarket = () => {
    if (seatableMarketUrl) {
      window.open(seatableMarketUrl);
    } else {
      window.open('/templates');
    }
  };

  onOpenSeaTableFriendInvitation = () => {
    window.open(friendInvitationLink);
  };

  onBasesListExtended = (event) => {
    event.stopPropagation();
    event.preventDefault();
    this.props.toggleGroupExpanded();
  };

  onMoreListExtended = (event) => {
    event.stopPropagation();
    event.preventDefault();
    this.setState({ isExpandedMoreList: !this.state.isExpandedMoreList });
  };

  moveGroupItem = (optionSource, optionTarget) => {
    let groupItems = this.state.groupItems.slice(0);
    let isMoveToLast = 'false';
    const sourceGroupId = optionSource.data.group_id;
    let targetGroupId = optionTarget.data.group_id;

    if (optionSource.idx < optionTarget.idx) {
      if (optionTarget.idx === groupItems.length - 1) {
        targetGroupId = null;
        isMoveToLast = 'true';
      } else {
        let targetGroup = groupItems[optionTarget.idx + 1];
        targetGroupId = targetGroup.group_id;
      }
    }
    dtableWebAPI.moveUserGroupsOrder(sourceGroupId, targetGroupId, isMoveToLast).then(() => {
      groupItems.splice(optionSource.idx, 1);
      groupItems.splice(optionTarget.idx, 0, optionSource.data);
      this.setState({ groupItems });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  getGroupsList = () => {
    const { groupItems } = this.state;
    return (
      <>
        {groupItems.map((item, index) => {
          const isDepart = item.group_owner === 'system admin';
          return (
            <SidePanelGroupItem
              key={item.id}
              item={item}
              index={index}
              getActiveClass={this.getActiveClass}
              onGroupTabClick={this.onGroupTabClick}
              moveGroupItem={this.moveGroupItem}
              isDepart={isDepart}
              isOpenGroupExpanded={this.props.isOpenGroupExpanded}
            />
          );
        })}
      </>
    );
  };

  getDragDropGroupsList = () => {
    return html5DragDropContext(
      DropTarget('SidePanelGroupItem', {}, connect => ({
        connectDropTarget: connect.dropTarget()
      }))(this.getGroupsList)
    );
  };

  renderWorkspaceItems = () => {
    let { workspaceList } = this.state;
    let personalWorkspace = workspaceList.find(workspace => {
      return workspace.type === 'personal';
    });
    const Groups = this.getDragDropGroupsList();
    const tabIndex = this.props.isOpenGroupExpanded ? 0 : -1;

    return (
      <div id="workspace-items">
        {personalWorkspace && (
          <div
            className={`nav-item workspace-nav-item ${this.getActiveClass(`dtable/${personalWorkspace.id}`) ? 'seatable-bg-orange active' : ''}`}
            onClick={(event) => this.onGroupTabClick(event, `dtable/${personalWorkspace.id}`)}
          >
            <Link tabIndex={tabIndex} to={siteRoot + 'dtable/' + personalWorkspace.id + '/'} className="workspace-nav-link ellipsis">
              <span className="table-workspace-icon dtable-font dtable-icon-creator" aria-hidden="true"></span>
              <span className="nav-text">{gettext('My bases')}</span>
            </Link>
          </div>
        )}
        <div
          className={`nav-item workspace-nav-item ${this.getActiveClass('dtable/starred') ? 'seatable-bg-orange active' : ''}`}
          onClick={(event) => this.onGroupTabClick(event, 'dtable/starred')}
        >
          <Link tabIndex={tabIndex} to={siteRoot + 'dtable/starred/'} className="workspace-nav-link ellipsis">
            <span className="table-workspace-icon dtable-font dtable-icon-star" aria-hidden="true"></span>
            <span className="nav-text">{gettext('Favorites')}</span>
          </Link>
        </div>
        <div
          className={`nav-item workspace-nav-item ${this.getActiveClass('dtable/shared') ? 'seatable-bg-orange active' : ''}`}
          onClick={(event) => this.onGroupTabClick(event, 'dtable/shared')}
        >
          <Link tabIndex={tabIndex} to={siteRoot + 'dtable/shared/'} className="workspace-nav-link ellipsis">
            <span className="table-workspace-icon dtable-font dtable-icon-share-with-me" aria-hidden="true"></span>
            <span className="nav-text">{gettext('Shared with me')}</span>
          </Link>
        </div>
        <Groups />
      </div>
    );
  };

  renderMoreItems = () => {
    return (
      <div
        className={`nav-item workspace-nav-item ${this.getActiveClass('more/data-sync') ? 'seatable-bg-orange active' : ''}`}
        onClick={this.onTabClick.bind(this, 'more/data-sync')}
      >
        <Link to={siteRoot + 'more/data-sync/'} className="workspace-nav-link ellipsis">
          <span className="table-workspace-icon dtable-font dtable-icon-sync" aria-hidden="true"></span>
          <span className="nav-text">{gettext('Data sync')}</span>
        </Link>
      </div>
    );
  };

  renderCustomNavItems() {
    return (
      customNavItems.map((item, idx) => {
        return (
          <div key={idx} className='nav-item dtable-nav-item'>
            <a href={item.link} className='nav-link dtable-nav-link' title={item.desc}>
              <span className={`dtable-font ${item.icon} nav-icon`} aria-hidden="true"></span>
              <span className="nav-text">{item.desc}</span>
            </a>
          </div>
        );
      })
    );
  }

  render() {
    let style = { height: this.props.isOpenGroupExpanded ? this.groupsHeight : 0 };
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;

    const isDingTalk = isDingTalkBuiltInBrowser();

    return (
      <div
        className={`side-panel ${this.props.isSidePanelClosed ? '' : 'left-zero'}`}
        aria-label={gettext('Side panel')}
        role="navigation"
        tabIndex={0}
      >
        {!this.props.isDesktop &&
          <header className="side-panel-north dtable-header">
            <a className="dtable-logo" href={siteRoot}>
              <img
                src={logoUrl}
                height={logoHeight}
                width={logoWidth}
                title={siteTitle}
                alt={gettext('SeaTable logo')}
                aria-label={gettext('SeaTable logo')}
              />
            </a>
          </header>
        }
        <div className="side-panel-center">
          <nav className="dtable-side-nav">
            <span className="dtable-nav-title">{gettext('Workspace')}</span>
            <div className="nav nav-pills flex-column dtable-nav-list">
              <div
                className={`nav-item dtable-nav-item bases-nav ${this.getActiveClass('dtable')} ${this.getActiveClass('dtable') ? 'seatable-bg-orange' : ''}`}
                onClick={this.onTabClick.bind(this, 'dtable')}
              >
                <Link
                  to={siteRoot + 'dtable/'}
                  aria-label={gettext('Bases')}
                  className="nav-link dtable-nav-link"
                >
                  <span className="dtable-font dtable-icon-dtable-logo nav-icon" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Bases')}</span>
                </Link>
                <div
                  className="nav-toggle-container h-100"
                  aria-label={gettext('Expand all workspaces')}
                  aria-expanded={this.props.isOpenGroupExpanded}
                  tabIndex={0}
                  role="button"
                  onKeyDown={this.onKeyDown}
                  onClick={this.onBasesListExtended}
                >
                  {!this.state.isDataLoading && (
                    <span className={`dtable-font dtable-icon-down3 nav-toggle-icon ${!this.props.isOpenGroupExpanded ? 'nav-toggle-icon-spin' : ''}`}></span>
                  )}
                </div>
              </div>
              <div
                className={`workspace-list flex-column ${this.props.isOpenGroupExpanded ? 'side-panel-slide' : 'side-panel-slide-up'}`}
                style={style}
                aria-hidden={!this.props.isOpenGroupExpanded}
              >
                {!this.state.isDataLoading && this.renderWorkspaceItems()}
              </div>
              {this.isDesktop && isPro && enableAddressBookV2 && enableDepartmentAdminManageMemberBases &&
                <div
                  className={`nav-item dtable-nav-item flex-column ${this.getActiveClass('departments-v2')}`}
                  onClick={this.onTabClick.bind(this, 'departments-v2')}
                >
                  <Link to={siteRoot + 'departments-v2/'} className={`nav-link dtable-nav-link ${this.getActiveClass('departments-v2') ? 'seatable-bg-orange' : ''}`}>
                    <span className="dtable-font dtable-icon-organization nav-icon" aria-hidden="true"></span>
                    <span className="nav-text departments-v2">{gettext('Departments')}</span>
                  </Link>
                </div>
              }
              {this.isDesktop && this.props.showWorkflow &&
                <div
                  className={`nav-item dtable-nav-item flex-column ${this.getActiveClass('workflows')}`}
                  onClick={this.onTabClick.bind(this, 'workflows')}
                >
                  <Link to={siteRoot + 'workflows/'} className={`nav-link dtable-nav-link ${this.getActiveClass('workflows') ? 'seatable-bg-orange' : ''}`}>
                    <span className="dtable-font dtable-icon-workflow nav-icon" aria-hidden="true"></span>
                    <span className="nav-text workflow">{gettext('Workflow')}</span>
                  </Link>
                </div>
              }
              {this.isDesktop && enableUniversalApp &&
                <div
                  className={`nav-item dtable-nav-item ${this.getActiveClass('universal-apps')}`}
                  onClick={this.onTabClick.bind(this, 'universal-apps')}
                >
                  <Link to={siteRoot + 'universal-apps/'} className={`nav-link dtable-nav-link ${this.getActiveClass('universal-apps') ? 'seatable-bg-orange' : ''}`}>
                    <Icon symbol="external-apps" className="mr-2" aria-hidden="true"/>
                    <div>
                      <span className="nav-text">{gettext('Apps')}</span>
                    </div>
                  </Link>
                </div>
              }
              <div
                className={`nav-item dtable-nav-item ${this.getActiveClass('activities')}`}
                onClick={this.onTabClick.bind(this, 'activities')}
              >
                <Link to={siteRoot + 'activities/'} className={`nav-link dtable-nav-link ${this.getActiveClass('activities') ? 'seatable-bg-orange' : ''}`}>
                  <span className="dtable-font dtable-icon-modification-record nav-icon" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Activities')}</span>
                </Link>
              </div>
              {(!cloudMode || (isOrgContext && enableOrgCommonDataset)) &&
                <div
                  className={`nav-item dtable-nav-item ${this.getActiveClass('common-datasets')}`}
                  onClick={this.onTabClick.bind(this, 'common-datasets')}
                >
                  <Link to={siteRoot + 'common-datasets/'} className={`nav-link dtable-nav-link ${this.getActiveClass('common-datasets') ? 'seatable-bg-orange' : ''}`}>
                    <span className="dtable-font dtable-icon-common-dataset nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Common datasets')}</span>
                  </Link>
                </div>
              }
              <div
                className={`nav-item dtable-nav-item ${this.getActiveClass('dtable/trash')}`}
                onClick={this.onTabClick.bind(this, 'dtable/trash')}
              >
                <Link to={siteRoot + 'dtable/trash/'} className={`nav-link dtable-nav-link ${this.getActiveClass('dtable/trash') ? 'seatable-bg-orange' : ''}`}>
                  <span className="dtable-font dtable-icon-recycle-bin nav-icon" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Trash')}</span>
                </Link>
              </div>
            </div>
            <span className="dtable-nav-overview">{gettext('Help and resources')}</span>
            <div className="nav nav-pills flex-column dtable-nav-list">
              {showTemplatesLink && !isDingTalk && (
                <div className={`nav-item dtable-nav-item ${this.getActiveClass('templates')}`}>
                  <span
                    className={`nav-link dtable-nav-link ${this.getActiveClass('templates') ? 'seatable-bg-orange' : ''}`}
                    onClick={this.onOpenSeaTableMarket}
                    role="link"
                  >
                    <span className="dtable-font dtable-icon-templates nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Templates')}</span>
                  </span>
                </div>
              )}
              {!isDingTalk && (
                <div className={`nav-item dtable-nav-item ${this.getActiveClass('help')}`}>
                  <a href={helpLink} target='_blank' rel="noreferrer" className={'nav-link dtable-nav-link'}>
                    <span className="dtable-font dtable-icon-use-help nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Manual')}</span>
                  </a>
                </div>
              )}
              {enableUserGuide && !isDingTalk && (
                <div
                  className={`nav-item dtable-nav-item ${this.getActiveClass('user-guide')}`}
                  onClick={this.onTabClick.bind(this, 'user-guide')}
                >
                  <Link to={siteRoot + 'user-guide'} className={`nav-link dtable-nav-link ${this.getActiveClass('user-guide') ? 'seatable-bg-orange' : ''}`}>
                    <Icon symbol="novice-guide" className="mr-2"/>
                    <div>
                      <span className="nav-text">新手引导</span>
                    </div>
                  </Link>
                </div>
              )}
              {cloudMode && enableTellAFriend && friendInvitationLink && (
                <div className={`nav-item dtable-nav-item ${this.getActiveClass('tell-a-friend')}`}>
                  <span
                    className={`nav-link dtable-nav-link ${this.getActiveClass('tell-a-friend') ? 'seatable-bg-orange' : ''}`}
                    onClick={this.onOpenSeaTableFriendInvitation}
                    role="link"
                    tabIndex={0}
                  >
                    <span className="dtable-font dtable-icon-invite nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Tell a friend')}</span>
                  </span>
                </div>
              )}
              {(!isOrgContext && enableInviteAFriend) &&
              <div
                className={`nav-item dtable-nav-item ${this.getActiveClass('invitation-link')}`}
                onClick={this.onTabClick.bind(this, 'invitation-link')}
              >
                <Link to={siteRoot + 'invitation-link/'} className={`nav-link dtable-nav-link ${this.getActiveClass('invitation-link') ? 'seatable-bg-orange' : ''}`}>
                  <span className="dtable-font dtable-icon-invite nav-icon" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Invite a friend')}</span>
                </Link>
              </div>
              }
              {customNavItems && this.renderCustomNavItems()}
            </div>
          </nav>
        </div>
        {showWechatSupportGroup && (
          <footer className="side-panel-footer">
            <div
              className="side-nav-footer"
              onClick={this.toggleWechatDialog}
              title={gettext('Join SeaTable WeChat Group')}
              aria-label={gettext('Join SeaTable WeChat Group')}
              role="button"
            >
              <i className="dtable-font dtable-icon-hi join-us-icon" aria-hidden="true" />
              {`加入 SeaTable ${this.isWorkWeixin ? '企业' : ''}微信咨询群`}
            </div>
          </footer>
        )}
        {this.state.isShowWechatDialog && <WechatDialog toggleWechatDialog={this.toggleWechatDialog}/>}
      </div>
    );
  }
}

SidePanel.propTypes = propTypes;

export default SidePanel;
