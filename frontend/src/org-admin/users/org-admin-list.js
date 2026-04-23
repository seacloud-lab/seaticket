import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import User from './user';
import { FixedWidthTable, CenteredLoading } from '@/components';

import './org-admin-list.css';

class OrgAdminList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
    this.columns = [
      { key: 'name', name: gettext('Name'), width: 0.3 },
      { key: 'status', name: gettext('Status'), width: 0.15 },
      { key: 'create_at_last_login', name: gettext('Create at / Last login'), width: 0.5 },
      { key: 'op', name: '', width: 44, isFixed: true },
    ];
  }

  componentDidMount() {
    this.props.initOrgAdmin();
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    let orgAdminUsers = this.props.orgAdminUsers;
    let { isLoading } = this.props;
    if (isLoading) {
      return <CenteredLoading />;
    }

    return (
      <>
        <FixedWidthTable columns={this.columns}>
          {orgAdminUsers.map(user => {
            return (
              <User
                key={user.id}
                user={user}
                columns={this.columns}
                currentTab={this.props.currentTab}
                isItemFreezed={this.state.isItemFreezed}
                toggleDelete={this.props.toggleDelete}
                toggleRevokeAdmin={this.props.toggleRevokeAdmin}
                onFreezedItem={this.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            );
          })}
        </FixedWidthTable>
      </>
    );
  }
}

OrgAdminList.propTypes = {
  currentTab: PropTypes.string.isRequired,
  toggleDelete: PropTypes.func.isRequired,
  toggleRevokeAdmin: PropTypes.func.isRequired,
  orgAdminUsers: PropTypes.array.isRequired,
  initOrgAdmin: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default OrgAdminList;
