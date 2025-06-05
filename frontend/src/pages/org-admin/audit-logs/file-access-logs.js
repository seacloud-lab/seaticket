import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext, loginUrl, orgID, mediaUrl, siteRoot } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { DTableEmptyTip } from 'dtable-ui-component';
import dayjs from '../../../utils/dayjs';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import LogsNav from './logs-nav';
import MainPanelTopbar from '../main-panel-topbar';
import { orgAdminServiceApi } from '../../../api/org-admin-service-api';

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
                <th width="10%">{gettext('User')}</th>
                <th width="10%">{gettext('Type')}</th>
                <th width="20%">{gettext('IP')}{' / '}{gettext('Device')}</th>
                <th width="10%">{gettext('Date')}</th>
                <th width="15%">{gettext('Base')}</th>
                <th width="35%">{gettext('File')}</th>
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

  renderUser = (item) => {
    let userInfoHref = siteRoot + 'org/useradmin/info/' + item.user + '/';
    if (item.user === 'AnonymousUser') {
      return 'AnonymousUser';
    }
    return (
      <a href={userInfoHref} className="font-weight-normal">{item.name}</a>
    );
  };


  render() {
    let { item } = this.props;
    return (
      <tr onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
        <td>
          {this.renderUser(item)}
        </td>
        <td>{item.etype}</td>
        <td>{item.ip}{' / '}{item.device || '--'}</td>
        <td>{dayjs(item.timestamp).fromNow()}</td>
        <td>
          {item.dtable_name ? item.dtable_name : gettext('Deleted')}
        </td>
        <td>{item.file_path}</td>
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const fileAccessLogsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class FileAccessLogs extends Component {

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
    orgAdminServiceApi.orgAdminListFileAccessLogs(orgID, page, perPage).then((res) => {
      this.setState({
        logList: res.data.file_access_log_list,
        loading: false,
        currentPage: page,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.count)
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
            <LogsNav currentItem="fileAccessLogs" />
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

FileAccessLogs.propTypes = fileAccessLogsPropTypes;

export default FileAccessLogs;
