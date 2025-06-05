import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { gettext, mediaUrl } from '../../../utils/constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import Paginator from '../../../components/paginator';
import CommonDatasetsNav from './common-datasets-nav';
import '../../../css/system-dtable.css';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  curPerPage: PropTypes.number,
  getPeriodicalSyncListByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
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

  getPreviousPageList = () => {
    this.props.getPeriodicalSyncListByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.getPeriodicalSyncListByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No periodical common dataset syncs')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="10%">{gettext('Dataset name')}</th>
                <th width="10%">{gettext('Source base name')}</th>
                <th width="10%">{gettext('Destination base name')}</th>
                <th width="6%">{gettext('Creator')}</th>
                <th width="12%">{gettext('Created at')}</th>
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
            currentPage={this.props.currentPage}
            hasNextPage={this.props.hasNextPage}
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
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false
    });
    this.props.onUnfreezedItem();
  };

  render() {
    const { item } = this.props;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td >{item.dataset_name}</td>
          <td>{item.src_dtable_name}</td>
          <td>{item.dst_dtable_name}</td>
          <td>{item.creator}</td>
          <td>{`${item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : '--'}`}</td>
        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const PeriodicalSyncsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class PeriodicalSyncs extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      PeriodicalSyncs: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.getPeriodicalSyncListByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getPeriodicalSyncListByPage(1);
    });
  };

  getPeriodicalSyncListByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListCommonDatasetPeriodicalSyncs(page, perPage).then((res) => {
      this.setState({
        loading: false,
        PeriodicalSyncs: res.data.periodical_sync_list,
        hasNextPage: res.data.periodical_sync_list.length >= perPage,
        currentPage: page
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
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
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <CommonDatasetsNav currentItem='periodical-syncs' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.PeriodicalSyncs}
                getPeriodicalSyncListByPage={this.getPeriodicalSyncListByPage}
                resetPerPage={this.resetPerPage}
                currentPage={this.state.currentPage}
                hasNextPage={this.state.hasNextPage}
                curPerPage={this.state.perPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

PeriodicalSyncs.propTypes = PeriodicalSyncsPropTypes;

export default PeriodicalSyncs;
