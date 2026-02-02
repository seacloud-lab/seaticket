import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, Label } from 'reactstrap';
import classnames from 'classnames';
import { SearchInput, toaster, CenteredLoading } from '@/components';
import { Utils } from '@/utils/utils';
import { gettext, isOrgContext } from '@/constants/config';
import homeAPI from '../api';
import UserSelect from '@/components/user-select';
import GroupMembers from './group-members';


const propTypes = {
  groupID: PropTypes.number.isRequired,
  isOwner: PropTypes.bool.isRequired,
  toggleManageMembersDialog: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired
};

class ListAndAddGroupMembers extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groupMembers: [],
      searchMembers: [],
      selectedOption: [],
      errMessage: [],
      isItemFreezed: false,
      isLoading: true,
      searchValue: ''
    };
  }

  componentDidMount() {
    homeAPI.listGroupMembers(this.props.groupID).then((res) => {
      this.setState({
        groupMembers: res.data,
        isLoading: false,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.setState({
        isLoading: false,
      });
    });
  }

  onSelectChange = (option) => {
    this.setState({
      selectedOption: option,
      errMessage: []
    });
  };

  clearSelect = () => {
    this.onSelectChange([]);
  };

  addGroupMember = () => {
    let emails = [];
    for (let i = 0; i < this.state.selectedOption.length; i++) {
      emails.push(this.state.selectedOption[i].email);
    }
    homeAPI.addGroupMembers(this.props.groupID, emails).then((res) => {
      this.props.loadWorkspaceList();
      const newMembers = res.data.success;
      this.setState({
        groupMembers: [].concat(newMembers, this.state.groupMembers),
        selectedOption: [],
      });
      this.clearSelect();
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

  toggleItemFreezed = (isFreezed) => {
    this.setState({
      isItemFreezed: isFreezed
    });
  };

  toggle = () => {
    this.props.toggleManageMembersDialog();
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
    if (!isOrgContext) {
      showDeptBtn = false;
    }
    return (
      <Fragment>
        <Label>{gettext('Add group member')}</Label>
        <div className='add-members'>
          <UserSelect
            placeholder={gettext('Search users')}
            onSelectChange={this.onSelectChange}
            isMulti={true}
            className={classnames('add-members-select', { 'org-add-members-select': isOrgContext }, { 'user-select-right-btn': showDeptBtn })}
            selectedUsers={selectedOption}
          />
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
        {(groupMembers.length > 10 || searchValue) && (
          <SearchInput
            value={searchValue}
            autoFocus={false}
            onChange={this.onSearchGroupMembers}
            size={30}
            className="search-group-members-input-wrapper"
            placeholder={gettext('Search group members')}
            onClear={this.clearValue}
          />
        )}
        <div className="manage-members">
          {this.state.isLoading ?
            <CenteredLoading style={{ minHeight: '200px' }} />
            :
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
          }
        </div>
      </Fragment>
    );
  }
}

ListAndAddGroupMembers.propTypes = propTypes;

export default ListAndAddGroupMembers;
