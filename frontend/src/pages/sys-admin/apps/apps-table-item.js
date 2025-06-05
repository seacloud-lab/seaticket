import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, siteRoot } from '../../../utils/constants';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import ModalPortal from '../../../components/modal-portal';
import AppOpMenu from './app-op-menu';
import DeleteAppDialog from './delete-app-dialog';

const propTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onChangeAppStatus: PropTypes.func.isRequired,
  onDeleteApp: PropTypes.func.isRequired,
  onDisableAppOpenAccess: PropTypes.func.isRequired,
  onEnableAppOpenAccess: PropTypes.func.isRequired
};

class AppsTableItem extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  onSetCurrentUserAsAdmin = () => {
    sysAdminServiceApi.sysAdminAddExternalAppAdmin(this.props.item.app_uuid, window.app.pageOptions.username).then(() => {
      toaster.success(gettext('Success'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  onDeleteApp = () => {
    this.props.onDeleteApp(this.props.item.app_uuid);
    this.toggleDeleteDialog();
  };

  onMenuItemClick = (operation) => {
    const { item } = this.props;
    switch (operation) {
      case 'Suspend':
        this.props.onChangeAppStatus(item.app_uuid);
        break;
      case 'Resume':
        this.props.onChangeAppStatus(item.app_uuid);
        break;
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'Enable open access':
        this.props.onEnableAppOpenAccess(item.app_uuid);
        break;
      case 'Disable open access':
        this.props.onDisableAppOpenAccess(item.app_uuid);
        break;
      case 'Copy app URL to clipboard':
        navigator.clipboard.writeText(item.external_app_url).then(() => {
          toaster.success(gettext('Success'));
        });
        break;
      case 'Set current user as admin':
        this.onSetCurrentUserAsAdmin();
        break;
      default:
        break;
    }
  };

  render() {
    const item = this.props.item;
    let changeAppStatusButton = 'Suspend';
    if (item.inactive) {
      changeAppStatusButton = 'Resume';
    }
    let operations = [changeAppStatusButton, 'Delete', 'Copy app URL to clipboard'];
    if (item.can_anonymous_access) {
      operations.push('Disable open access');
    } else {
      operations.push('Enable open access');
    }
    const appName = JSON.parse(item.app_config).app_name;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td>
            {appName}
            <Fragment>
              {item.org_id !== -1 && (item.org_name ? (
                <Fragment>
                  <br />
                  <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>({item.org_name})</Link>
                </Fragment>
              ) : (
                <Fragment>
                  <br />
                  ({'<' + gettext('Invalid organization') + '>'})
                </Fragment>
              ))
              }
            </Fragment>
          </td>
          <td>{item.app_uuid}</td>
          <td>{item.dtable_name === '_deleted' ? '<' + gettext('Deleted') + '>' : item.dtable_name}</td>
          <td>{gettext(item.app_type)}</td>
          <td><span className="pl-2 d-block">{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</span></td>
          <td>{item.visit_times}</td>
          <td>
            {this.state.isOpIconShown &&
              <AppOpMenu
                operations={operations}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <DeleteAppDialog
              appName={appName}
              onDeleteApp={this.onDeleteApp}
              deleteCancel={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

AppsTableItem.propTypes = propTypes;

export default AppsTableItem;
