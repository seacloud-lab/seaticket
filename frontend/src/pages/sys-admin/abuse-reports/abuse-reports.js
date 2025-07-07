import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, EmptyTip, Loading, Paginator } from '../../../components';
import dayjs from '../../../utils/dayjs';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../constants';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  pageInfo: PropTypes.object,
  getListByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  updateAbuseReport: PropTypes.func.isRequired,
  hasNextPage: PropTypes.bool,
  page: PropTypes.number,
  perPage: PropTypes.number
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPage = () => {
    this.props.getListByPage(this.props.page - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.page + 1);
  };

  render() {
    const { loading, errorMsg, items, hasNextPage, page, resetPerPage, perPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No abuse reports')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="10%">{gettext('Base')}</th>
                <th width="10%">{'UUID'}</th>
                <th width="10%">{gettext('Reporter')}</th>
                <th width='17%'>{'Token'}</th>
                <th width='10%'>{gettext('Type')}</th>
                <th width='20%'>{gettext('Description')}</th>
                <th width="10%">{gettext('Created at')}</th>
                <th width='8%'>{gettext('Handled')}</th>
                <th width='5%'>{/* operation menu */}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  updateAbuseReport={this.props.updateAbuseReport}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
            currentPage={page}
            hasNextPage={hasNextPage}
            resetPerPage={resetPerPage}
            curPerPage={perPage}
          />
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  updateAbuseReport: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShow: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isTransferDialogOpen: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShow: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShow: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShow: false
    });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    const { item } = this.props;
    switch (operation) {
      case 'Resolved':
        this.updateAbuseReport(true, item.id);
        break;
      case 'Unresolved':
        this.updateAbuseReport(false, item.id);
        break;
      default:
        break;
    }
  };

  updateAbuseReport = (handled, id) => {
    this.props.updateAbuseReport(handled, id);
  };

  render() {
    const { item } = this.props;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>{item.dtable_name}</td>
          <td>{item.dtable_uuid}</td>
          <td>{item.reporter}</td>
          <td>{item.external_link_token}</td>
          <td>{item.abuse_type}</td>
          <td className="text-truncate" title={item.description} aria-label={item.description}>{item.description}</td>
          <td>
            <span title={dayjs(item.created_at).format('llll')}>{dayjs(item.create_time).fromNow()}</span>
          </td>
          <td>
            <span>{item.handled ? gettext('Resolved') : gettext('Unresolved')}</span>
          </td>
          <td>
            {this.state.isOpIconShow &&
              <OpMenu
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
                handled={item.handled}
              />
            }
          </td>
        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const AbuseReportsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class AbuseReports extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      abuseReportList: [],
      perPage: 25,
      page: 1,
      hasNextPage: false,
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { page, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      page: parseInt(urlParams.get('page') || page)
    }, () => {
      this.getAbuseReportListByPage(this.state.page);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getAbuseReportListByPage(this.state.page);
    });
  };

  getAbuseReportListByPage = (page) => {
    sysAdminServiceApi.sysAdminListAbuseReports(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        abuseReportList: res.data.abuse_report_list,
        hasNextPage: res.data.has_next_page,
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
          errorMsg: gettext('Please check the network')
        });
      }
    });
  };

  getListByPage = (page) => {
    this.setState({ page: page });
    this.getAbuseReportListByPage(page);
  };

  updateAbuseReport = (handled, id) => {
    sysAdminServiceApi.sysAdminUpdateAbuseReport(id, handled).then((res) => {
      const abuseReportList = this.state.abuseReportList.map((item, index) => {
        if (item.id === id) {
          item.handled = res.data.handled;
        }
        return item;
      });
      this.setState({
        abuseReportList: abuseReportList,
      });
      toaster.success(gettext('Abuse report updated'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Abuse reports')}</h2>
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.abuseReportList}
                hasNextPage={this.state.hasNextPage}
                perPage={this.state.perPage}
                page={this.state.page}
                getListByPage={this.getListByPage}
                resetPerPage={this.resetPerPage}
                updateAbuseReport={this.updateAbuseReport}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AbuseReports.propTypes = AbuseReportsPropTypes;

export default AbuseReports;
