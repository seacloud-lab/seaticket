import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import User from './user';
import { FixedWidthTable, Paginator } from '@/components';
import CenteredLoading from '@/components/centered-loading';

class Users extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
    this.columns = [
      { key: 'name', name: gettext('Name'), width: 0.3 },
      { key: 'status', name: gettext('Status'), width: 0.15 },
      { key: 'create_at_last_login', name: gettext('Create at / Last login'), width: 0.2 },
      { key: 'placeholder', name: '', width: 0.3 },
      { key: 'op', name: '', width: 44, isFixed: true },
    ];
  }

  componentDidMount() {
    const { page, perPage } = this.props;
    this.props.initOrgUsersData && this.props.initOrgUsersData(page, perPage);
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    let { users, page, pageNext, perPage, isLoading } = this.props;
    if (isLoading) {
      return <CenteredLoading />;
    }
    return (
      <>
        <FixedWidthTable columns={this.columns}>
          {users.map(user => {
            return (
              <User
                key={user.id}
                user={user}
                columns={this.columns}
                currentTab={this.props.currentTab}
                isItemFreezed={this.state.isItemFreezed}
                toggleDelete={this.props.toggleDelete}
                onFreezedItem={this.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            );
          })}
        </FixedWidthTable>
        <Paginator
          curPerPage={perPage}
          currentPage={page}
          hasNextPage={pageNext}
          goNextPage={() => this.props.onChangePageNum(1)}
          goPreviousPage={() => this.props.onChangePageNum(-1)}
          resetPerPage={this.props.onChangePerPage}
        />
      </>
    );
  }
}

Users.propTypes = {
  currentTab: PropTypes.string.isRequired,
  initOrgUsersData: PropTypes.func.isRequired,
  toggleDelete: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  pageNext: PropTypes.bool.isRequired,
  perPage: PropTypes.number.isRequired,
  onChangePageNum: PropTypes.func,
  onChangePerPage: PropTypes.func,
  isLoading: PropTypes.bool.isRequired,
};

export default Users;
