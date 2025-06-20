import React from 'react';
import PropTypes from 'prop-types';
import { Link, Router } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils.js';
import MainPanelTopbar from '../main-panel-topbar';
import { siteRoot, gettext } from '../../../constants';
import { AddDepartmentOperation, AddMemberOperation } from './common-operations';
import Bases from './dtable-bases';
import SubDepartments from './sub-departments';
import Members from './members';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api.js';

const propTypes = {
  onCloseSidePanel: PropTypes.func,
  groupID: PropTypes.string,
};

class DepartmentItem extends React.Component {

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
    sysAdminServiceApi.sysAdminGetDepartGroupInfo(groupID, true).then(res => {
      this.setState({
        isLoading: false,
        members: res.data.members,
        groups: res.data.groups,
        ancestorGroups: res.data.ancestor_groups,
        groupName: res.data.name,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        isLoading: false,
        members: [],
        groups: [],
        ancestorGroups: [],
        groupName: '',
      });
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
    const { isLoading, groupName, ancestorGroups, currentItem, groups, members } = this.state;
    return (
      <>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <>
            {currentItem === 'subDepartments' && <AddDepartmentOperation groupID={groupID} title={gettext('New sub-department')} onDepartChanged={this.onSubDepartChanged} />}
            {currentItem === 'members' && <AddMemberOperation groupID={groupID} onMemberChanged={this.onMemberChanged} />}
          </>
        </MainPanelTopbar>
        <div className="main-panel-center flex-row h-100">
          <div className="cur-view-container">
            <h2 className="heading">
              <Link to={siteRoot + 'sys/departments/'}>{gettext('Departments')}</Link>
              {ancestorGroups.map(ancestor => {
                const newHref = siteRoot + 'sys/departments/' + ancestor.id + '/';
                return <span key={ancestor.id}>{' / '}<Link to={newHref}>{ancestor.name}</Link></span>;
              })}
              <span>{' / '}{groupName}</span>
            </h2>
            <ul className="nav border-bottom mx-4">
              {this.navItems.map((item, index) => {
                return (
                  <li className="nav-item mr-2" key={index}>
                    <Link
                      to={`${siteRoot}sys/departments/${groupID}${item.urlPart}`}
                      className={`nav-link ${currentItem === item.name ? ' active' : ''}`}
                    >{item.text}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Router role='group'>
              <SubDepartments path="/" isLoading={isLoading} groups={groups} onDepartChanged={this.onSubDepartChanged}/>
              <Members path="members" isLoading={isLoading} members={members} onMemberChanged={this.onMemberChanged}/>
              <Bases path="bases" />
            </Router>
          </div>
        </div>
      </>
    );
  }
}

DepartmentItem.propTypes = propTypes;

export default DepartmentItem;
