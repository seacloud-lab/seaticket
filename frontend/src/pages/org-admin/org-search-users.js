import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Col, Form, FormGroup, Input, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { RoleStatusEditor, toaster, DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../components/loading';
import Paginator from '../../components/paginator';
import MainPanelTopbar from './main-panel-topbar';
import DeleteConfirmDialog from '../../components/dialog/orgadmin-dialog/delete-item-confirm-dialog';
import OrgUserInfo from '../../models/org-user';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import { gettext, siteRoot, loginUrl, username, orgID, mediaUrl } from '../../constants';
import { getStatusOptions } from '../../utils/role-status-utils';


const itemPropTypes = {
  user: PropTypes.object.isRequired,
  deleteUser: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      isOpIconShown: false,
      isDeleteDialogOpen: false,
      isExternalLinkDialogOpen: false,
      currentStatus: this.props.user.is_active ? 'active' : 'inactive',
    };
    this.statusArray = ['active', 'inactive'];
  }

  handleMouseOver = () => {
    if (!this.state.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.state.isItemFreezed) {
      this.setState({
        isItemMenuShow: false,
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };


  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.onUnfreezedItem();
      }
    });
  };

  onDropdownToggleClick = (e) => {
    e.preventDefault();
    this.toggleOperationMenu(e);
  };


  changeStatus = (st) => {
    let statusCode;
    if (st === 'active') {
      statusCode = 1;
    } else {
      statusCode = 0;
    }

    orgAdminServiceApi.orgAdminChangeOrgUserStatus(orgID, this.props.user.email, statusCode).then(res => {
      this.setState({
        currentStatus: statusCode === 1 ? 'active' : 'inactive',
        highlight: false,
        showMenu: false,
      });
      toaster.success(gettext('Edit succeeded.'));
    }).catch(error => {
      if (error.response && error.response.status === 409) { // maybe over limit
        toaster.danger(gettext('The number of users exceeds the limit of your current plan.'));
      } else {
        let errMessage = Utils.getErrorMsg(error);
        if (errMessage === gettext('Error')) {
          errMessage = gettext('Edit failed.');
        }
        toaster.danger(errMessage);
      }
    });
  };

  toggleDelete = () => {
    this.props.deleteUser(this.props.user);
    this.toggleDeleteDialog();
  };

  toggleResetPW = () => {
    const email = this.props.user.email;
    const name = this.props.user.name;
    toaster.success(gettext('Resetting user\'s password, please wait for a moment.'));
    orgAdminServiceApi.orgAdminResetOrgUserPassword(orgID, email).then(res => {
      let msg;
      msg = gettext('Successfully reset password to %(passwd)s for user %(user)s.');
      msg = msg.replace('%(passwd)s', res.data.new_password);
      msg = msg.replace('%(user)s', name);
      toaster.success(msg, {
        duration: 15
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };


  render() {
    let { user } = this.props;
    const { currentStatus } = this.state;
    let href = siteRoot + 'org/useradmin/info/' + encodeURIComponent(user.email) + '/';
    let isOperationMenuShow = (user.email !== username) && this.state.isOpIconShown;
    const statusOptions = getStatusOptions(this.statusArray);
    const statusOption = statusOptions.find(option => option.value === currentStatus) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver}
          onMouseLeave={this.handleMouseOut}>
          <td>
            <a href={href} className="font-weight-normal">{user.name}</a>
          </td>
          <td>
            <RoleStatusEditor
              isShowDropdownIcon={isOperationMenuShow}
              currentOption={statusOption}
              menuOptions={statusOptions}
              onChangeOption={this.changeStatus}
              closeShowDropdownIcon={this.handleMouseOut}
            />
          </td>
          <td>{user.quota ? user.self_usage + ' / ' + user.quota : user.self_usage}</td>
          <td>{user.ctime} / {user.last_login ? user.last_login : '--'}</td>
          <td className="text-center cursor-pointer">
            {isOperationMenuShow && (
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                  onClick={this.onDropdownToggleClick}
                />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                  <DropdownItem onClick={this.toggleResetPW}>{gettext('ResetPwd')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {this.state.isDeleteDialogOpen && (
          <DeleteConfirmDialog
            headerText={gettext('Delete user')}
            toggle={this.toggleDeleteDialog}
            onDelete={this.toggleDelete}
            itemName={user.name}
            isOpen={this.state.isDeleteDialogOpen}
          />
        )}
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
  curPerPage: PropTypes.number,
  resetPerPage: PropTypes.func,
  getListByPage: PropTypes.func,
  deleteUser: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPage = () => {
    this.props.getListByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, deleteUser } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      if (items.length === 0) {
        return (
          <DTableEmptyTip text={gettext('No bases')} src={`${mediaUrl}img/no-items-tip.png`} />
        );
      } else {
        return (
          <Fragment>
            <table>
              <thead>
                <tr>
                  <th width="30%">{gettext('Name')}</th>
                  <th width="15%">{gettext('Status')}</th>
                  <th width="20%">{gettext('Create at / Last login')}</th>
                  <th width="20%" className="text-center">{gettext('Operations')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  return (<Item
                    key={index}
                    user={item}
                    deleteUser={deleteUser}
                  />);
                })}
              </tbody>
            </table>
            <Paginator
              gotoPreviousPage={this.getPreviousPage}
              gotoNextPage={this.getNextPage}
              currentPage={this.props.currentPage}
              hasNextPage={this.props.hasNextPage}
              curPerPage={this.props.curPerPage}
              resetPerPage={this.props.resetPerPage}
            />
          </Fragment>
        );
      }
    }
  }
}

Content.propTypes = contentPropTypes;

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgSearchUsers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      loading: true,
      errorMsg: '',
      currentPage: 1,
      perPage: 100,
      hasNextPage: false,
      userList: [],
      isSubmitBtnActive: false,
      count: 0
    };
  }

  componentDidMount() {
    let params = (new URL(document.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      query: params.get('query') || '',
      perPage: parseInt(params.get('per_page') || perPage),
      currentPage: parseInt(params.get('page') || currentPage),
    }, () => {
      this.getItems(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getItems(1);
    });
  };

  getSearchUsers = (e) => {
    e.preventDefault();
    this.getItems(1);
  };

  getItems = (page) => {
    let { query, perPage } = this.state;
    orgAdminServiceApi.orgAdminSearchUsers(orgID, query.trim(), page, perPage).then(res => {
      let userList = res.data.user_list.map(item => {
        return new OrgUserInfo(item);
      });
      this.setState({
        userList: userList,
        loading: false,
        count: res.data.count,
        currentPage: page
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  };

  handleInputChange = (e) => {
    this.setState({
      query: e.target.value
    }, this.checkSubmitBtnActive);
  };

  checkSubmitBtnActive = () => {
    const { query } = this.state;
    this.setState({
      isSubmitBtnActive: query.trim()
    });
  };

  deleteUser = (user) => {
    orgAdminServiceApi.orgAdminDeleteOrgUser(orgID, user.email).then(res => {
      let newUserList = this.state.userList.filter(item => {
        return item.email !== user.email;
      });
      this.setState({ userList: newUserList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    let { currentPage, perPage, count, query, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Users')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search users')}</h4>
                <Form>
                  <FormGroup row>
                    <Col sm={5}>
                      <Input type="text" name="query" value={query} placeholder={gettext('Search users')}
                        onChange={this.handleInputChange}/>
                    </Col>
                  </FormGroup>
                  <FormGroup row>
                    <Col sm={{ size: 5 }}>
                      <button
                        className="btn btn-outline-primary" disabled={!isSubmitBtnActive}
                        onClick={this.getSearchUsers}>{gettext('Submit')}
                      </button>
                    </Col>
                  </FormGroup>
                </Form>
              </div>
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
                <Content
                  loading={this.state.loading}
                  errorMsg={this.state.errorMsg}
                  items={this.state.userList}
                  deleteUser={this.deleteUser}
                  currentPage={this.state.currentPage}
                  hasNextPage={Utils.hasNextPage(currentPage, perPage, count)}
                  curPerPage={this.state.perPage}
                  resetPerPage={this.resetPerPage}
                  getListByPage={this.getItems}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgSearchUsers.propTypes = propTypes;

export default OrgSearchUsers;
