import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { gettext, loginUrl, siteRoot, orgID, mediaUrl } from '../../constants';
import { Utils } from '../../utils/utils';
import dayjs from '../../utils/dayjs';
import Loading from '../../components/loading';
import Paginator from '../../components/paginator';
import MainPanelTopbar from './main-panel-topbar';

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
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No admin operation logs.')} />
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
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
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
      case 'group_create': return gettext('Create group');
      case 'group_transfer': return gettext('Transfer group');
      case 'group_delete': return gettext('Delete group');
      case 'user_add': return gettext('Add user');
      case 'user_delete': return gettext('Delete user');
      case 'user_activate': return gettext('Activate user');
      case 'user_deactivate': return gettext('Deactivate user');
      case 'base_delete': return gettext('Delete base');
      case 'base_restore': return gettext('Restore base');
      case 'department_create': return gettext('Create addressbook');
      case 'department_rename': return gettext('Rename addressbook');
      case 'department_delete': return gettext('Delete addressbook');
      default: return '';
    }
  };

  getOperationDetail = (item) => {
    let detail = item.detail;

    let userPageUrl = '';
    if (detail.username) {
      userPageUrl = siteRoot + 'org/useradmin/info/' + encodeURIComponent(detail.username) + '/';
    }
    let detailText = '';
    let groupPageUrl = '';
    let groupInfo = '';
    let departmentUrl = '';
    if (item.operation === 'group_create' || item.operation === 'group_delete' || item.operation === 'group_transfer') {
      groupPageUrl = siteRoot + 'org/groupadmin/' + detail.id + '/';
    } else if (detail.group_id) {
      groupPageUrl = siteRoot + 'org/groupadmin/' + detail.group_id + '/';
    }

    if (item.operation === 'department_create' || item.operation === 'department_rename') {
      departmentUrl = siteRoot + 'org/departmentadmin/groups/' + detail.id + '/';
    }

    if (detail.group_id && detail.group_name) {
      groupInfo = ' (' + gettext('Group') + ': <a href="' + groupPageUrl + '">' + detail.group_name + '</a>)';
    }

    switch (item.operation) {
      case 'group_create':
        detailText = gettext('Created group {group_name}')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_transfer':
        detailText = gettext('Transferred group {group_name} from {user_from} to {user_to}')
          .replace('{user_from}', '<span class="font-weight-bold">' + detail.from_nickname + '</span>')
          .replace('{user_to}', '<span class="font-weight-bold">' + detail.to_nickname + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_delete':
        detailText = gettext('Deleted group {group_name}')
          .replace('{group_name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'department_create':
        detailText = gettext('Created department {name}')
          .replace('{name}', '<a href="' + departmentUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'department_rename':
        detailText = gettext('Rename department from {old_name} to {new_name}')
          .replace('{old_name}', '<span class="font-weight-bold">' + detail.old_name + '</span>')
          .replace('{new_name}', '<a href="' + departmentUrl + '">' + detail.new_name + '</a>');
        return detailText;

      case 'department_delete':
        detailText = gettext('Deleted department {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'base_delete':
        detailText = gettext('Delete base {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>') + groupInfo;
        return detailText;

      case 'base_restore':
        detailText = gettext('Restore base {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>') + groupInfo;
        return detailText;

      case 'user_add':
        detailText = gettext('Added user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.nickname + '</a>');
        return detailText;

      case 'user_delete':
        detailText = gettext('Deleted user {user}')
          .replace('{user}', '<span class="font-weight-bold">' + detail.nickname + '</span>');
        return detailText;

      case 'user_activate':
        detailText = gettext('Activated user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.nickname + '</a>');
        return detailText;

      case 'user_deactivate':
        detailText = gettext('Deactivated user {user}')
          .replace('{user}', '<a href="' + userPageUrl + '">' + detail.nickname + '</a>');
        return detailText;

      default: return '';
    }
  };

  renderUser = (item) => {
    let userInfoHref = siteRoot + 'org/useradmin/info/' + item.email + '/';
    return (
      <a href={userInfoHref} className="font-weight-normal">{item.name}</a>
    );
  };

  render() {
    let { item } = this.props;
    return (
      <tr onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
        <td>{this.renderUser(item)}</td>
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

const OrgAdminOperationLogsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class OrgAdminOperationLogs extends Component {

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
    orgAdminServiceApi.orgAdminListAdminLogs(orgID, page, perPage).then((res) => {
      this.setState({
        logList: res.data.logs,
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
            <h2 className="heading">{gettext('Admin operation logs')}</h2>
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

OrgAdminOperationLogs.propTypes = OrgAdminOperationLogsPropTypes;

export default OrgAdminOperationLogs;
