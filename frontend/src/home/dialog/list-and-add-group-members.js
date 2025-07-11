import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { SearchInput, toaster } from '../../components';
import { Utils } from '../../utils/utils';
import { cloudMode, gettext, isOrgContext } from '../../constants/config';
import { seaQAAPI } from '../../api/web-api';
import UserSelect from '../../components/user-select';
import GroupMembers from './group-members';


const propTypes = {
  groupID: PropTypes.number.isRequired,
  isOwner: PropTypes.bool.isRequired,
  toggleManageMembersDialog: PropTypes.func.isRequired,
  toggleDepartmentDetailDialog: PropTypes.func,
  isAdmin: PropTypes.bool.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired
};

class ListAndAddGroupMembers extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groupMembers: [],
      searchMembers: [],
      selectedOption: null,
      errMessage: [],
      isItemFreezed: false,
      searchValue: ''
    };
  }

  componentDidMount() {
    this.listGroupMembers();
  }

  onSelectChange = (option) => {
    this.setState({
      selectedOption: option,
      errMessage: []
    });
  };

  addGroupMember = () => {
    let emails = [];
    for (let i = 0; i < this.state.selectedOption.length; i++) {
      emails.push(this.state.selectedOption[i].email);
    }
    seaQAAPI.addGroupMembers(this.props.groupID, emails).then((res) => {
      this.props.loadWorkspaceList();
      const newMembers = res.data.success;
      this.setState({
        groupMembers: [].concat(newMembers, this.state.groupMembers),
        selectedOption: null,
      });
      this.refs.userSelect.clearSelect();
      if (res.data.failed.length > 0) {
        this.setState({
          errMessage: res.data.failed
        });
      }
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  listGroupMembers = () => {
    seaQAAPI.listGroupMembers(this.props.groupID).then((res) => {
      this.setState({
        groupMembers: res.data
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  toggleItemFreezed = (isFreezed) => {
    this.setState({
      isItemFreezed: isFreezed
    });
  };

  toggle = () => {
    this.props.toggleManageMembersDialog();
  };

  toggleDepartmentDetailDialog = () => {
    this.toggle();
    this.props.toggleDepartmentDetailDialog();
  };

  changeMember = (targetMember) => {
    this.props.loadWorkspaceList();
    this.setState({
      groupMembers: this.state.groupMembers.map((item) => {
        if (item.email === targetMember.email) {
          item = targetMember;
        }
        return item;
      })
    });
  };

  deleteMember = (targetMember) => {
    this.props.loadWorkspaceList();
    const groupMembers = this.state.groupMembers;
    groupMembers.splice(groupMembers.indexOf(targetMember), 1);
    this.setState({
      groupMembers: groupMembers
    });
  };

  onSearchGroupMembers = (searchValue) => {
    const { groupMembers } = this.state;
    const value = searchValue.trim().toLowerCase();
    const searchMembers = groupMembers.filter(item => item.name.toLowerCase().indexOf(value) > -1);
    this.setState({ searchMembers, searchValue });
  };

  clearValue = () => {
    this.setState({ searchValue: '', searchMembers: [] });
  };

  render() {
    const { groupMembers, isItemFreezed, selectedOption, errMessage, searchValue, searchMembers } = this.state;
    const { groupID, isOwner, isAdmin } = this.props;
    let showDeptBtn = true;
    if (cloudMode && !isOrgContext) {
      showDeptBtn = false;
    }
    return (
      <Fragment>
        <p>{gettext('Add group member')}</p>
        <div className='add-members'>
          <UserSelect
            placeholder={gettext('Search users')}
            onSelectChange={this.onSelectChange}
            ref="userSelect"
            isMulti={true}
            className={classnames('add-members-select', { 'org-add-members-select': isOrgContext }, { 'user-select-right-btn': showDeptBtn })}
          />
          {showDeptBtn &&
            <span
              onClick={this.toggleDepartmentDetailDialog}
              className="dtable-font dtable-icon-add_members toggle-detail-btn">
            </span>
          }
          {selectedOption ?
            <Button color="secondary" onClick={this.addGroupMember}>{gettext('Submit')}</Button> :
            <Button color="secondary" disabled>{gettext('Submit')}</Button>
          }
        </div>
        {errMessage.length > 0 &&
          errMessage.map((item, index = 0) => {
            return (<div className="group-error error" key={index}>{item.error_msg}</div>);
          })
        }
        {(groupMembers.length > 10 || searchValue) &&
          <div className="search-input-container">
            <i className="search-icon dtable-font dtable-icon-search"></i>
            <SearchInput
              value={searchValue}
              autoFocus={false}
              onChange={this.onSearchGroupMembers}
              className="search-group-members-input"
              placeholder={gettext('Search group members')}
              onClear={this.clearValue}
            />
          </div>
        }
        <div className="manage-members">
          <GroupMembers
            groupMembers={searchValue ? searchMembers : groupMembers}
            groupID={groupID}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isItemFreezed={isItemFreezed}
            toggleItemFreezed={this.toggleItemFreezed}
            changeMember={this.changeMember}
            deleteMember={this.deleteMember}
          />
        </div>
      </Fragment>
    );
  }
}

ListAndAddGroupMembers.propTypes = propTypes;

export default ListAndAddGroupMembers;
