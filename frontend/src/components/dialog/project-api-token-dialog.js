import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, Input, Table } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { gettext } from '../../constants';
import { Utils } from '../../utils/utils';
import homeAPI from '../../home/api';
import toaster from '../toaster';
import ModalHeader from '../modal-header';
import IconButton from '../icon-button';
import CommonOperationConfirmationDialog from './common-operation-confirmation-dialog';
import CustomizeSelect from '../customize-select';

import './project-api-token-dialog.css';

const PERMISSIONS = {
  READ_WRITE: 'rw',
  READ_ONLY: 'r'
};

class APITokenItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
      isDeleteDialogOpen: false,
      isPermissionSelectOpen: false,
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOperationShow: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOperationShow: false });
    }
  };

  onCopyAPIToken = () => {
    copy(this.props.item.api_token);
    toaster.success(gettext('API token copied to clipboard'), { duration: 2 });
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen }, () => {
      if (this.state.isDeleteDialogOpen) {
        this.props.onFreezedItem();
      } else {
        this.props.onUnfreezedItem();
      }
    });
  };

  onDeleteAPIToken = () => {
    this.props.deleteAPIToken(this.props.item.id);
  };

  togglePermissionSelect = () => {
    this.setState({ isPermissionSelectOpen: !this.state.isPermissionSelectOpen }, () => {
      if (this.state.isPermissionSelectOpen) {
        this.props.onFreezedItem();
      } else {
        this.props.onUnfreezedItem();
      }
    });
  };

  onUpdatePermission = (permission) => {
    if (permission !== this.props.item.permission) {
      this.props.updateAPIToken(this.props.item.id, permission);
    }
    this.setState({ isPermissionSelectOpen: false }, () => {
      this.props.onUnfreezedItem();
    });
  };

  render() {
    const { item, permissionList } = this.props;
    const { isOperationShow, isDeleteDialogOpen, isPermissionSelectOpen } = this.state;

    return (
      <>
        <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td>{item.app_name}</td>
          <td>
            <div className="d-inline-flex align-items-center">
              {isPermissionSelectOpen &&
                <CustomizeSelect
                  value={permissionList.find(option => option.value === item.permission)}
                  options={permissionList}
                  onChange={this.onUpdatePermission}
                  maxWidth={200}
                />
              }
              {!isPermissionSelectOpen &&
                <>
                  <span>{item.permission === PERMISSIONS.READ_WRITE ? gettext('Read-Write') : gettext('Read-Only')}</span>
                  <IconButton
                    icon="rename"
                    onClick={this.togglePermissionSelect}
                    className="operation-icon ml-1"
                    style={{ opacity: isOperationShow ? 1 : 0 }}
                  />
                </>
              }
            </div>
          </td>
          <td>
            <span className="token-cell">
              {item.api_token}
            </span>
          </td>
          <td>
            <div className="d-flex align-items-center">
              <IconButton
                icon="copy"
                onClick={this.onCopyAPIToken}
                className="operation-icon"
                style={{ opacity: isOperationShow ? 1 : 0 }}
              />
              <IconButton
                icon="delete"
                className="text-danger"
                onClick={this.toggleDeleteDialog}
                style={{ opacity: isOperationShow ? 1 : 0 }}
              />
            </div>
          </td>
        </tr>
        {isDeleteDialogOpen && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete API token')}
            message={gettext('Are you sure you want to delete the API token for {placeholder} ?').replace('{placeholder}', `<b>${item.app_name}</b>`)}
            executeOperation={this.onDeleteAPIToken}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        )}
      </>
    );
  }
}

APITokenItem.propTypes = {
  item: PropTypes.object.isRequired,
  projectUuid: PropTypes.string.isRequired,
  deleteAPIToken: PropTypes.func.isRequired,
  updateAPIToken: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

class ProjectAPITokenDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      appName: '',
      permission: PERMISSIONS.READ_WRITE,
      tokens: [],
      isLoading: true,
      isCreating: false,
      isItemFreezed: false,
    };
    this.permissionList = [
      {
        value: PERMISSIONS.READ_WRITE,
        label: gettext('Read-Write')
      },
      {
        value: PERMISSIONS.READ_ONLY,
        label: gettext('Read-Only')
      }
    ];
  }

  componentDidMount() {
    this.loadTokens();
  }

  handleError = (error) => {
    const errMessage = Utils.getErrorMsg(error);
    toaster.danger(errMessage);
  };

  loadTokens = () => {
    this.setState({ isLoading: true });
    homeAPI.listProjectAPITokens(this.props.projectUuid)
      .then(response => {
        this.setState({
          tokens: response.data.api_tokens || [],
          isLoading: false
        });
      })
      .catch(error => {
        this.handleError(error);
        this.setState({ isLoading: false });
      });
  };

  createToken = () => {
    const trimmedAppName = this.state.appName.trim();
    if (!trimmedAppName) {
      toaster.danger(gettext('App name is required'));
      return;
    }

    this.setState({ isCreating: true });
    homeAPI.createProjectAPIToken(this.props.projectUuid, trimmedAppName, this.state.permission)
      .then(() => {
        this.setState({
          appName: '',
          permission: PERMISSIONS.READ_WRITE,
          isCreating: false
        });
        this.loadTokens();
        toaster.success(gettext('%s created').replace('%s', gettext('API token')));
      })
      .catch(error => {
        this.handleError(error);
        this.setState({ isCreating: false });
      });
  };

  deleteToken = (tokenId) => {
    homeAPI.deleteProjectAPIToken(this.props.projectUuid, tokenId)
      .then(() => {
        this.loadTokens();
        toaster.success(gettext('%s deleted').replace('%s', gettext('API token')));
      })
      .catch(this.handleError);
  };

  updateToken = (tokenId, permission) => {
    homeAPI.updateProjectAPIToken(this.props.projectUuid, tokenId, permission)
      .then(() => {
        this.loadTokens();
        toaster.success(gettext('%s updated').replace('%s', gettext('API token')));
      })
      .catch(this.handleError);
  };

  handleAppNameChange = (e) => {
    this.setState({ appName: e.target.value });
  };

  setPermission = (permission) => {
    this.setState({ permission });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    const { tokens, isLoading, isCreating, appName, permission, isItemFreezed } = this.state;
    const { projectUuid, projectName, toggle } = this.props;

    return (
      <Modal isOpen toggle={toggle} size="lg" className="project-api-token-dialog" autoFocus={false}>
        <ModalHeader toggle={toggle}>{gettext('API token')} <span className="text-primary">{projectName}</span></ModalHeader>
        <ModalBody>
          <div className="modal-header-container">
            <Table className="create-form-table">
              <thead>
                <tr>
                  <th>{gettext('App name')}</th>
                  <th>{gettext('Permission')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Input
                      type="text"
                      value={appName}
                      autoFocus={true}
                      onChange={this.handleAppNameChange}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), this.createToken())}
                    />
                  </td>
                  <td>
                    <CustomizeSelect
                      value={this.permissionList.find(option => option.value === permission)}
                      options={this.permissionList}
                      onChange={this.setPermission}
                      maxWidth={200}
                    />
                  </td>
                  <td>
                    <Button
                      color="primary"
                      onClick={this.createToken}
                      disabled={isCreating || !appName.trim()}
                    >
                      {isCreating ? gettext('Creating...') : gettext('Submit')}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          <div className="modal-content-container">
            {isLoading ? (
              <div className="text-center">
                <div className="spinner-border" role="status" />
              </div>
            ) : tokens.length > 0 && (
              <Table className="token-list-table">
                <thead>
                  <tr>
                    <th>{gettext('App name')}</th>
                    <th>{gettext('Permission')}</th>
                    <th>{gettext('Token')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map(token => (
                    <APITokenItem
                      key={token.id}
                      item={token}
                      projectUuid={projectUuid}
                      deleteAPIToken={this.deleteToken}
                      updateAPIToken={this.updateToken}
                      isItemFreezed={isItemFreezed}
                      onFreezedItem={this.onFreezedItem}
                      onUnfreezedItem={this.onUnfreezedItem}
                      permissionList={this.permissionList}
                    />
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

ProjectAPITokenDialog.propTypes = {
  projectUuid: PropTypes.string.isRequired,
  projectName: PropTypes.string.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default ProjectAPITokenDialog;
