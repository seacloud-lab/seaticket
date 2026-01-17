import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { Loading } from '@/components';
import { gettext, siteRoot } from '@/constants';
import { Utils } from '@/utils/utils';
import toaster from '@/components/toaster';
import sysAdminAPI from '../api';
import { TopBar } from '../main-panel';
import Paginator from '@/components/paginator';
import StatisticNav from './statistic-nav';
import Picker from '../../project/main-panel/search/date-and-time-picker';

import '@/css/statistics.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  groupBy: PropTypes.string.isRequired
};

class Item extends Component {
  constructor(props) {
    super(props);
    this.state = {
      highlight: false
    };
  }

  handleMouseEnter = () => {
    this.setState({ highlight: true });
  };

  handleMouseLeave = () => {
    this.setState({ highlight: false });
  };

  getOrgURL = (orgID) => {
    return `${siteRoot}sys/organizations/${orgID}/info/`;
  };

  getUserURL = (owner) => {
    return `${siteRoot}sys/users/${encodeURIComponent(owner)}/`;
  };

  getGroupURL = (owner) => {
    const groupID = owner.split('@')[0];
    return `${siteRoot}sys/groups/${groupID}/members/`;
  };

  getOwnerURL = (owner) => {
    if (owner.indexOf('@seafile_group') !== -1) {
      return this.getGroupURL(owner);
    } else {
      return this.getUserURL(owner);
    }
  };

  render() {
    const { item, groupBy } = this.props;
    const { highlight } = this.state;

    return (
      <tr
        className={highlight ? 'tr-highlight' : ''}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        {groupBy === 'owner' && (
          <>
            <td>
              {item.org_name && item.org_id > 0 && (
                <Link to={this.getOrgURL(item.org_id)}>{item.org_name}</Link>
              )}
              {item.org_id === -1 && '-'}
              {item.org_id !== -1 && !item.org_name && item.org_id}
            </td>
            <td>
              {(item.nickname || item.group_name) && (
                <Link to={this.getOwnerURL(item.owner)}>
                  {item.group_name ? item.group_name : item.nickname}
                </Link>
              )}
              {!(item.nickname || item.group_name) && item.owner}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'workspace' && (
          <>
            <td>
              {item.org_name && item.org_id > 0 && (
                <Link to={this.getOrgURL(item.org_id)}>{item.org_name}</Link>
              )}
              {item.org_id === -1 && '-'}
              {item.org_id !== -1 && !item.org_name && item.org_id}
            </td>
            <td>
              {(item.workspace_name) && (
                <Link to={this.getOwnerURL(item.owner)}>
                  {item.workspace_name}
                </Link>
              )}
              {!(item.workspace_name) && item.owner}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'org_id' && (
          <>
            <td>
              {item.org_name && item.org_id > 0 && (
                <Link to={this.getOrgURL(item.org_id)}>{item.org_name}</Link>
              )}
              {item.org_id === -1 && '-'}
              {item.org_id !== -1 && !item.org_name && item.org_id}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number.isRequired,
  pageInfo: PropTypes.object.isRequired,
  getStatisticsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  groupBy: PropTypes.string.isRequired
};

class Content extends Component {
  getPreviousPage = () => {
    this.props.getStatisticsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPage = () => {
    this.props.getStatisticsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo, groupBy, curPerPage, resetPerPage } = this.props;

    if (loading) {
      return <Loading />;
    }

    if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    }

    if (items.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          {gettext('No items')}
        </div>
      );
    }

    return (
      <Fragment>
        <table className="table table-hover table-vcenter">
          <thead>
            {groupBy === 'owner' && (
              <tr>
                <th>{gettext('Organization')}</th>
                <th>{gettext('Users')}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'workspace' && (
              <tr>
                <th>{gettext('Organization')}</th>
                <th>{gettext('Workspace')}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'org_id' && (
              <tr>
                <th>{gettext('Organization')}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, index) => (
              <Item key={index} item={item} groupBy={groupBy} />
            ))}
          </tbody>
        </table>
        <Paginator
          gotoPreviousPage={this.getPreviousPage}
          gotoNextPage={this.getNextPage}
          currentPage={pageInfo.current_page}
          hasNextPage={pageInfo.has_next_page}
          canResetPerPage={true}
          curPerPage={curPerPage}
          resetPerPage={resetPerPage}
        />
      </Fragment>
    );
  }
}

Content.propTypes = contentPropTypes;

class Statistics extends Component {
  constructor(props) {
    super(props);
    this.state = {
      perPage: 25,
      currentPage: 1,
      date: dayjs(),
      isLoading: true,
      errorMsg: '',
      pageInfo: {
        current_page: 1,
        has_next_page: false
      },
      results: [],
      groupBy: 'owner'
    };
    this.initPage = 1;
  }

  componentDidMount() {
    this.getStatisticsByPage(this.state.currentPage);
  }

  getStatisticsByPage = (page) => {
    const { perPage, groupBy, date } = this.state;
    this.setState({ isLoading: true });

    sysAdminAPI.sysAdminGetAIStatistics(date.format('YYYY-MM-DD'), groupBy, page, perPage)
      .then(res => {
        this.setState({
          isLoading: false,
          results: res.data.results,
          currentPage: page,
          pageInfo: {
            current_page: page,
            has_next_page: Utils.hasNextPage(page, perPage, res.data.count)
          },
          errorMsg: ''
        });
      })
      .catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
        this.setState({
          isLoading: false,
          errorMsg: errMessage
        });
      });
  };

  onDateChange = (value) => {
    if (value && value.isValid()) {
      this.setState({
        date: value,
        currentPage: this.initPage,
        results: []
      }, () => {
        this.getStatisticsByPage(this.initPage);
      });
    }
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
      currentPage: this.initPage
    }, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  changeTabActive = (groupBy) => {
    this.setState({
      groupBy: groupBy,
      currentPage: this.initPage,
      results: []
    }, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  render() {
    const { isLoading, results, groupBy, perPage, pageInfo, errorMsg, date } = this.state;

    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <StatisticNav currentItem="ai" />
            <div className="cur-view-content">
              <div className="statistic-tabs">
                <div
                  className={`statistic-tab-item ${groupBy === 'owner' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('owner')}
                >
                  {gettext('Users')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'workspace' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('workspace')}
                >
                  {gettext('Workspaces')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'org_id' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('org_id')}
                >
                  {gettext('Organizations')}
                </div>
              </div>
              <div className="d-flex align-items-center mt-4 mb-4">
                <span className="mr-2">{`${gettext('Date')}:`}</span>
                <Picker
                  showHourAndMinute={false}
                  disabledDate={() => false}
                  value={date}
                  onChange={this.onDateChange}
                  inputWidth={118}
                />
              </div>
              <Content
                loading={isLoading}
                errorMsg={errorMsg}
                items={results}
                curPerPage={perPage}
                pageInfo={pageInfo}
                getStatisticsByPage={this.getStatisticsByPage}
                resetPerPage={this.resetPerPage}
                groupBy={groupBy}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

Statistics.propTypes = propTypes;

export default Statistics;
