import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, Input, Table, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { gettext } from '../../constants';
import { Utils } from '../../utils/utils';
import homeAPI from '../../home/api';
import toaster from '../toaster';
import ModalHeader from '../modal-header';
import IconButton from '../icon-button';
import { CommonOperationConfirmationDialog } from '../index';

const PERMISSIONS = {
  READ_WRITE: 'rw',
  READ_ONLY: 'r'
};

const tokenCellStyle = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

class APITokenItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
      isDeleteDialogOpen: false,
      isPermissionDropdownOpen: false,
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

  togglePermissionDropdown = () => {
    this.setState({ isPermissionDropdownOpen: !this.state.isPermissionDropdownOpen }, () => {
      if (this.state.isPermissionDropdownOpen) {
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
    this.setState({ isPermissionDropdownOpen: false }, () => {
      this.props.onUnfreezedItem();
    });
  };

  render() {
    const { item } = this.props;
    const { isOperationShow, isDeleteDialogOpen, isPermissionDropdownOpen } = this.state;

    return (
      <>
        <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td style={{ width: '20%' }}>{item.app_name}</td>
          <td style={{ width: '20%' }}>
            <div className="d-inline-flex align-items-center">
              <span>{item.permission === PERMISSIONS.READ_WRITE ? gettext('Read-Write') : gettext('Read-Only')}</span>
              {isOperationShow && (
                <Dropdown isOpen={isPermissionDropdownOpen} toggle={this.togglePermissionDropdown} className="d-inline-block ml-1">
                  <DropdownToggle tag="span" style={{ cursor: 'pointer' }}>
                    <IconButton
                      icon="rename"
                      style={{ padding: '0 4px' }}
                    />
                  </DropdownToggle>
                  <DropdownMenu>
                    <DropdownItem onClick={() => this.onUpdatePermission(PERMISSIONS.READ_WRITE)}>
                      {gettext('Read-Write')}
                    </DropdownItem>
                    <DropdownItem onClick={() => this.onUpdatePermission(PERMISSIONS.READ_ONLY)}>
                      {gettext('Read-Only')}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </td>
          <td style={{ width: '45%' }}>
            <span style={tokenCellStyle}>
              {item.api_token}
            </span>
          </td>
          <td style={{ width: '15%' }}>
            <div className="d-flex align-items-center">
              <IconButton
                icon="copy"
                onClick={this.onCopyAPIToken}
                style={{ marginRight: '8px', opacity: isOperationShow ? 1 : 0.3 }}
              />
              <IconButton
                icon="delete"
                className="text-danger"
                onClick={this.toggleDeleteDialog}
                style={{ opacity: isOperationShow ? 1 : 0.3 }}
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
      isPermissionDropdownOpen: false,
    };
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
    this.setState({ permission, isPermissionDropdownOpen: false });
  };

  togglePermissionDropdown = () => {
    this.setState({ isPermissionDropdownOpen: !this.state.isPermissionDropdownOpen });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    const { tokens, isLoading, isCreating, appName, permission, isItemFreezed, isPermissionDropdownOpen } = this.state;
    const { projectUuid, projectName, toggle } = this.props;

    return (
      <Modal isOpen toggle={toggle} size="lg" style={{ maxWidth: '800px' }}>
        <ModalHeader toggle={toggle}>{gettext('API token')} <span className="text-primary">{projectName}</span></ModalHeader>
        <ModalBody style={{ minHeight: '400px', maxHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
          <div style={{ flexShrink: 0, position: 'relative', zIndex: 1000 }}>
            <Table>
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>{gettext('App name')}</th>
                  <th style={{ width: '40%' }}>{gettext('Permission')}</th>
                  <th style={{ width: '15%' }}></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Input
                      type="text"
                      value={appName}
                      onChange={this.handleAppNameChange}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), this.createToken())}
                    />
                  </td>
                  <td>
                    <Dropdown isOpen={isPermissionDropdownOpen} toggle={this.togglePermissionDropdown} className="w-100">
                      <DropdownToggle
                        caret
                        className="form-control w-100 text-left d-flex justify-content-between align-items-center"
                        style={{
                          backgroundColor: '#fff',
                          color: '#495057',
                          border: '1px solid #ced4da',
                          cursor: 'pointer',
                          height: '38px'
                        }}
                      >
                        <span>{permission === PERMISSIONS.READ_WRITE ? gettext('Read-Write') : gettext('Read-Only')}</span>
                      </DropdownToggle>
                      <DropdownMenu className="w-100">
                        <DropdownItem onClick={() => this.setPermission(PERMISSIONS.READ_WRITE)}>
                          {gettext('Read-Write')}
                        </DropdownItem>
                        <DropdownItem onClick={() => this.setPermission(PERMISSIONS.READ_ONLY)}>
                          {gettext('Read-Only')}
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
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

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, position: 'relative', zIndex: 1 }}>
            {isLoading ? (
              <div className="text-center">
                <div className="spinner-border" role="status" />
              </div>
            ) : tokens.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>{gettext('App name')}</th>
                    <th style={{ width: '20%' }}>{gettext('Permission')}</th>
                    <th style={{ width: '45%' }}>{gettext('Token')}</th>
                    <th style={{ width: '15%' }} />
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
