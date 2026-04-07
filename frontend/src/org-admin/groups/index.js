import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster, Paginator, CenteredLoading } from '@/components';
import { gettext, orgID } from '@/constants';
import orgAdminAPI from '../api';
import { Utils } from '@/utils/utils';
import OrgGroupInfo from '@/models/org-group';
import Group from './group';
import { TopBar, Main } from '../main-panel';
class Groups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      pageNext: false,
      perPage: 25,
      orgGroups: [],
      isItemFreezed: false,
      loading: false,
    };
  }

  componentDidMount() {
    const { page, perPage } = this.state;
    this.initData(page, perPage);
  }

  initData = (page, perPage) => {
    this.setState({ loading: true });
    orgAdminAPI.orgAdminListOrgGroups(orgID, page, perPage).then(res => {
      let orgGroups = res.data.groups.map(item => {
        return new OrgGroupInfo(item);
      });
      this.setState({
        loading: false,
        orgGroups: orgGroups,
        pageNext: res.data.page_next,
        page: res.data.page,
        perPage: res.data.per_page,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({ loading: false });
    });
  };


  onChangePageNum = (num) => {
    const { page: oldPage, perPage } = this.state;
    let newPage;
    if (num === 1) {
      newPage = oldPage + 1;
    } else {
      newPage = oldPage - 1;
    }
    this.setState({ page: newPage }, () => {
      this.initData(newPage, perPage);
    });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  deleteGroupItem = (group) => {
    orgAdminAPI.orgAdminDeleteOrgGroup(orgID, group.id).then(res => {
      this.setState({
        orgGroups: this.state.orgGroups.filter(item => item.id !== group.id)
      });
      const msg = gettext('%s deleted').replace('%s', group.groupName);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      if (error.response && error.response.data && error.response.data['error_msg']) {
        errMessage = error.response.data['error_msg'];
      }
      toaster.danger(errMessage);
    });
  };

  transferGroup = (groupID, receiverEmail) => {
    orgAdminAPI.orgAdminTransferOrgGroup(orgID, receiverEmail, groupID).then(res => {
      let newGroupList = this.state.orgGroups.map(item => {
        if (item.id === groupID) {
          item = new OrgGroupInfo(res.data);
        }
        return item;
      });
      this.setState({
        orgGroups: newGroupList
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  changePerPage = (newPerPage) => {
    const { perPage } = this.state;
    if (perPage === newPerPage) return;
    const newPage = 1;
    this.setState({
      perPage: newPerPage,
      page: newPage,
    }, () => {
      this.initData(newPage, newPerPage);
    });
  };

  render() {
    let groups = this.state.orgGroups;
    if (this.state.loading) {
      return (
        <>
          <TopBar onCloseSidePanel={this.props.onCloseSidePanel}/>
          <Main title={gettext('All groups')}>
            <CenteredLoading />
          </Main>
        </>
      );
    }
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <Main title={gettext('All groups')}>
          <table>
            <thead>
              <tr>
                <th width="25%">{gettext('Name')}</th>
                <th width="35%">{gettext('Owner')}</th>
                <th width="30%">{gettext('Created at')}</th>
                <th width="10%">{/* Operations */}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(item => {
                return (
                  <Group
                    key={item.id}
                    group={item}
                    isItemFreezed={this.state.isItemFreezed}
                    onFreezedItem={this.onFreezedItem}
                    onUnfreezedItem={this.onUnfreezedItem}
                    deleteGroupItem={this.deleteGroupItem}
                    transferGroup={this.transferGroup}
                  />
                );
              })}
            </tbody>
          </table>
          <Paginator
            curPerPage={this.state.perPage}
            currentPage={this.state.page}
            hasNextPage={this.state.pageNext}
            goNextPage={() => this.onChangePageNum(1)}
            goPreviousPage={() => this.onChangePageNum(-1)}
            resetPerPage={this.changePerPage}
          />
        </Main>
      </>
    );
  }
}

Groups.propTypes = {
  onCloseSidePanel: PropTypes.func
};

export default Groups;
