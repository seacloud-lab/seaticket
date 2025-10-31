import React, { Component, Fragment } from 'react';
import { gettext } from '@/constants';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import sysAdminAPI from '@/sys-admin/api';
import GroupsTable from '../groups/groups-table';

class OrgGroups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      orgName: '',
    };
  }

  componentDidMount() {
    sysAdminAPI.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({ orgName: res.data.org_name });
    });
  }

  render() {
    const { orgID, onCloseSidePanel } = this.props;
    return (
      <Fragment>
        <TopBar onCloseSidePanel={onCloseSidePanel} />
        <Main title={(<OrgTitle orgName={this.state.orgName} />)}>
          <OrgNav currentItem="groups" orgID={orgID} />
          <GroupsTable
            showPaginator={false}
            columns={[
              { name: gettext('Name'), key: 'name', width: 0.2 },
              { name: gettext('Creator'), key: 'creator_name', width: 0.2 },
              { name: '', key: 'placeholder', width: 0.4 },
              { name: gettext('Created at'), key: 'created_at', width: 0.2 },
              { name: '', key: 'op', width: 44, isFixed: true }
            ]}
            api={() => sysAdminAPI.sysAdminListOrgGroups(orgID)}
            onDelete={(group) => sysAdminAPI.sysAdminDismissGroupByID(group.id)}
          />
        </Main>
      </Fragment>
    );
  }
}

export default OrgGroups;
