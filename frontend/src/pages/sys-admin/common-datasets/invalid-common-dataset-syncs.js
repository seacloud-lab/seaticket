import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import Paginator from '../../../components/paginator';
import '../../../css/system-dtable.css';
import CommonDatasetsNav from './common-datasets-nav';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  adminDeleteCommonDatasetSync: PropTypes.func.isRequired,
  curPerPage: PropTypes.number,
  adminListInvalidCommonDatasetSync: PropTypes.func.isRequired,
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
    this.props.adminListInvalidCommonDatasetSync(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.adminListInvalidCommonDatasetSync(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No invalid common dataset syncs')} />
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
                <th width="10%">{gettext(/* Operations*/)}</th>
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
                  adminDeleteCommonDatasetSync={this.props.adminDeleteCommonDatasetSync}
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
  adminDeleteCommonDatasetSync: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
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
      isOpIconShow: false
    });
    this.props.onUnfreezedItem();
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  adminDeleteCommonDatasetSync = () => {
    this.props.adminDeleteCommonDatasetSync(this.props.item.id);
    this.toggleDeleteDialog();
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

  handleActionTypes = (actions) => {
    if (actions.length === 0) {
      return '';
    } else if (actions.length === 1) {
      return actions[0].type;
    } else {
      let action_types = [];
      actions.forEach(item => {
        action_types.push(item.type);
      });
      return action_types.join(' / ');
    }
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen } = this.state;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td >{item.dataset_name}</td>
          <td>{item.src_dtable_name}</td>
          <td>{item.dst_dtable_name}</td>
          <td>{item.creator}</td>
          <td>{`${item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : '--'}`}</td>
          <td>
            {isOpIconShown &&
            <OpMenu
              item={item}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
            />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete common dataset')}
            message={gettext('Are you sure you want to delete the common dataset ?')}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.adminDeleteCommonDatasetSync}
            confirmBtnText={gettext('Delete')}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const InvalidCommonDatasetSyncsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class InvalidCommonDatasetSyncs extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      invalidCommonDatasetSyncList: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false,
      isDeleteInvalidDialogOpen: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.adminListInvalidCommonDatasetSync(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.adminListInvalidCommonDatasetSync(1);
    });
  };

  adminListInvalidCommonDatasetSync = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListInvalidCommonDatasetSyncs(page, perPage).then((res) => {
      this.setState({
        loading: false,
        invalidCommonDatasetSyncList: res.data.invalid_sync_list,
        hasNextPage: res.data.invalid_sync_list.length >= perPage,
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

  adminDeleteCommonDatasetSync = (id) => {
    sysAdminServiceApi.sysAdminDeleteCommonDatasetSync(id).then(res => {
      let invalidCommonDatasetSyncList = this.state.invalidCommonDatasetSyncList.filter(item => {
        return item.id !== id;
      });
      this.setState({ invalidCommonDatasetSyncList: invalidCommonDatasetSyncList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  adminDeleteInvalidCommonDatasetSyncs = () => {
    if (this.state.invalidCommonDatasetSyncList.length) {
      sysAdminServiceApi.sysAdminDeleteCommonDatasetInvalidSyncs().then(res => {
        let invalidCommonDatasetSyncList = this.state.invalidCommonDatasetSyncList.filter(item => {
          return false;
        });
        this.setState({ invalidCommonDatasetSyncList: invalidCommonDatasetSyncList });
        toaster.success(gettext('Successfully deleted all common dataset invalid syncs.'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  toggleDeleteInvalidDialog = (e) => {
    if (this.state.invalidCommonDatasetSyncList.length) {
      if (e) {
        e.preventDefault();
      }
      this.setState({ isDeleteInvalidDialogOpen: !this.state.isDeleteInvalidDialogOpen });
    }
  };

  render() {
    const { isDeleteInvalidDialogOpen } = this.state;
    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    if (isDesktop) {
      MainPanelTopbarContainer = (
        <MainPanelTopbar>
          <Button className="btn btn-secondary operation-item" onClick={this.toggleDeleteInvalidDialog}>{gettext('Delete all invalid syncs')}</Button>
        </MainPanelTopbar>
      );
    } else {
      MainPanelTopbarContainer = (
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleDeleteInvalidDialog}>{gettext('Delete all invalid syncs')}</span>
        </MainPanelTopbar>
      );
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <CommonDatasetsNav currentItem='invalid-syncs' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.invalidCommonDatasetSyncList}
                adminDeleteCommonDatasetSync={this.adminDeleteCommonDatasetSync}
                adminListInvalidCommonDatasetSync={this.adminListInvalidCommonDatasetSync}
                resetPerPage={this.resetPerPage}
                currentPage={this.state.currentPage}
                hasNextPage={this.state.hasNextPage}
                curPerPage={this.state.perPage}
              />
            </div>
          </div>
        </div>
        {isDeleteInvalidDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete all invalid common dataset syncs')}
            message={gettext('Are you sure you want to delete all invalid common dataset syncs ?')}
            toggleDialog={this.toggleDeleteInvalidDialog}
            executeOperation={this.adminDeleteInvalidCommonDatasetSyncs}
            confirmBtnText={gettext('Delete')}
          />
        }
      </Fragment>
    );
  }
}

InvalidCommonDatasetSyncs.propTypes = InvalidCommonDatasetSyncsPropTypes;

export default InvalidCommonDatasetSyncs;
