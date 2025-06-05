import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext, loginUrl, siteRoot, mediaUrl } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { DTableEmptyTip } from 'dtable-ui-component';
import dayjs from '../../../utils/dayjs';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import LogsNav from './logs-nav';
import MainPanelTopbar from '../main-panel-topbar';
import UserLink from '../user-link';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

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
        <DTableEmptyTip text={gettext('No action logs.')} src={`${mediaUrl}img/no-items-tip.png`} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="20%">{gettext('User')}</th>
                <th width="20%">{gettext('Organization')}</th>
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
      case 'group_transfer': return gettext('Transfer group');
      case 'group_rename': return gettext('Rename group');
      case 'group_delete': return gettext('Delete group');
      case 'group_table_create':
      case 'group_base_create': return gettext('Create group base');
      case 'group_table_rename':
      case 'group_base_rename': return gettext('Rename group base');
      case 'group_table_delete':
      case 'group_base_delete': return gettext('Delete group base');
      case 'group_table_restore':
      case 'group_base_restore': return gettext('Restore group base');
      case 'base_create': return gettext('Create base');
      case 'base_rename': return gettext('Rename base');
      case 'base_delete': return gettext('Delete base');
      case 'base_restore': return gettext('Restore base');
      case 'account_delete': return gettext('Delete account');
      default: return '';
    }
  };

  getOperationDetail = (item) => {
    let detail = item.detail;
    let detailText = '';
    let groupPageUrl = siteRoot + 'sys/groups/' + detail.id + '/dtables/';

    switch (item.operation) {
      case 'group_transfer':
        detailText = gettext('Transferred group {group_name} from {user_from} to {user_to}')
          .replace('{user_from}', '<span class="font-weight-bold">' + detail.from_nickname + '</span>')
          .replace('{user_to}', '<span class="font-weight-bold">' + detail.to_nickname + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_rename':
        detailText = gettext('Rename group from {old_group_name} to {new_group_name}')
          .replace('{old_group_name}', '<span class="font-weight-bold">' + detail.old_name + '</span>')
          .replace('{new_group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_delete':
        detailText = gettext('Deleted group {group_name}')
          .replace('{group_name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'group_table_create':
      case 'group_base_create':
        detailText = gettext('Create base {dtable_name} in group {group_name}')
          .replace('{dtable_name}', '<span class="font-weight-bold">' + detail.dtable_name + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_table_rename':
      case 'group_base_rename':
        detailText = gettext('Rename base from {old_dtable_name} to {new_dtable_name} in group {group_name}')
          .replace('{old_dtable_name}', '<span class="font-weight-bold">' + detail.old_dtable_name + '</span>')
          .replace('{new_dtable_name}', '<span class="font-weight-bold">' + detail.new_dtable_name + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_table_delete':
      case 'group_base_delete':
        detailText = gettext('Deleted base {dtable_name} in group {group_name}')
          .replace('{dtable_name}', '<span class="font-weight-bold">' + detail.dtable_name + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'group_table_restore':
      case 'group_base_restore':
        detailText = gettext('Restore base {dtable_name} in group {group_name}')
          .replace('{dtable_name}', '<span class="font-weight-bold">' + detail.dtable_name + '</span>')
          .replace('{group_name}', '<a href="' + groupPageUrl + '">' + detail.name + '</a>');
        return detailText;

      case 'base_create':
        detailText = gettext('Create base {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'base_rename':
        detailText = gettext('Rename base {old_name} to {new_name}')
          .replace('{old_name}', '<span class="font-weight-bold">' + detail.old_name + '</span>')
          .replace('{new_name}', '<span class="font-weight-bold">' + detail.new_name + '</span>');
        return detailText;

      case 'base_delete':
        detailText = gettext('Delete base {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'base_restore':
        detailText = gettext('Restore base {name}')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>');
        return detailText;

      case 'account_delete':
        detailText = gettext('Delete account {name} <{contact_email}>')
          .replace('{name}', '<span class="font-weight-bold">' + detail.name + '</span>')
          .replace('{contact_email}', '<span class="font-weight-bold">' + detail.contact_email + '</span>');
        return detailText;

      default: return '';
    }
  };

  render() {
    let { item } = this.props;
    return (
      <tr onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
        <td><UserLink email={item.username} name={item.name} /></td>
        <td>
          {item.org_id <= 0 ? '--' : <a href={siteRoot + 'sys/organizations/' + item.org_id + '/info/'}>{item.org_name}</a>
          }
        </td>
        <td>{this.getOperationText(item.operation)}</td>
        <td>
          <span dangerouslySetInnerHTML={{ __html: this.getOperationDetail(item) }}></span>
        </td>
        <td>{dayjs(item.created_at).fromNow()}</td>
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const auditLogsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class AuditLogs extends Component {

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
    sysAdminServiceApi.sysAdminListAuditLogs(page, perPage).then((res) => {
      this.setState({
        logList: res.data.audit_log_list,
        loading: false,
        currentPage: page,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.count),
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
            <LogsNav currentItem="auditLogs" />
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

AuditLogs.propTypes = auditLogsPropTypes;

export default AuditLogs;
