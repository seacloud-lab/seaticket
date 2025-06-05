import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Modal, ModalBody, Button, Input, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import DtableSharePermissionEditor from '../../../components/select-editor/dtable-share-permission-editor';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../utils/constants';
import DeleteTokenDialog from './delete-token-dialog';

import '../../../css/share-link-dialog.css';

const apiTokenItemPropTypes = {
  item: PropTypes.object.isRequired,
  deleteAPIToken: PropTypes.func.isRequired,
  updateAPIToken: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

class APITokenItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
      isItemMenuShow: false,
      isDeleteTokenDialog: false,
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

  onDeleteAPIToken = () => {
    this.props.deleteAPIToken(this.props.item.app_name);
    this.onDeleteToggle();
  };

  onUpdateAPIToken = (permission) => {
    this.props.updateAPIToken(this.props.item.app_name, permission);
  };

  onCopyAPIToken = () => {
    let api_token = this.props.item.api_token;
    copy(api_token);
    toaster.success(gettext('API Token is copied to the clipboard.'));
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.props.onUnfreezedItem();
      }
    });
  };

  onDeleteToggle = () => {
    this.setState({ isDeleteTokenDialog: !this.state.isDeleteTokenDialog });
  };

  render() {
    let item = this.props.item;
    return (
      <Fragment>
        <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td className="name">{item.app_name}</td>
          <td>
            <DtableSharePermissionEditor
              isTextMode={true}
              isEditIconShow={this.state.isOperationShow}
              currentPermission={item.permission}
              onPermissionChanged={this.onUpdateAPIToken}
            />
          </td>
          <td>
            <span className="ellipsis">{item.api_token}</span>
            <span
              className={`dtable-font dtable-icon-copy-link action-icon ${this.state.isOperationShow ? '' : 'hide'}`}
              onClick={this.onCopyAPIToken}
            />
          </td>
          <td className="pl-5">
            {this.state.isOperationShow &&
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="i"
                  role="button"
                  className="dtable-font dtable-icon-more-level action-icon"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu mr-2">
                  <DropdownItem onClick={this.onDeleteToggle}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>}
          </td>
        </tr>
        {this.state.isDeleteTokenDialog &&
          <DeleteTokenDialog
            currentToken={item}
            handleSubmit={this.onDeleteAPIToken}
            deleteCancel={this.onDeleteToggle}
          />}
      </Fragment>
    );
  }
}

APITokenItem.propTypes = apiTokenItemPropTypes;


const apiTokenListContentPropTypes = {
  currentTable: PropTypes.object.isRequired,
};

class APITokenListContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      apiTokenList: [],
      permission: 'rw',
      appName: '',
      errorMsg: '',
      loading: true,
      isSubmitBtnActive: true,
      isItemFreezed: false,
    };
    this.workspaceID = this.props.currentTable.workspace_id;
    this.tableName = this.props.currentTable.name;
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  listAPITokens = () => {
    dtableWebAPI.listTableAPITokens(this.workspaceID, this.tableName).then((res) => {
      this.setState({
        apiTokenList: res.data.api_tokens,
        loading: false,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onInputChange = (e) => {
    let appName = e.target.value;
    this.setState({
      appName: appName,
    });
  };

  onKeyDown = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      this.addAPIToken();
    }
  };

  setPermission = (permission) => {
    this.setState({ permission: permission });
  };

  addAPIToken = () => {
    if (!this.state.appName) {
      return;
    }

    this.setState({
      isSubmitBtnActive: false,
    });
    const { appName, permission, apiTokenList } = this.state;

    dtableWebAPI.addTableAPIToken(this.workspaceID, this.tableName, appName, permission).then((res) => {
      apiTokenList.push(res.data);
      this.setState({
        apiTokenList: apiTokenList,
        isSubmitBtnActive: true,
        appName: '',
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.setState({
        isSubmitBtnActive: true,
        appName: '',
      });
    });
  };

  deleteAPIToken = (appName) => {
    dtableWebAPI.deleteTableAPIToken(this.workspaceID, this.tableName, appName).then((res) => {
      const apiTokenList = this.state.apiTokenList.filter(item => {
        return item.app_name !== appName;
      });
      this.setState({
        apiTokenList: apiTokenList,
      });
      toaster.success(gettext('API Token deleted'));
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  updateAPIToken = (appName, permission) => {
    dtableWebAPI.updateTableAPIToken(this.workspaceID, this.tableName, appName, permission).then((res) => {
      let userList = this.state.apiTokenList.filter(item => {
        if (item.app_name === appName) {
          item.permission = permission;
        }
        return item;
      });
      this.setState({
        userList: userList,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  componentDidMount() {
    this.listAPITokens();
  }

  render() {
    const renderAPITokenList = this.state.apiTokenList.map((item, index) => {
      return (
        <APITokenItem
          key={index}
          item={item}
          deleteAPIToken={this.deleteAPIToken}
          updateAPIToken={this.updateAPIToken}
          onFreezedItem={this.onFreezedItem}
          onUnfreezedItem={this.onUnfreezedItem}
          isItemFreezed={this.state.isItemFreezed}
        />
      );
    });
    return (
      <Fragment>
        {this.state.errorMsg &&
        <div className='w-100'>
          <p className="error text-center">{this.state.errorMsg}</p>
        </div>
        }
        {!this.state.errorMsg &&
        <div className='mx-5 mb-5' style={{ height: '100%' }}>
          <table>
            <thead>
              <tr>
                <th width="45%">{gettext('App name')}</th>
                <th width="40%">{gettext('Permission')}</th>
                <th width="15%"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Input
                    type="text"
                    id="appName"
                    value={this.state.appName}
                    onChange={this.onInputChange}
                    onKeyDown={this.onKeyDown}
                  />
                </td>
                <td>
                  <DtableSharePermissionEditor
                    isTextMode={false}
                    isEditIconShow={false}
                    currentPermission={this.state.permission}
                    onPermissionChanged={this.setPermission}
                  />
                </td>
                <td>
                  <Button onClick={this.addAPIToken} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
                </td>
              </tr>
            </tbody>
          </table>
          {this.state.apiTokenList.length !== 0 &&
          <div className='o-auto' style={{ height: 'calc(100% - 91px)' }}>
            <div className="h-100" style={{ maxHeight: '18rem' }}>
              <table>
                <thead>
                  <tr>
                    <th width="17%">{gettext('App name')}</th>
                    <th width="21%">{gettext('Permission')}</th>
                    <th width="52%">{gettext('Access token')}</th>
                    <th width="10%"></th>
                  </tr>
                </thead>
                <tbody>
                  {renderAPITokenList}
                </tbody>
              </table>
            </div>
          </div>
          }
          {this.state.loading &&
          <Loading/>
          }
        </div>
        }
      </Fragment>
    );
  }
}

APITokenListContent.propTypes = apiTokenListContentPropTypes;


const propTypes = {
  currentTable: PropTypes.object.isRequired,
  onTableAPITokenToggle: PropTypes.func.isRequired,
};


class TableAPITokenDialog extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let currentTable = this.props.currentTable;
    let name = currentTable.name;
    return (
      <Modal
        isOpen={true} className="share-dialog" style={{ maxWidth: '720px' }}
        toggle={this.props.onTableAPITokenToggle}
      >
        <DTableModalHeader toggle={this.props.onTableAPITokenToggle}>
          <span className="mr-1">{gettext('API Token')}</span>
          <span className="op-target" title={name}>{name}</span>
        </DTableModalHeader>
        <ModalBody className="share-dialog-content">
          <div className="column-flex-direction flex-fill">
            <APITokenListContent currentTable={currentTable} />
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

TableAPITokenDialog.propTypes = propTypes;

export default TableAPITokenDialog;
