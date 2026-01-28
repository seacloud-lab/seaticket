import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import { ProjectsTable } from '@/components';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import sysAdminAPI from '@/sys-admin/api';

class OrgProjects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      orgName: '',
    };
  }

  componentDidMount() {
    sysAdminAPI.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({
        orgName: res.data.org_name
      });
    });
  }

  render() {
    const { onCloseSidePanel, orgID } = this.props;
    return (
      <Fragment>
        <TopBar onCloseSidePanel={onCloseSidePanel} />
        <Main title={(<OrgTitle orgName={this.state.orgName} />)}>
          <OrgNav currentItem="projects" orgID={orgID} />
          <ProjectsTable
            columns={[
              { name: '', key: 'icon', width: 44, isFixed: true },
              { name: gettext('Name'), key: 'name', width: 0.18 },
              { name: 'ID', key: 'uuid', width: 0.32 },
              { name: 'Owner', key: 'owner', width: 0.25 },
              { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
              { name: '', key: 'placeholder', width: 0.1 },
            ]}
            api={(page, perPage) => sysAdminAPI.sysAdminListOrgProjects(orgID, page, perPage)}
          />
        </Main>
      </Fragment>
    );
  }
}

OrgProjects.propTypes = {
  orgID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

export default OrgProjects;
