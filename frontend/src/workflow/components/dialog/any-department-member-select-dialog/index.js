import React, { Fragment, } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../../utils/utils';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import Loading from '../../../../components/loading';
import Department from '../../../../models/department';
import DepartmentGroups from './department-groups';
import DepartmentGroupMembers from './department-group-members';
import DepartmentGroupMemberSelected from './selected-department-group-members';
import { enableAddressBookV2, mediaUrl } from '../../../../utils/constants';

import '../../../../css/manage-members-dialog.css';
import '../../../../css/group-departments.css';

const gettext = window.gettext;
const { isOrgContext, orgID } = window.app.pageOptions;

class AnyDepartmentUserSelectDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      departments: [],
      departmentMembers: [],
      newMembersTempObj: {},
      currentDepartment: {},
      departmentsLoading: true,
      membersLoading: true,
      selectedMemberMap: {},
      departmentsTree: [],
      currentMemberPage: 1,
      hasMore: true,
    };
  }

  componentDidMount() {
    this.getSelectedMembers();
    this.getDepartmentsList();
  }

  getSelectedMembers = () => {
    const { userList } = this.props;
    let selectedMemberMap = {};
    Array.isArray(userList) && userList.forEach(member => {
      selectedMemberMap[member.email] = true;
    });
    this.setState({ selectedMemberMap });
  };

  onError = (error) => {
    let errMsg = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  initDepartments(departments) {
    const parentIdMap = {};
    for (let i = 0; i < departments.length; i++) {
      let item = departments[i];
      parentIdMap[item.parent_id] = true;
    }
    return departments.map(depart => {
      depart.hasChild = !!parentIdMap[depart.id];
      depart.isExpanded = false;
      return depart;
    });
  }

  getDepartmentsList = () => {
    let listDepartmentsAPIName;
    if (enableAddressBookV2) {
      listDepartmentsAPIName = 'listAddressBookV2Departments';
    } else {
      listDepartmentsAPIName = 'listAddressBookDepartments';
    }
    dtableWebAPI[listDepartmentsAPIName]().then((res) => {
      let departments = res.data.departments.map(item => {
        return new Department(item);
      });
      let currentDepartment = departments.length > 0 ? departments[0] : {};
      let departmentsTree = this.initDepartments(departments);
      this.setState({
        departments: departments,
        currentDepartment: currentDepartment,
        departmentsLoading: false,
        departmentsTree: departmentsTree
      });
      if (isOrgContext) {
        this.getOrgMembers();
      } else if (Object.keys(currentDepartment).length > 0) {
        this.getMembers(currentDepartment.id);
      }
    }).catch(error => {
      this.onError(error);
    });
  };

  getMembers = (department_id) => {
    this.setState({ membersLoading: true });
    if (enableAddressBookV2) {
      dtableWebAPI.listAddressBookV2DepartmentMembers(department_id).then(res => {
        this.setState({
          departmentMembers: res.data.member_list,
          membersLoading: false
        });
      }).catch(error => {
        this.onError(error);
      });
    } else {
      dtableWebAPI.listAddressBookDepartmentMembers(department_id).then((res) => {
        this.setState({
          departmentMembers: res.data.members,
          membersLoading: false,
        });
      }).catch(error => {
        this.onError(error);
      });
    }
  };

  resetCurrentPage = () => {
    this.setState({ currentMemberPage: 1, hasMore: true });
  };

  getOrgMembers = async () => {
    await this.resetCurrentPage();
    this.setState({ membersLoading: true });
    let currentMemberPage = this.state.currentMemberPage;
    dtableWebAPI.getOrganizationMembers(orgID, currentMemberPage).then((res) => {
      this.setState({
        departmentMembers: res.data.members,
        membersLoading: false,
        currentMemberPage: currentMemberPage + 1,
        currentDepartment: {
          'name': gettext('All users'),
          'id': -1
        }
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  getMoreOrgMembers = async () => {
    let currentMemberPage = this.state.currentMemberPage;
    dtableWebAPI.getOrganizationMembers(orgID, currentMemberPage).then((res) => {
      let members = res.data.members;
      this.setState({
        departmentMembers: [...this.state.departmentMembers, ...members],
        currentMemberPage: currentMemberPage + 1,
        hasMore: members.length >= 20
      });
    }).catch(error => {
      this.setState({
        errorMsg: Utils.getErrorMsg(error),
      });
    });
  };

  toggle = () => {
    this.props.toggleDepartmentDetailDialog();
  };

  onMemberSelectedChange = (member) => {
    if (this.state.departmentMembers.indexOf(member) !== -1) {
      let newMembersTempObj = this.state.newMembersTempObj;
      if (member.email in newMembersTempObj) {
        delete newMembersTempObj[member.email];
      } else {
        newMembersTempObj[member.email] = member;
      }
      this.setState({ newMembersTempObj: newMembersTempObj });
    }
  };

  onAddMembers = () => {
    this.props.addUsers(Object.values(this.state.newMembersTempObj));
  };

  onRemoveMember = (email) => {
    let newMembersTempObj = this.state.newMembersTempObj;
    delete newMembersTempObj[email];
    this.setState({ newMembersTempObj: newMembersTempObj });
  };

  setCurrent = (department) => {
    this.setState({ currentDepartment: department });
  };

  selectAll = (members) => {
    let { newMembersTempObj, selectedMemberMap } = this.state;
    for (let member of members) {
      if (Object.keys(selectedMemberMap).indexOf(member.email) !== -1) {
        continue;
      }
      newMembersTempObj[member.email] = member;
    }
    this.setState({ newMembersTempObj: newMembersTempObj });
  };

  renderHeader = () => {
    const title = gettext('Select users');
    return <DTableModalHeader toggle={this.toggle}>{title}</DTableModalHeader>;
  };

  render() {
    let { departmentsLoading, departments } = this.state;
    if (departmentsLoading) {
      return (
        <Modal isOpen={true} toggle={this.toggle}>
          {this.renderHeader()}
          <ModalBody>
            <div className="d-flex flex-fill align-items-center"><Loading /></div>
          </ModalBody>
        </Modal>
      );
    }

    const emptyTips = (
      <Modal isOpen={true} toggle={this.toggle}>
        {this.renderHeader()}
        <ModalBody>
          <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No departments')} />
        </ModalBody>
      </Modal>
    );

    const details = (
      <Modal isOpen={true} toggle={this.toggle} className="department-dialog" style={{ maxWidth: '900px' }}>
        {this.renderHeader()}
        <ModalBody className="department-dialog-content">
          <DepartmentGroups
            departments={this.state.departments}
            getMembers={this.getMembers}
            setCurrent={this.setCurrent}
            currentDepartment={this.state.currentDepartment}
            loading={this.state.departmentsLoading}
            getOrgMembers={this.getOrgMembers}
            departmentsTree={this.state.departmentsTree}
          />
          <DepartmentGroupMembers
            members={this.state.departmentMembers}
            memberSelected={this.state.newMembersTempObj}
            onMemberSelectedChange={this.onMemberSelectedChange}
            currentDepartment={this.state.currentDepartment}
            selectAll={this.selectAll}
            loading={this.state.membersLoading}
            selectedMemberMap={this.state.selectedMemberMap}
            hasMore={this.state.hasMore}
            isLoadingMore={this.state.isLoadingMore}
            getMoreOrgMembers={this.getMoreOrgMembers}
          />
          <DepartmentGroupMemberSelected
            members={this.state.newMembersTempObj}
            onRemoveMember={this.onRemoveMember}
            onAddMembers={this.onAddMembers}
            onToggle={this.toggle}
          />
        </ModalBody>
      </Modal>
    );
    return (
      <Fragment>
        {(departments.length > 0 || isOrgContext) ? details : emptyTips}
      </Fragment>
    );
  }
}

AnyDepartmentUserSelectDialog.propTypes = {
  userList: PropTypes.array,
  toggleDepartmentDetailDialog: PropTypes.func,
  loadWorkspaceList: PropTypes.func,
  addUsers: PropTypes.func,
};

export default AnyDepartmentUserSelectDialog;
