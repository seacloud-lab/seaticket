import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { gettext, isOrgContext, orgID, mediaUrl } from '../../../constants';
import { seaQAAPI } from '../../../api/web-api';
import { orgAdminServiceApi } from '../../../api/org-admin-service-api';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { Utils } from '../../../utils/utils';
import Department from '../../../models/department';
import Loading from '../../loading';
import DepartmentsV2ListSelect from '../departments-v2-widgets/departments-v2-list-select';
import DepartmentsV2Selected from '../departments-v2-widgets/departments-v2-selected';

import '../../../css/add-user-to-departments.css';

const propTypes = {
  selectedUser: PropTypes.object,
  toggle: PropTypes.func,
  loadDepartmentMembers: PropTypes.func
};

class AddUserToDepartmentsV2Dialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      departments: [],
      departmentsTree: null,
      selectedDepartments: [],
      isLoading: true
    };
  }

  componentDidMount() {
    seaQAAPI.listAddressBookV2Departments().then(res => {
      const departments = res.data.departments.map(item => {
        return new Department(item);
      });
      const departmentsTree = this.initDepartments(departments);
      this.setState({
        departments: departments,
        isLoading: false,
        departmentsTree: departmentsTree,
      });
    }).catch(error => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }

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

  toggle = () => {
    this.props.toggle();
  };

  renderHeader = () => {
    const { selectedUser } = this.props;
    return (
      <DTableModalHeader toggle={this.toggle}>
        {gettext('Add {placeholder} to departments').replace('{placeholder}', selectedUser.name)}
      </DTableModalHeader>
    );
  };

  onSelectDepartment = (department) => {
    let selectedDepartments = this.state.selectedDepartments.slice();
    const included = !!selectedDepartments.find(dep => dep.id === department.id);
    if (included) {
      selectedDepartments = selectedDepartments.filter(dep => dep.id !== department.id);
    } else {
      selectedDepartments.push(department);
    }
    this.setState({ selectedDepartments });
  };

  addUserToDepartments = (departments) => {
    const departmentIds = departments.map(dep => dep.id);
    const { selectedUser } = this.props;
    let apiService;
    if (isOrgContext) {
      apiService = orgAdminServiceApi.orgAdminAddressBookV2AddUserToDepartments(orgID, selectedUser.email, departmentIds);
    } else {
      apiService = sysAdminServiceApi.sysAdminAddressBookV2AddUserToDepartments(selectedUser.email, departmentIds);
    }
    apiService.then(res => {
      const { success, failed } = res.data;
      success.forEach(department => {
        toaster.success(gettext('Added to {department}').replace('{department}', department.name));
      });
      failed.forEach(department => {
        toaster.danger(department.error_msg);
      });
      this.props.loadDepartmentMembers('other_users');
      this.toggle();
    }).catch(error => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    const { isLoading, departments, departmentsTree, selectedDepartments } = this.state;
    if (isLoading) {
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
          <DTableEmptyTip text={gettext('No departments')} src={`${mediaUrl}img/no-items-tip.png`} />
        </ModalBody>
      </Modal>
    );

    const details = (
      <Modal isOpen={true} toggle={this.toggle} className='department-dialog' style={{ maxWidth: '900px' }}>
        {this.renderHeader()}
        <ModalBody className='department-dialog-content'>
          <DepartmentsV2ListSelect
            departments={departments}
            departmentsTree={departmentsTree}
            selectedDepartments={selectedDepartments}
            onSelectDepartment={this.onSelectDepartment}
          />
          <DepartmentsV2Selected
            selectedDepartments={selectedDepartments}
            toggle={this.toggle}
            removeSelectedDepartment={this.onSelectDepartment}
            addUserToDepartments={this.addUserToDepartments}
          />
        </ModalBody>
      </Modal>
    );

    return (
      <Fragment>
        {departments.length > 0 ? details : emptyTips}
      </Fragment>
    );
  }

}

AddUserToDepartmentsV2Dialog.propTypes = propTypes;

export default AddUserToDepartmentsV2Dialog;
