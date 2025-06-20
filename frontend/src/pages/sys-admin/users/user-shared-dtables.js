import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import Paginator from '../../../components/paginator';
import Nav from './user-nav';
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

  render() {
    const item = this.props.item;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-table-icon"><span className="dtable-font dtable-icon-table system-dtable-font" aria-hidden="true"></span></td>
          <td>
            {item.name}
          </td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.creator}</td>
          <td>{item.from_user_name ? item.from_user_name : '--'}</td>
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
  curPage: PropTypes.number,
  count: PropTypes.number,
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
    this.props.listDTablesByPage(this.props.curPage - 1);
  };

  getNextPageList = () => {
    this.props.listDTablesByPage(this.props.curPage + 1);
  };

  render() {
    const { loading, errorMsg, items, curPerPage, curPage, count } = this.props;
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
                <th width="20%">{gettext('Creator')}</th>
                <th width="20%">{gettext('From')}</th>
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
            currentPage={curPage}
            hasNextPage={Utils.hasNextPage(curPage, curPerPage, count)}
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

const userSharedDTablesPropTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class UserSharedDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      dtables: [],
      perPage: 25,
      currentPage: 1,
      count: 0,
      userInfo: {},
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    sysAdminServiceApi.sysAdminGetUser(email).then((res) => {
      this.setState({
        userInfo: res.data
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
    const email = decodeURIComponent(this.props.email);
    sysAdminServiceApi.sysAdminListUserSharedDTables(email, page, perPage).then((res) => {
      this.setState({
        loading: false,
        dtables: res.data.dtable_list,
        currentPage: page,
        count: res.data.count
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
            <Nav currentItem="shared-dtables" email={this.props.email} userName={this.state.userInfo.name} />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.dtables}
                curPerPage={this.state.perPage}
                curPage={this.state.currentPage}
                count={this.state.count}
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

UserSharedDTables.propTypes = userSharedDTablesPropTypes;

export default UserSharedDTables;
