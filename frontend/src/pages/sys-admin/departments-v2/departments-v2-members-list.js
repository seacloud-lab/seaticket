import React from 'react';
import PropTypes from 'prop-types';
import { Table, Button } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { gettext, siteRoot, mediaUrl } from '../../../utils/constants';
import DepartmentsV2MembersItem from './departments-v2-members-item';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';

const propTypes = {
  rootNode: PropTypes.object,
  checkedDepartmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  membersList: PropTypes.array,
  isMembersListLoading: PropTypes.bool,
  setMemberStaff: PropTypes.func,
  sortItems: PropTypes.func,
  sortOrder: PropTypes.string,
  sortBy: PropTypes.string,
  deleteMember: PropTypes.func,
  createGroup: PropTypes.func,
  getGroup: PropTypes.func,
  deleteGroup: PropTypes.func,
  toggleAddUserToDepartments: PropTypes.func,
};

class DepartmentsV2MembersList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      activeNav: 'members',
      group: null,
      isDeleteGroupDialogShow: false
    };
  }

  componentDidMount() {
    const { checkedDepartmentId, rootNode } = this.props;
    this.getGroup(checkedDepartmentId === -1 ? rootNode.id : checkedDepartmentId);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.checkedDepartmentId !== nextProps.checkedDepartmentId) {
      if (nextProps.checkedDepartmentId === 'other_users') {
        this.setState({ activeNav: 'members' });
        return;
      }
      this.getGroup(nextProps.checkedDepartmentId);
    }
  }

  freezeItem = () => {
    this.setState({ isItemFreezed: true });
  };

  unfreezeItem = () => {
    this.setState({ isItemFreezed: false });
  };

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: !this.state.isItemFreezed });
  };

  getDepartmentName = () => {
    const { rootNode, checkedDepartmentId } = this.props;
    if (!rootNode) return '';
    if (checkedDepartmentId === 'other_users') {
      return gettext('Other users not in any department');
    }
    let name = '';
    let arr = [rootNode];
    while (!name && arr.length > 0) {
      let curr = arr.shift();
      if (curr.id === checkedDepartmentId) {
        name = curr.name;
      } else if (curr.children && curr.children.length > 0) {
        arr.push(...curr.children);
      }
    }
    return name || rootNode.name;
  };

  sortByName = (e) => {
    e.preventDefault();
    const sortBy = 'name';
    let { sortOrder } = this.props;
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    this.props.sortItems(sortBy, sortOrder);
  };

  sortByRole = (e) => {
    e.preventDefault();
    const sortBy = 'role';
    let { sortOrder } = this.props;
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    this.props.sortItems(sortBy, sortOrder);
  };

  changeActiveNav = (activeNav) => {
    this.setState({ activeNav });
  };

  onCreateGroup = () => {
    const { checkedDepartmentId, rootNode } = this.props;
    this.props.createGroup(checkedDepartmentId === -1 ? rootNode.id : checkedDepartmentId, (group) => {
      toaster.success(gettext('Group created'));
      this.setState({ group });
    });
  };

  getGroup = (id) => {
    this.props.getGroup(id, (group) => {
      this.setState({ group });
    });
  };

  deleteGroup = () => {
    const { checkedDepartmentId } = this.props;
    this.props.deleteGroup(checkedDepartmentId, () => {
      this.setState({ group: null });
    });
  };

  toggleDeleteGroup = () => {
    this.setState({ isDeleteGroupDialogShow: !this.state.isDeleteGroupDialogShow });
  };

  render() {
    const { activeNav, group, isDeleteGroupDialogShow } = this.state;
    const { membersList, isMembersListLoading, sortBy, sortOrder, checkedDepartmentId } = this.props;
    const sortByName = sortBy === 'name';
    const sortByRole = sortBy === 'role';
    const sortIcon = <span className={`sort-dirent dtable-font dtable-icon-down3 ${sortOrder === 'asc' ? 'rotate-180' : ''}`}></span>;
    const isOtherUsers = checkedDepartmentId === 'other_users';

    return (
      <div className="department-content-main">
        <div className="department-content-main-name">{this.getDepartmentName()}</div>

        {!isOtherUsers &&
          <div className="cur-view-path tab-nav-container">
            <ul className="nav">
              <li className="nav-item">
                <span className={`nav-link ${activeNav === 'members' ? 'active' : ''}`} onClick={() => this.changeActiveNav('members')}>{gettext('Members')}</span>
              </li>
              <li className="nav-item">
                <span className={`nav-link ${activeNav === 'group' ? 'active' : ''}`} onClick={() => this.changeActiveNav('group')}>{gettext('Group')}</span>
              </li>
            </ul>
          </div>
        }

        {activeNav === 'members' &&
          <>
            {isMembersListLoading && <Loading />}
            {!isMembersListLoading && membersList.length > 0 &&
              <div className='cur-view-content'>
                <Table hover>
                  <thead>
                    {isOtherUsers &&
                      <tr>
                        <th width="60px"></th>
                        <th width="35%" onClick={this.sortByName}>{gettext('Name')}{' '}{sortByName && sortIcon}</th>
                        <th width="48%">{gettext('Contact email')}</th>
                        <th width="calc(17% - 60px)">{/* Operations */}</th>
                      </tr>
                    }
                    {!isOtherUsers &&
                      <tr>
                        <th width="60px"></th>
                        <th width="25%" onClick={this.sortByName}>{gettext('Name')}{' '}{sortByName && sortIcon}</th>
                        <th width="23%" onClick={this.sortByRole}>{gettext('Role')}{' '}{sortByRole && sortIcon}</th>
                        <th width="35%">{gettext('Contact email')}</th>
                        <th width="calc(17% - 60px)">{/* Operations */}</th>
                      </tr>
                    }
                  </thead>
                  <tbody>
                    {membersList.map((item, index) => {
                      return (
                        <DepartmentsV2MembersItem
                          key={index}
                          member={item}
                          isOtherUsers={isOtherUsers}
                          deleteMember={this.props.deleteMember}
                          setMemberStaff={this.props.setMemberStaff}
                          unfreezeItem={this.unfreezeItem}
                          freezeItem={this.freezeItem}
                          toggleItemFreezed={this.toggleItemFreezed}
                          isItemFreezed={this.state.isItemFreezed}
                          toggleAddUserToDepartments={this.props.toggleAddUserToDepartments}
                        />
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            }
            {!isMembersListLoading && membersList.length === 0 &&
              <DTableEmptyTip src={`${mediaUrl}img/member-list-empty-2x.png`} text={gettext('No members')} />
            }
          </>
        }
        {activeNav === 'group' &&
          <>
            {group &&
              <div className="group-info mx-4">
                <div className="info-item-heading">{gettext('Group name')}</div>
                <div><a href={`${siteRoot}sys/groups/${group.group_id}/dtables/`}>{group.group_name}</a></div>
                <div className="info-item-heading">{gettext('Group ID')}</div>
                <div>{group.group_id}</div>
                <div className='my-4'>
                  <button className='btn btn-outline-primary' onClick={this.toggleDeleteGroup}>
                    {gettext('Delete group')}
                  </button>
                </div>
              </div>
            }
            {!group &&
              <div className="create-group-info m-4">
                <Button color="secondary" onClick={this.onCreateGroup}>
                  {gettext('Create associated group')}
                </Button>
                <p className="small text-secondary mt-2 mb-0">
                  {gettext('Create an associated group for this department.')}
                </p>
                <p className="small text-secondary mt-2 mb-2">
                  {gettext('The group will contain all members of this department and sub-departments.')}
                </p>
              </div>
            }
          </>
        }
        {isDeleteGroupDialogShow &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete group')}
            message={gettext('Are you sure to delete the group?')}
            confirmBtnText={gettext('Delete')}
            executeOperation={this.deleteGroup}
            toggleDialog={this.toggleDeleteGroup}
          />
        }
      </div>
    );
  }
}

DepartmentsV2MembersList.propTypes = propTypes;

export default DepartmentsV2MembersList;
