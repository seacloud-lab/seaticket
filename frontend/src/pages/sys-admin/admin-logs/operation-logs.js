import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext, loginUrl, siteRoot, isPro, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { EmptyTip, Loading, Paginator } from '../../../components';
import dayjs from '../../../utils/dayjs';
import LogsNav from './logs-nav';
import MainPanelTopbar from '../main-panel-topbar';
import UserLink from '../user-link';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const { enableSysAdminViewRepo } = window.sysadmin.pageOptions;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  currentPage: PropTypes.number,
  perPage: PropTypes.number,
  hasNextPage: PropTypes.bool.isRequired,
  getLogsByPage: PropTypes.func,
  resetPerPage: PropTypes.func,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPage = () => {
    this.props.getLogsByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getLogsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, perPage, currentPage, hasNextPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No admin operation logs.')} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="20%">{gettext('Name')}</th>
                <th width="15%">{gettext('Operation')}</th>
                <th width="50%">{gettext('Details')}</th>
                <th width="15%">{gettext('Time')}</th>
              </tr>
            </thead>
            {items &&
              <tbody>
                {items.map((item, index) => {
                  return (<Item
                    key={index}
                    item={item}
                  />);
                })}
              </tbody>
            }
          </table>
          <Paginator
            goPreviousPage={this.getPreviousPage}
            goNextPage={this.getNextPage}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            curPerPage={perPage}
            resetPerPage={this.props.resetPerPage}
          />
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
    };
  }

  getOperationText = (operationType) => {
    switch (operationType) {
      case 'repo_create': return gettext('Create library');
      case 'repo_delete': return gettext('Delete library');
      case 'repo_transfer': return gettext('Transfer library');
      case 'group_create': return gettext('Create group');
      case 'group_transfer': return gettext('Transfer group');
      case 'group_delete': return gettext('Delete group');
      case 'base_delete': return gettext('Delete project');
      case 'base_restore': return gettext('Restore project');
      case 'base_repair': return gettext('Repair project');
      case 'user_add': return gettext('Add user');
      case 'user_delete': return gettext('Delete user');
      case 'user_activate': return gettext('Activate user');
      case 'user_deactivate': return gettext('Deactivate user');
      case 'user_set_org_admin': return gettext('Set org admin');
      case 'user_unset_org_admin': return gettext('Unset org admin');
      default: return '';
    }
  };

  getOperationDetail = (item) => {
    let detail = item.detail;

    let ownerPageUrl = '';
    if (detail.owner) {
      ownerPageUrl = siteRoot + 'sys/users/' + encodeURIComponent(detail.owner) + '/';
    }
    let userPageUrl = '';
    if (detail.username) {
      userPageUrl = siteRoot + 'sys/users/' + encodeURIComponent(detail.username) + '/';
    }
    let detailText = '';
    let repoPageUrl = '';
    let groupPageUrl = '';
    let orgPageUrl = '';
    let OGInfo = '';
    if (item.operation === 'repo_create' || item.operation === 'repo_delete' || item.operation === 'repo_transfer') {
      repoPageUrl = siteRoot + 'sys/libraries/' + detail.id + '/' + encodeURIComponent(detail.name) + '/';
    }
    if (item.operation === 'group_create' || item.operation === 'group_delete' || item.operation === 'group_transfer') {
      groupPageUrl = siteRoot + 'sys/groups/' + detail.id + '/projects/';
    } else if (detail.group_id) {
      groupPageUrl = siteRoot + 'sys/groups/' + detail.group_id + '/projects/';
    }

    if (detail.org_id) {
      orgPageUrl = siteRoot + 'sys/organizations/' + detail.org_id + '/info/';
    }

    if (detail.group_id && detail.group_name && detail.org_id && detail.org_name) {
      OGInfo = ' (' + gettext('Organization') + ': <a href="' + orgPageUrl + '">' + detail.org_name + '</a>, ' + gettext('Group') + ': <a href="' + groupPageUrl + '">' + detail.group_name + '</a>)';
    } else if (detail.group_id && detail.group_name) {
      OGInfo = ' (' + gettext('Group') + ': <a href="' + groupPageUrl + '">' + detail.group_name + '</a>)';
    } else if (detail.org_id && detail.org_name) {
      OGInfo = ' (' + gettext('Organization') + ': <a href="' + orgPageUrl + '">' + detail.org_name + '</a>)';
    }

    switch (item.operation) {
      case 'repo_create':
        detailText = gettext('Created library {library_name} with {owner} as its owner')
          .replace('{owner}', '<a href="' + ownerPageUrl + '">' + detail.owner + '</a>');
        if (isPro && enableSysAdminViewRepo) {
          detailText = detailText.replace('{library_name}', '<a href="' + repoPageUrl + '">' + detail.name + '</a>');
        } else {
          detailText = detailText.replace('{library_name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        }
        return detailText;

      case 'repo_delete':
        detailText = gettext('Deleted library {library_name}')
          .replace('{library_name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'repo_transfer':
        detailText = gettext('Transferred library {library_name} from {user_from} to {user_to}')
          .replace('{user_from}', '<span class="font-weight-bold">' + detail.from + '</span>')
          .replace('{user_to}', '<span class="font-weight-bold">' + detail.to + '</span>');
        if (isPro && enableSysAdminViewRepo) {
          detailText = detailText.replace('{library_name}', '<a href="' + repoPageUrl + '">' + detail.name + '</a>');
        } else {
          detailText = detailText.replace('{library_name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        }
        return detailText;

      case 'group_create':
        detailText = gettext('Created group {group_name}')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_transfer':
        detailText = gettext('Transferred group {group_name} from {user_from} to {user_to}')
          .replace('{user_from}', '<span class="font-weight-bold">' + detail.from_nickname + '</span>')
          .replace('{user_to}', '<span class="font-weight-bold">' + detail.to_nickname + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText + OGInfo;

      case 'group_delete':
        detailText = gettext('Deleted group {group_name}')
          .replace('{group_name}', '<span class="font-weight-bold">' + detail.name + '</span>') + OGInfo;
        return detailText;

      case 'base_delete':
        detailText = gettext('Delete project {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>') + OGInfo;
        return detailText;

      case 'base_restore':
        detailText = gettext('Restore project {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>') + OGInfo;
        return detailText;

      case 'base_repair':
        detailText = gettext('Repair project {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>') + OGInfo;
        return detailText;

      case 'user_add':
        detailText = gettext('Added user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'user_delete':
        detailText = gettext('Deleted user {user}')
          .replace('{user}', '<span class="font-weight-bold">' + detail.email + '</span>');
        return detailText;

      case 'user_activate':
        detailText = gettext('Activated user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'user_deactivate':
        detailText = gettext('Deactivated user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'user_set_org_admin':
        detailText = gettext('Set user {user} as org {org_name} admin')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.name + '</a>')
          .replace('{org_name}', '<a href="' + orgPageUrl + '">' + detail.org_name + '</a>');
        return detailText;

      case 'user_unset_org_admin':
        detailText = gettext('Unset user {user} as org {org_name} admin')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.name + '</a>')
          .replace('{org_name}', '<a href="' + orgPageUrl + '">' + detail.org_name + '</a>');
        return detailText;

      default: return '';
    }
  };

  render() {
    let { item } = this.props;
    return (
      <tr onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
        <td><UserLink email={item.email} name={item.name} /></td>
        <td>{this.getOperationText(item.operation)}</td>
        <td>
          <span dangerouslySetInnerHTML={{ __html: this.getOperationDetail(item) }}></span>
        </td>
        <td>{dayjs(item.datetime).fromNow()}</td>
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const adminOperationLogsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class AdminOperationLogs extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      logList: [],
      perPage: 100,
      currentPage: 1,
      hasNextPage: false,
    };
    this.initPage = 1;
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.getLogsByPage(this.state.currentPage);
    });
  }

  getLogsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListAdminLogs(page, perPage).then((res) => {
      this.setState({
        logList: res.data.data,
        loading: false,
        currentPage: page,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.total_count),
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
    }, () => this.getLogsByPage(this.initPage));
  };

  render() {
    let { logList, currentPage, perPage, hasNextPage } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <LogsNav currentItem="adminOperationLogs" />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={logList}
                currentPage={currentPage}
                perPage={perPage}
                hasNextPage={hasNextPage}
                getLogsByPage={this.getLogsByPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AdminOperationLogs.propTypes = adminOperationLogsPropTypes;

export default AdminOperationLogs;
