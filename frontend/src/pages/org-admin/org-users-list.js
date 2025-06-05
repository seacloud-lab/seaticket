import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';
import UserItem from './org-user-item';
import OrgPaginator from './org-paginator';

const propTypes = {
  currentTab: PropTypes.string.isRequired,
  initOrgUsersData: PropTypes.func.isRequired,
  toggleDelete: PropTypes.func.isRequired,
  orgUsers: PropTypes.array.isRequired,
  page: PropTypes.number.isRequired,
  pageNext: PropTypes.bool.isRequired,
  perPage: PropTypes.number.isRequired,
  onChangePageNum: PropTypes.func,
  onChangePerPage: PropTypes.func,
};

class OrgUsersList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    const { page, perPage } = this.props;
    this.props.initOrgUsersData(page, perPage);
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    let { orgUsers, page, pageNext, perPage } = this.props;
    return (
      <div className="cur-view-content">
        <table>
          <thead>
            <tr>
              <th width="20%">{gettext('Name')}</th>
              <th width="10%">ID</th>
              <th width="15%">{gettext('Status')}</th>
              <th width="15%">{gettext('Space used / Quota')}</th>
              <th width="20%">{gettext('Create at / Last login')}</th>
              <th width="20%" className="text-center">{gettext('Operations')}</th>
            </tr>
          </thead>
          <tbody>
            {orgUsers.map(item => {
              return (
                <UserItem
                  key={item.id}
                  user={item}
                  currentTab={this.props.currentTab}
                  isItemFreezed={this.state.isItemFreezed}
                  toggleDelete={this.props.toggleDelete}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                />
              );})}
          </tbody>
        </table>
        <OrgPaginator
          currentPage={page}
          hasNextPage={pageNext}
          currentPerPage={perPage}
          goToPreviousPage={() => this.props.onChangePageNum(-1)}
          goToNextPage={() => this.props.onChangePageNum(1)}
          changePerPage={this.props.onChangePerPage}
        />
      </div>
    );
  }
}

OrgUsersList.propTypes = propTypes;

export default OrgUsersList;
