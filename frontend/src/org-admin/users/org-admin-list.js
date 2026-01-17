import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import User from './user';
import CenteredLoading from '@/components/centered-loading';

import './org-admin-list.css';

class OrgAdminList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
    this.columns = [
      { key: 'name', name: gettext('Name'), width: '30%' },
      { key: 'status', name: gettext('Status'), width: '15%' },
      { key: 'create_at_last_login', name: gettext('Create at / Last login'), width: '20%' },
      { key: 'placeholder', name: '', width: '30%' },
      { key: 'op', width: '5%' },
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
        <table>
          <thead>
            <tr>
              {this.columns.map(c => (<th width={c.width} key={c.key}>{c.name}</th>))}
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
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
