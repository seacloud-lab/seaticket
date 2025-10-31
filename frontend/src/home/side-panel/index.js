import React from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { Link } from '@gatsbyjs/reach-router';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { mediaUrl, logoPath, logoWidth, logoHeight, siteTitle, siteRoot, gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import homeAPI from '../api';
import GroupItem from './group-item';
import { Icon, IconButton, toaster } from '@/components';
import classNames from 'classnames';

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
      isDataLoading: true,
      isExpandedMoreList: this.props.currentTab.includes('more/'),
      workspaceList: [],
      groupItems: []
    };
    this.groupsHeight = 0;
    this.moreHeight = 1 * GROUP_ITEM_HEIGHT; // 1 is data sync
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
      let workspaceData = await homeAPI.listWorkspaces(false);
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
    homeAPI.moveUserGroupsOrder(sourceGroupId, targetGroupId, isMoveToLast).then(() => {
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

  renderWorkspaceItems = () => {
    let { workspaceList, groupItems } = this.state;
    let personalWorkspace = workspaceList.find(workspace => {
      return workspace.type === 'personal';
    });
    const tabIndex = this.props.isOpenGroupExpanded ? 0 : -1;

    return (
      <div id="workspace-items">
        {personalWorkspace && (
          <div
            className={`nav-item workspace-nav-item ${this.getActiveClass(`project/${personalWorkspace.id}`) ? 'sea-qa-bg-orange active' : ''}`}
            onClick={(event) => this.onGroupTabClick(event, `project/${personalWorkspace.id}`)}
          >
            <Link tabIndex={tabIndex} to={siteRoot + 'project/' + personalWorkspace.id + '/'} className="workspace-nav-link ellipsis">
              <Icon className="project-workspace-icon" symbol="creator" />
              <span className="nav-text">{gettext('My projects')}</span>
            </Link>
          </div>
        )}
        {groupItems.map((item, index) => {
          return (
            <GroupItem
              key={item.id}
              item={item}
              index={index}
              isOpenGroupExpanded={this.props.isOpenGroupExpanded}
              getActiveClass={this.getActiveClass}
              onGroupTabClick={this.onGroupTabClick}
              onMove={this.moveGroupItem}
            />
          );
        })}
      </div>
    );
  };

  render() {
    let style = { height: this.props.isOpenGroupExpanded ? this.groupsHeight : 0 };
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;

    return (
      <DndProvider backend={HTML5Backend}>
        <div
          className={`side-panel ${this.props.isSidePanelClosed ? '' : 'left-zero'}`}
          aria-label={gettext('Side panel')}
          role="navigation"
          tabIndex={0}
        >
          {!this.props.isDesktop &&
            <header className="side-panel-north sea-qa-home-header">
              <a className="sea-qa-logo" href={siteRoot}>
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
            <nav className="project-side-nav">
              <span className="sea-qa-nav-title">{gettext('Workspace')}</span>
              <div className="nav nav-pills flex-column sea-qa-nav-list">
                <div
                  className={`nav-item sea-qa-nav-item projects-nav ${this.getActiveClass('projects')} ${this.getActiveClass('projects') ? 'sea-qa-bg-orange' : ''}`}
                  onClick={this.onTabClick.bind(this, 'projects')}
                >
                  <Link
                    to={siteRoot + 'projects/'}
                    aria-label={gettext('Projects')}
                    className="nav-link sea-qa-nav-link"
                  >
                    <Icon symbol="home" className="nav-icon" />
                    <span className="nav-text">{gettext('Projects')}</span>
                  </Link>
                  <IconButton
                    className={classNames('nav-toggle-container no-hover-bg h-100', { 'rotate-icon-90': !this.props.isOpenGroupExpanded })}
                    aria-label={gettext('Expand all workspaces')}
                    aria-expanded={this.props.isOpenGroupExpanded}
                    tabIndex={0}
                    role="button"
                    onKeyDown={this.onKeyDown}
                    onClick={this.onBasesListExtended}
                    icon={this.state.isDataLoading ? '' : 'down'}
                    iconClassName="nav-toggle-icon"
                  />
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
      </DndProvider>
    );
  }
}

SidePanel.propTypes = propTypes;

export default SidePanel;
