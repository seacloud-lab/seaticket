import React from 'react';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { Utils } from '../../utils/utils';
import { toaster } from 'dtable-ui-component';
import DepartmentNode from './model/department-node';
import DepartmentsV2TreePanel from './departments-v2/departments-v2-tree-panel';
import DepartmentsV2MembersList from './departments-v2/departments-v2-members-list';
import DepartmentsV2DTablesList from './departments-v2/departments-v2-dtables-list';

import '../../css/departments-v2.css';

export default class MainPanelDepartmentsV2 extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      rootNodes: [],
      currentRootNode: null,
      checkedDepartmentId: null,
      isMembersListLoading: false,
      membersList: [],
      selectedMember: null,
      dtablesList: []
    };
  }

  componentDidMount() {
    dtableWebAPI.listAddressBookV2UserDepartments().then(res => {
      const rootNodes = res.data.department_list.map(department => this.buildDepartmentNode(department, null));
      this.setState({ rootNodes });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  buildDepartmentNode = (department, parentNode) => {
    const { sub_departments: subDepartments = [] } = department;
    const departmentNode = new DepartmentNode(
      {
        id: department.id,
        name: department.name,
        parentNode: parentNode,
        idInOrg: department.id_in_org,
        children: subDepartments.map(subDepartment => {
          return this.buildDepartmentNode(subDepartment, department);
        })
      }
    );
    return departmentNode;
  };

  onChangeDepartment = (rootNode, nodeId) => {
    this.setState({
      currentRootNode: rootNode,
      checkedDepartmentId: nodeId,
      selectedMember: null,
      dtablesList: []
    }, this.loadDepartmentMembers(nodeId));
  };

  loadDepartmentMembers = (nodeId) => {
    this.setState({ isMembersListLoading: true });
    dtableWebAPI.listAddressBookV2DepartmentMembers(nodeId).then(res => {
      this.setState({
        membersList: res.data.member_list,
        isMembersListLoading: false,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  listSubDepartments = (rootNode, nodeId, callback) => {
    this.setState({ currentRootNode: rootNode });
    dtableWebAPI.listAddressBookV2SubDepartments(nodeId).then(res => {
      const node = rootNode.findNodeById(nodeId);
      const childrenNodes = res.data.department_list.map(department => {
        return new DepartmentNode({
          id: department.id,
          name: department.name,
          parentNode: node,
          idInOrg: department.id_in_org
        });
      });
      node.setChildren(childrenNodes);
      callback && callback();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onSelectMember = (member) => {
    this.setState({ selectedMember: member }, () => {
      const { checkedDepartmentId, currentRootNode } = this.state;
      if (checkedDepartmentId === currentRootNode.id) {
        return;
      }
      this.loadMemberDTables(checkedDepartmentId, member.email);
    });
  };

  loadMemberDTables = (departmentId, email) => {
    dtableWebAPI.listAddressBookV2DepartmentMemberDTables(departmentId, email).then(res => {
      const { dtable_list: dtablesList } = res.data;
      this.setState({ dtablesList });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { rootNodes, currentRootNode, checkedDepartmentId, membersList, selectedMember, dtablesList } = this.state;
    return (
      <div className="main-panel-center dtable-center main-panel-dataset">
        <div className="cur-view-container d-flex flex-1 flex-column">
          <div className="cur-view-content p-0">
            <div className="h-100 d-flex">
              <DepartmentsV2TreePanel
                currentRootNode={currentRootNode}
                rootNodes={rootNodes}
                checkedDepartmentId={checkedDepartmentId}
                onChangeDepartment={this.onChangeDepartment}
              />
              <DepartmentsV2MembersList
                membersList={membersList}
                selectedMember={selectedMember}
                onSelectMember={this.onSelectMember}
                canShowDTables={currentRootNode && checkedDepartmentId !== currentRootNode.id}
              />
              <DepartmentsV2DTablesList
                dtablesList={dtablesList}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
