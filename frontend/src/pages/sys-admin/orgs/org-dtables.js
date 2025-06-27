import React, { Component, Fragment } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import OrgNav from './org-nav';
import Paginator from '../../../components/paginator';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      default:
        break;
    }
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  render() {
    const item = this.props.item;
    const file_size = item.file_size ? Utils.bytesToSize(item.file_size) : '--';

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-project-icon"><span className="dtable-font dtable-icon-table system-dtable-font" aria-hidden="true"></span></td>
          <td>
            {item.name}
          </td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>{file_size}</td>
        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number,
  pageInfo: PropTypes.object.isRequired,
  listDTablesByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listDTablesByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.listDTablesByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No bases')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="15%">{gettext('Name')}</th>
                <th width="30%">ID</th>
                <th width="10%">{gettext('Rows')}</th>
                <th width="15%">{gettext('Owner')}</th>
                <th width="15%">{gettext('Created at')}</th>
                <th width="10%">
                  {gettext('Size')}
                  <span className="dtable-font dtable-icon-use-help ml-1" id='dtable-icon-use-help-tip'>
                    <UncontrolledTooltip
                      placement="bottom"
                      target='dtable-icon-use-help-tip'
                    >
                      {gettext('The size of the assets of the base is not included')}
                    </UncontrolledTooltip>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
            canResetPerPage={true}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
          />
        </Fragment>
      );

      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const orgGroupsPropTypes = {
  orgID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class OrgDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      dtables: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1,
      orgName: '',
    };
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({
        orgName: res.data.org_name
      }, () => {
        let urlParams = (new URL(window.location)).searchParams;
        const { currentPage, perPage } = this.state;
        this.setState({
          perPage: parseInt(urlParams.get('per_page') || perPage),
          currentPage: parseInt(urlParams.get('page') || currentPage)
        }, () => {
          this.listDTablesByPage(this.state.currentPage);
        });
      });
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listDTablesByPage(1);
    });
  };

  listDTablesByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListOrgDTables(this.props.orgID, page, perPage).then((res) => {
      this.setState({
        loading: false,
        dtables: res.data.dtable_list,
        currentPage: page,
        pageInfo: {
          current_page: page,
          has_next_page: Utils.hasNextPage(page, perPage, res.data.count),
        },
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

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <OrgNav
              currentItem="dtables"
              orgID={this.props.orgID}
              orgName={this.state.orgName}
            />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.dtables}
                curPerPage={this.state.perPage}
                pageInfo={this.state.pageInfo}
                listDTablesByPage={this.listDTablesByPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgDTables.propTypes = orgGroupsPropTypes;

export default OrgDTables;
