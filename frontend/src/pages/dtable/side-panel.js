import React from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import isHotkey from 'is-hotkey';
import { Link } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { seatableMarketUrl, mediaUrl, logoPath, logoWidth, logoHeight, siteTitle, friendInvitationLink
} from '../../utils/constants';
import { Utils } from '../../utils/utils';
import { seaQAAPI } from '../../api/web-api';
import html5DragDropContext from '../../utils/html5DragDropContext';
import SidePanelGroupItem from './side-panel-group-item';

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
      let workspaceData = await seaQAAPI.listWorkspaces(false);
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
    seaQAAPI.moveUserGroupsOrder(sourceGroupId, targetGroupId, isMoveToLast).then(() => {
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
              <span className="nav-text">{gettext('My projects')}</span>
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

  render() {
    let style = { height: this.props.isOpenGroupExpanded ? this.groupsHeight : 0 };
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;

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
                className={`nav-item dtable-nav-item bases-nav ${this.getActiveClass('project')} ${this.getActiveClass('project') ? 'seatable-bg-orange' : ''}`}
                onClick={this.onTabClick.bind(this, 'project')}
              >
                <Link
                  to={siteRoot + 'projects/'}
                  aria-label={gettext('Projects')}
                  className="nav-link dtable-nav-link"
                >
                  <span className="dtable-font dtable-icon-dtable-logo nav-icon" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Projects')}</span>
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
            </div>
          </nav>
        </div>
      </div>
    );
  }
}

SidePanel.propTypes = propTypes;

export default SidePanel;
