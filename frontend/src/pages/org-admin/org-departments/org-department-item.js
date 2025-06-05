import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link, Router } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import MainPanelTopbar from '../main-panel-topbar';
import AddNewOrgDepartment from './common-operations/add-new-org-department';
import AddMemberOperation from './common-operations/add-member-operation';
import SubDepartments from './sub-departments';
import Members from './members';
import Bases from './bases';
import { orgAdminServiceApi } from '../../../api/org-admin-service-api.js';
import { Utils } from '../../../utils/utils.js';
import { siteRoot, gettext, orgID } from '../../../utils/constants';


const propTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

class OrgDepartmentItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      groupName: '',
      ancestorGroups: [],
      members: [],
      groups: [],
    };
    this.navItems = [
      { name: 'subDepartments', urlPart: '/', text: gettext('Sub-departments') },
      { name: 'members', urlPart: '/members/', text: gettext('Members') },
      { name: 'bases', urlPart: '/bases/', text: gettext('Bases') },
    ];
  }

  componentDidMount() {
    this.initCurrentTab(this.props);
    this.getDepartmentInfo(this.props.groupID);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.initCurrentTab(nextProps);
    if (this.props.groupID !== nextProps.groupID) {
      this.getDepartmentInfo(nextProps.groupID);
    }
  }

  initCurrentTab = (props) => {
    let { '*': matchPath } = props;
    matchPath = matchPath || 'subDepartments';
    this.setState({ currentItem: matchPath });
  };

  getDepartmentInfo = (groupID) => {
    orgAdminServiceApi.orgAdminListGroupInfo(orgID, groupID, true).then(res => {
      const { ancestor_groups, members, groups, name } = res.data;
      this.setState({
        isLoading: false,
        ancestorGroups: ancestor_groups,
        members,
        groups,
        groupName: name,
      });
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onSubDepartChanged = () => {
    this.getDepartmentInfo(this.props.groupID);
  };

  onMemberChanged = () => {
    this.getDepartmentInfo(this.props.groupID);
  };

  render() {
    const { groupID } = this.props;
    const {
      members,
      groups,
      currentItem,
      ancestorGroups,
      groupName,
      isLoading,
    } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <Fragment>
            {currentItem === 'subDepartments' && (
              <AddNewOrgDepartment
                groupID={groupID}
                title={gettext('New sub-department')}
                onDepartChanged={this.onSubDepartChanged}
              />
            )}
            {currentItem === 'members' && (
              <AddMemberOperation
                groupID={groupID}
                onMemberChanged={this.onMemberChanged}
              />
            )}
          </Fragment>
        </MainPanelTopbar>
        <div className="main-panel-center flex-row h-100">
          <div className="cur-view-container o-auto">
            <h2 className="heading">
              <Link to={siteRoot + 'org/departmentadmin/'}>
                {gettext('Departments')}
              </Link>
              {ancestorGroups.map((ancestor) => {
                const newHref = `${siteRoot}org/departmentadmin/groups/${ancestor.id}/`;
                return (
                  <span key={ancestor.id}>
                    {' / '}
                    <Link to={newHref}>{ancestor.name}</Link>
                  </span>
                );
              })}
              <span>
                {' / '}
                {groupName}
              </span>
            </h2>
            <ul className="nav border-bottom mx-4">
              {this.navItems.map((item, index) => {
                return (
                  <li className="nav-item" key={index}>
                    <Link
                      to={`${siteRoot}org/departmentadmin/groups/${groupID}${item.urlPart}`}
                      className={`nav-link ${currentItem === item.name ? 'active' : ''}`}
                    >
                      {item.text}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Router role='group'>
              <SubDepartments
                path="/"
                isLoading={isLoading}
                groups={groups}
                onDepartChanged={this.onSubDepartChanged}
              />
              <Members
                path="/members/"
                isLoading={isLoading}
                members={members}
                onMemberChanged={this.onMemberChanged}
              />
              <Bases path="bases" groupID={groupID} />
            </Router>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgDepartmentItem.propTypes = propTypes;

export default OrgDepartmentItem;
