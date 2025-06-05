import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownItem } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../utils/constants';
import AppItemPopover from './app-item-popover';
import ModalPortal from '../../../components/modal-portal';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import Icon from '../../../components/icon';
import getAppIconUrl from './utils/get-app-icon';

const isDesktop = Utils.isDesktop();
const { server } = window.app.pageOptions;

class AppItem extends React.Component {

  constructor(props) {
    super(props);
    const { name } = this.initAppConfig(props);
    this.state = {
      isMouseEnter: false,
      isMoreOperationViewShow: false,
      isMoreOperationPopoverShow: false,
      isLeaveAppDialogShow: false,
      name,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { name } = this.initAppConfig(nextProps);
    if (this.state.name !== name) {
      this.setState({ name });
    }
  }

  initAppConfig = (props) => {
    const { appItem } = props;
    const { app_config } = appItem;
    const appConfig = JSON.parse(app_config);
    const { app_name, icon_class_name, app_theme_color, use_custom_icon, app_icon } = appConfig;
    return {
      name: app_name,
      icon_class: icon_class_name,
      color: app_theme_color,
      is_custom: use_custom_icon,
      icon_link: app_icon
    };
  };

  onMouseEnter = () => {
    this.setState({ isMouseEnter: true });
    const { setHighLightIndex, index } = this.props;
    if (setHighLightIndex) {
      setHighLightIndex(index);
    }
  };

  onMouseLeave = () => {
    this.setState({ isMouseEnter: false });
  };

  toggleAppMoreOperation = (event) => {
    event && event.stopPropagation();
    if (isDesktop) {
      this.setState({ isMoreOperationPopoverShow: !this.state.isMoreOperationPopoverShow });
    } else {
      this.setState({ isMoreOperationViewShow: !this.state.isMoreOperationViewShow });
    }
  };

  openAppBase = () => {
    const { appItem } = this.props;
    const { dtable_name, workspace_id } = appItem;
    const baseUrl = `${server}/workspace/${workspace_id}/dtable/${Utils.encodePath(dtable_name)}/`;
    window.open(baseUrl, '_blank');
  };

  openApp = () => {
    const { appItem } = this.props;
    window.open(appItem.link, '_blank');
    if (this.props.onItemClickHandler) {
      this.props.onItemClickHandler();
    }
  };

  openAppEditPage = () => {
    const { appItem } = this.props;
    window.open(appItem.edit_link, '_blank');
  };

  toggleLeaveAppDialog = () => {
    this.setState({ isLeaveAppDialogShow: !this.state.isLeaveAppDialogShow });
  };

  leaveApp = () => {
    const { appItem } = this.props;
    this.props.leaveApp(appItem);
  };

  render() {
    const { appItem, isAdmin, style, className, isInMobileFolder } = this.props;
    const { isMouseEnter, isMoreOperationViewShow, isMoreOperationPopoverShow, isLeaveAppDialogShow } = this.state;
    const { app_id, app_name } = appItem;
    const serverConfig = this.initAppConfig(this.props);
    const { icon_class, is_custom, icon_link } = serverConfig;
    const appItemId = `app-item-${app_id}`;
    const appName = '<b>' + Utils.HTMLescape(app_name) + '</b>';
    const message = gettext('Are you sure you want to leave app {placeholder} ?').replace('{placeholder}', appName);
    const isAppMoreShow = isDesktop ? isMouseEnter : isAdmin;
    return (
      <>
        {isInMobileFolder &&
          <div className="app-mobile-item" onClick={this.openApp}>
            <img className="app-custom-icon" src={getAppIconUrl(icon_class, is_custom, icon_link)} alt=""/>
            <div className="app-mobile-name d-flex align-items-center">
              {app_name}
            </div>
            <div
              className="app-item-more d-flex justify-content-center"
              onClick={isAppMoreShow ? this.toggleAppMoreOperation : () => {}}
            >
              {isAppMoreShow &&
                <i
                  className="dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                >
                </i>
              }
            </div>
          </div>
        }
        {!isInMobileFolder &&
          <div
            id={appItemId}
            style={style}
            className={`app-item d-flex ${className}`}
            onClick={this.openApp}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            <div className="app-item-icon d-flex position-relative">
              <img className="app-custom-icon" src={getAppIconUrl(icon_class, is_custom, icon_link)} alt=""/>
              {(isMouseEnter || !isDesktop || isMoreOperationPopoverShow) &&
                <div
                  className="app-item-more d-flex justify-content-center"
                  onClick={this.toggleAppMoreOperation}
                  id={appItemId + '-more-icon'}
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                >
                  <i className="dtable-font dtable-icon-more-level" aria-hidden="true"></i>
                </div>
              }
            </div>
            <div className="app-item-name" title={serverConfig.name} aria-label={serverConfig.name}>
              {serverConfig.name}
            </div>
          </div>
        }
        {isMoreOperationPopoverShow && (
          <AppItemPopover
            target={appItemId + '-more-icon'}
            appItem={appItem}
            onToggle={this.toggleAppMoreOperation}
            onOpenAppBase={this.openAppBase}
            onOpenAppEditPage={this.openAppEditPage}
            onLeaveApp={this.toggleLeaveAppDialog}
            onMoveAppToFolder={this.props.onMoveAppToFolder}
            folders={this.props.folders}
            currentFolder={this.props.currentFolder}
            isAdmin={isAdmin}
          />
        )}
        {isMoreOperationViewShow && (
          <ModalPortal>
            <div className="mobile-operation-menu-bg-layer" onClick={this.toggleAppMoreOperation}></div>
            <div className="mobile-operation-menu" onClick={this.toggleAppMoreOperation}>
              <Dropdown
                isOpen={this.state.isMoreOperationViewShow}
                toggle={() => {}}
                style={{ width: '100%' }}
              >
                {isAdmin ? (
                  <>
                    <DropdownItem onClick={this.openAppEditPage} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-rename"></span>
                      <span className="mobile-dropdown-span">{gettext('Edit')}</span>
                    </DropdownItem>
                    <DropdownItem onClick={this.openAppBase} className="mobile-dropdown-item">
                      <span className="dtable-font dtable-icon-dtable-logo"></span>
                      <span className="mobile-dropdown-span">{gettext('Open base')}</span>
                    </DropdownItem>
                  </>
                ) : (
                  <DropdownItem onClick={this.toggleLeaveAppDialog} className="mobile-dropdown-item">
                    <Icon symbol="leave-app" className="dtable-font" />
                    <span className="mobile-dropdown-span">{gettext('Leave app')}</span>
                  </DropdownItem>
                )}
              </Dropdown>
            </div>
          </ModalPortal>
        )}
        {isLeaveAppDialogShow && (
          <CommonOperationConfirmationDialog
            title={gettext('Leave App')}
            message={message}
            executeOperation={this.leaveApp}
            confirmBtnText={gettext('Leave')}
            toggleDialog={this.toggleLeaveAppDialog}
          />
        )}
      </>
    );
  }
}

AppItem.propTypes = {
  appItem: PropTypes.object,
  className: PropTypes.string,
  style: PropTypes.object,
  isAdmin: PropTypes.bool,
  index: PropTypes.number,
  leaveApp: PropTypes.func,
  setHighLightIndex: PropTypes.func,
  onItemClickHandler: PropTypes.func,
  folders: PropTypes.array,
  currentFolder: PropTypes.object,
  onMoveAppToFolder: PropTypes.func,
  isInMobileFolder: PropTypes.bool
};

AppItem.defaultProps = {
  isInMobileFolder: false,
  className: '',
};

export default AppItem;
