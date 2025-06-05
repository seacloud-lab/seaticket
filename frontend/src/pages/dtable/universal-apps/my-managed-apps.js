import React from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import AppItem from './app-item';
import AppFolder from './app-folder';
import { emptyAppImageSrc, MANAGED_APP_FOLDER, MY_MANAGED_APPS } from './constants';
import { Dropdown, DropdownToggle, DropdownItem, DropdownMenu } from 'reactstrap';

const gettext = window.gettext;

class MyManagedApps extends React.Component {

  constructor(props) {
    super(props);
    const { apps, numberOfAppsShown, managedAppFolders } = this.props;
    const total = apps.length + managedAppFolders.length;
    this.state = {
      isShowAll: total > numberOfAppsShown ? false : true,
      isShowDropdownMenu: false
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.state.isShowAll) return;
    const { numberOfAppsShown, managedAppFolders, apps } = nextProps;
    const total = apps.length + managedAppFolders.length;
    this.setState({ isShowAll: total > numberOfAppsShown ? false : true });
  }

  getDisplayItems = () => {
    const { apps, managedAppFolders, numberOfAppsShown } = this.props;
    const { isShowAll } = this.state;
    const appsCount = apps.length;
    const foldersCount = managedAppFolders.length;
    if (isShowAll) {
      return { displayFolders: managedAppFolders, displayApps: apps, displayCount: appsCount + foldersCount };
    }

    // not show all folders and apps
    let displayApps = [];
    let displayFolders = managedAppFolders;

    // The number of folders is less than the number that can fit on each row
    if (foldersCount < numberOfAppsShown) {
      displayApps = apps.slice(0, numberOfAppsShown - foldersCount);
    } else {
      // The number of folders is more than or  equal to the number that can fit on each row
      displayFolders = managedAppFolders.slice(0, numberOfAppsShown);
    }
    return { displayApps, displayFolders, displayCount: numberOfAppsShown };
  };

  showAll = () => {
    this.setState({ isShowAll: true }, () => {
      this.props.onResize();
    });
  };

  openDropdownMenu = () => {
    this.setState({ isShowDropdownMenu: !this.state.isShowDropdownMenu });
  };

  openAddFolderDialog = () => {
    this.props.onToggleAddFolderDialog(MANAGED_APP_FOLDER);
  };

  renderApps = () => {
    const { managedAppFolders } = this.props;
    const { isShowAll } = this.state;
    const { displayFolders, displayApps, displayCount } = this.getDisplayItems();
    if (displayCount === 0) {
      return (
        <DTableEmptyTip text={gettext('No app have been added yet')} src={emptyAppImageSrc} />
      );
    }
    const foldersCount = managedAppFolders.length;
    const loadMoreStyle = this.props.getLoadMoreStyle();
    return (
      <div className="app-group-content d-flex">
        {displayFolders.map((folder, index) => {
          const { className, style } = this.props.getAppItemClassAndStyle(index, displayCount);
          const { id } = folder;
          return (
            <AppFolder
              key={`app-folder-${id}`}
              style={style}
              className={className}
              folderItem={folder}
              folderType={MANAGED_APP_FOLDER}
              onDeleteFolder={this.props.onDeleteFolder}
              onRenameFolder={this.props.onRenameFolder}
              onToggleCurrentFolderView={this.props.onToggleCurrentFolderView}
              onToggleCurrentFolderDialog={this.props.onToggleCurrentFolderDialog}
            />
          );
        })
        }
        {displayApps.map((app, index) => {
          const { app_id } = app;
          const { style, className } = this.props.getAppItemClassAndStyle(index + foldersCount, displayCount);
          return (
            <AppItem
              key={`app-item-${app_id}`}
              style={style}
              className={className}
              appItem={app}
              isAdmin={true}
              folders={managedAppFolders}
              onMoveAppToFolder={this.props.onMoveAppToFolder.bind(this, MY_MANAGED_APPS)}
            />
          );
        })}
        {!isShowAll && (
          <div className="load-more-apps d-flex align-items-center" style={loadMoreStyle}>
            <div className="load-more-apps-line"></div>
            <div className="load-more-apps-tip" onClick={this.showAll}>
              {gettext('Show more')}
            </div>
            <div className="load-more-apps-line"></div>
          </div>
        )}
      </div>
    );
  };

  render() {
    const { isShowDropdownMenu } = this.state;
    return (
      <div className="app-group-container">
        <div className="app-group-name">
          <span className="text-truncate">{gettext('My managed apps')}</span>
          <Dropdown isOpen={isShowDropdownMenu} toggle={this.openDropdownMenu} className="apps-dropdown">
            <DropdownToggle
              tag="i"
              role="button"
              className="toggle-icon dtable-font dtable-icon-down3"
              data-toggle="dropdown"
              aria-expanded={isShowDropdownMenu}
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
              aria-haspopup={true}
            />
            <DropdownMenu>
              <DropdownItem className="create-app-folder-item" onClick={this.openAddFolderDialog}>
                <span aria-hidden="true">
                  <i className="item-icon dtable-font dtable-icon-folders" />
                </span>
                <span>{gettext('Create a folder')}</span>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        {this.renderApps()}
      </div>
    );
  }
}

MyManagedApps.propTypes = {
  apps: PropTypes.array,
  numberOfAppsShown: PropTypes.number,
  managedAppFolders: PropTypes.array,
  onResize: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  getLoadMoreStyle: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onMoveAppToFolder: PropTypes.func,
  getAppItemClassAndStyle: PropTypes.func
};

export default MyManagedApps;
