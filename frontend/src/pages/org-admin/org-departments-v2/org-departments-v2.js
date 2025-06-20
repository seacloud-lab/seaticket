import React, { Fragment } from 'react';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext, orgID } from '../../../constants';
import { orgAdminServiceApi } from '../../../api/org-admin-service-api';
import { Utils } from '../../../utils/utils';
import Account from '../../../components/common/account';
import DepartmentNode from '../../dtable/model/department-node';
import DepartmentV2TreePanel from './departments-v2-tree-panel';
import DepartmentsV2MembersList from './departments-v2-members-list';
import AddDepartmentV2Dialog from '../../../components/dialog/orgadmin-dialog/add-department-v2-dialog';
import AddDepartMemberV2Dialog from '../../../components/dialog/orgadmin-dialog/add-depart-member-v2-dialog';
import RenameDepartmentV2Dialog from '../../../components/dialog/orgadmin-dialog/rename-department-v2-dialog';
import DeleteDepartmentV2ConfirmDialog from '../../../components/dialog/orgadmin-dialog/delete-department-v2-confirm-dialog';
import Loading from '../../../components/loading';
import AddUserToDepartmentsV2Dialog from '../../../components/dialog/orgadmin-dialog/add-user-to-departments-v2-dialog';

import '../../../css/system-departments-v2.css';

class OrgDepartmentsV2 extends React.Component {

  constructor(props) {
    super(props);
    const localSortItems = localStorage.getItem('departments-members-sort-items') || {};
    this.state = {
      rootNode: null,
      checkedDepartmentId: -1,
      operateNode: null,
      isAddDepartmentDialogShow: false,
      isAddMembersDialogShow: false,
      isRenameDepartmentDialogShow: false,
      isDeleteDepartmentDialogShow: false,
      membersList: [],
      isTopDepartmentLoading: false,
      isMembersListLoading: false,
      sortBy: localSortItems.sort_by || 'name', // 'name' or 'role'
      sortOrder: localSortItems.sort_order || 'asc', // 'asc' or 'desc',
      selectedUser: null,
      isAddUserToDepartmentsDialogShow: false
    };
  }

  componentDidMount() {
    this.setState({ isTopDepartmentLoading: true }, () => {
      this.listSubDepartments(-1, () => {
        this.setState({ isTopDepartmentLoading: false });
      });
    });
  }

  onChangeDepartment = (nodeId) => {
    this.setState({ checkedDepartmentId: nodeId }, this.loadDepartmentMembers(nodeId));
  };

  loadDepartmentMembers = (nodeId) => {
    if (nodeId === -1) {
      this.setState({ isMembersListLoading: false, membersList: [] });
      return;
    }
    this.setState({ isMembersListLoading: true });
    if (nodeId === 'other_users') {
      orgAdminServiceApi.orgAdminListAddressBookV2NonDepartmentUsers(orgID).then(res => {
        const { user_list: membersList } = res.data;
        this.setState({ membersList, isMembersListLoading: false });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    } else {
      orgAdminServiceApi.orgAdminListAddressBookV2DepartmentMembers(orgID, nodeId).then(res => {
        const { member_list: membersList } = res.data;
        this.setState({ membersList, isMembersListLoading: false });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  listSubDepartments = (nodeId, cb) => {
    const { rootNode } = this.state;
    const node = nodeId === -1 ? null : rootNode.findNodeById(nodeId);
    orgAdminServiceApi.orgAdminListAddressBookV2Departments(orgID, nodeId).then(res => {
      const { department_list } = res.data;
      const childrenNodes = department_list.map(department => new DepartmentNode({
        id: department.id,
        name: department.name,
        parentNode: node,
        idInOrg: department.id_in_org
      }));
      if (node) {
        node.setChildren(childrenNodes);
      } else {
        if (department_list && department_list.length > 0) {
          this.setState({
            rootNode: new DepartmentNode({
              id: department_list[0].id,
              name: department_list[0].name,
              idInOrg: department_list[0].id_in_org
            }),
            checkedDepartmentId: department_list[0].id
          });
          this.loadDepartmentMembers(department_list[0].id);
        }
      }
      cb && cb(childrenNodes);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getGroup = (nodeId, cb) => {
    orgAdminServiceApi.orgAdminGetAddressBookV2DepartmentGroup(orgID, nodeId).then(res => {
      cb && cb(res.data);
    }).catch(error => {
      if (error.response && error.response.status === 404) {
        cb && cb(null);
        return;
      }
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteGroup = (nodeId, cb) => {
    orgAdminServiceApi.orgAdminDeleteAddressBookV2DepartmentGroup(orgID, nodeId).then(() => {
      toaster.success(gettext('Group deleted'));
      cb && cb();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  createGroup = (nodeId, cb) => {
    orgAdminServiceApi.orgAdminCreateAddressBookV2DepartmentGroup(orgID, nodeId).then(res => {
      cb && cb(res.data);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleAddDepartment = (node) => {
    this.setState({ operateNode: node, isAddDepartmentDialogShow: !this.state.isAddDepartmentDialogShow });
  };

  toggleAddMembers = (node) => {
    this.setState({ operateNode: node, isAddMembersDialogShow: !this.state.isAddMembersDialogShow });
  };

  toggleRename = (node) => {
    this.setState({ operateNode: node, isRenameDepartmentDialogShow: !this.state.isRenameDepartmentDialogShow });
  };

  toggleDelete = (node) => {
    this.setState({ operateNode: node, isDeleteDepartmentDialogShow: !this.state.isDeleteDepartmentDialogShow });
  };

  addDepartment = (parentNode, department) => {
    parentNode.addChildren([new DepartmentNode({
      id: department.id,
      name: department.name,
      parentNode: parentNode,
      idInOrg: department.id_in_org
    })]);
  };

  setRootNode = (department) => {
    this.setState({ rootNode: new DepartmentNode({
      id: department.id,
      name: department.name,
      idInOrg: department.id_in_org
    }) });
  };

  renameDepartment = (node, department) => {
    node.id = department.id;
    node.name = department.name;
  };

  onDelete = () => {
    const { operateNode, checkedDepartmentId } = this.state;
    orgAdminServiceApi.orgAdminDeleteAddressBookV2Department(orgID, operateNode.id).then(() => {
      operateNode.parentNode.deleteChildById(operateNode.id);
      this.toggleDelete();
      if (operateNode.id === checkedDepartmentId && operateNode.parentNode.id !== -1) {
        this.onChangeDepartment(operateNode.parentNode.id);
      }
    }).catch(error => {
      if (error.response && error.response.status === 400) {
        toaster.danger(error.response.data.error_msg);
        return;
      }
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onMemberChanged = () => {
    const { checkedDepartmentId, operateNode } = this.state;
    if (checkedDepartmentId && operateNode && checkedDepartmentId !== operateNode.id) return;
    this.loadDepartmentMembers(operateNode.id);
  };

  setMemberStaff = (email, isStaff) => {
    const { checkedDepartmentId, membersList } = this.state;
    orgAdminServiceApi.orgAdminUpdateAddressBookV2DepartmentMember(orgID, checkedDepartmentId, email, { is_staff: isStaff }).then(res => {
      const member = res.data.member;
      const newMembersList = membersList.map(memberItem => {
        if (memberItem.email === email) return member;
        return memberItem;
      });
      this.setState({ membersList: newMembersList });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteMember = (email) => {
    const { checkedDepartmentId, membersList } = this.state;
    orgAdminServiceApi.orgAdminDeleteAddressBookV2DepartmentMember(orgID, checkedDepartmentId, email).then(() => {
      const newMembersList = membersList.filter(memberItem => memberItem.email !== email);
      this.setState({ membersList: newMembersList });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renderNav() {
    return (
      <div className="main-panel-north border-left-show">
        <div className="cur-view-toolbar">
          <span className="sf2-icon-menu side-nav-toggle hidden-md-up d-md-none" title="Side Nav Menu"></span>
        </div>
        <div className="common-toolbar">
          <Account isAdminPanel={true}/>
        </div>
      </div>
    );
  }

  sortMembers = (items, sortBy, sortOrder) => {
    let comparator;
    switch (`${sortBy}-${sortOrder}`) {
      case 'name-asc':
        comparator = function (a, b) {
          var result = Utils.compareTwoWord(a.name, b.name);
          return result;
        };
        break;
      case 'name-desc':
        comparator = function (a, b) {
          var result = Utils.compareTwoWord(a.name, b.name);
          return -result;
        };
        break;
      case 'role-asc':
        comparator = function (a, b) {
          return a.is_staff && !b.is_staff ? -1 : 1;
        };
        break;
      case 'role-desc':
        comparator = function (a, b) {
          return a.is_staff && !b.is_staff ? 1 : -1;
        };
        break;
      default:
        comparator = function () {
          return true;
        };
    }
    items.sort((a, b) => {
      return comparator(a, b);
    });
    return items;
  };

  sortItems = (sortBy, sortOrder) => {
    localStorage.setItem('departments-members-sort-items', { sort_by: sortBy, sort_order: sortOrder });
    this.setState({
      sortBy: sortBy,
      sortOrder: sortOrder,
      membersList: this.sortMembers(this.state.membersList, sortBy, sortOrder),
    });
  };

  toggleAddUserToDepartments = (user) => {
    this.setState({
      selectedUser: user,
      isAddUserToDepartmentsDialogShow: !this.state.isAddUserToDepartmentsDialogShow,
    });
  };

  render() {
    const { rootNode, operateNode, checkedDepartmentId, isAddDepartmentDialogShow, isAddMembersDialogShow, membersList, isMembersListLoading, isTopDepartmentLoading,
      isRenameDepartmentDialogShow, isDeleteDepartmentDialogShow, sortBy, sortOrder, isAddUserToDepartmentsDialogShow, selectedUser } = this.state;
    return (
      <Fragment>
        {this.renderNav()}
        <div className="main-panel-center">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Departments')}</h2>
            <div className="cur-view-content d-flex flex-row p-0">
              {isTopDepartmentLoading && <Loading/>}
              {(!isTopDepartmentLoading && rootNode) &&
                <>
                  <DepartmentV2TreePanel
                    rootNode={rootNode}
                    checkedDepartmentId={checkedDepartmentId}
                    onChangeDepartment={this.onChangeDepartment}
                    listSubDepartments={this.listSubDepartments}
                    toggleAddDepartment={this.toggleAddDepartment}
                    toggleAddMembers={this.toggleAddMembers}
                    toggleRename={this.toggleRename}
                    toggleDelete={this.toggleDelete}
                  />
                  <DepartmentsV2MembersList
                    rootNode={rootNode}
                    checkedDepartmentId={checkedDepartmentId}
                    membersList={membersList}
                    isMembersListLoading={isMembersListLoading}
                    setMemberStaff={this.setMemberStaff}
                    deleteMember={this.deleteMember}
                    sortItems={this.sortItems}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    getGroup={this.getGroup}
                    deleteGroup={this.deleteGroup}
                    createGroup={this.createGroup}
                    toggleAddUserToDepartments={this.toggleAddUserToDepartments}
                  />
                </>
              }
              {(!isTopDepartmentLoading && !rootNode) &&
                <div className='top-department-button-container h-100 w-100'>
                  <Button onClick={this.toggleAddDepartment.bind(this, null)}>
                    {gettext('Enable departments feature')}
                  </Button>
                </div>
              }
            </div>
          </div>
        </div>
        {isAddDepartmentDialogShow &&
          <AddDepartmentV2Dialog
            parentNode={operateNode}
            toggle={this.toggleAddDepartment}
            addDepartment={this.addDepartment}
            setRootNode={this.setRootNode}
          />
        }
        {isAddMembersDialogShow &&
          <AddDepartMemberV2Dialog
            toggle={this.toggleAddMembers}
            nodeId={operateNode.id}
            onMemberChanged={this.onMemberChanged}
          />
        }
        {isRenameDepartmentDialogShow &&
          <RenameDepartmentV2Dialog
            node={operateNode}
            toggle={this.toggleRename}
            renameDepartment={this.renameDepartment}
          />
        }
        {isDeleteDepartmentDialogShow &&
          <DeleteDepartmentV2ConfirmDialog
            node={operateNode}
            toggle={this.toggleDelete}
            onDelete={this.onDelete}
          />
        }
        {isAddUserToDepartmentsDialogShow &&
          <AddUserToDepartmentsV2Dialog
            selectedUser={selectedUser}
            toggle={this.toggleAddUserToDepartments}
            loadDepartmentMembers={this.loadDepartmentMembers}
          />
        }
      </Fragment>
    );
  }

}

export default OrgDepartmentsV2;
