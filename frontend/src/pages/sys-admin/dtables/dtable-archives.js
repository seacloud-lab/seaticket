import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, mediaUrl } from '../../../utils/constants';
import MainPanelTopBar from '../main-panel-topbar';
import DTableNav from './dtables-nav';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import ModalPortal from '../../../components/modal-portal';
import { Utils } from '../../../utils/utils';
import DeleteInvalidArchivesDialog from '../../dtable/dialog/delete-invalid-archives-dialog';
import DTableArchiveOpMenu from './archive-op-menu';
import ArchiveDTableBackupsDialog from '../../dtable/dialog/archive-dtable-backups-dialog';

import '../../../css/system-dtable.css';

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
      isArchiveBackupsDialogOpen: false,
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

  toggleArchiveDTableBackupsDialog = () => {
    this.setState({ isArchiveBackupsDialogOpen: !this.state.isArchiveBackupsDialogOpen });
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Backups':
        this.toggleArchiveDTableBackupsDialog();
        break;
      default:
        break;
    }
  };

  render() {
    const item = this.props.item;
    let storage = Utils.bytesToSize(item.storage);
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td><span className="dtable-font dtable-icon-archive-view system-dtable-font" aria-hidden="true"></span></td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{storage}</td>
          <td>{item.rows}</td>
          <td>
            {this.state.isOpIconShown &&
              <DTableArchiveOpMenu
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isArchiveBackupsDialogOpen &&
          <ModalPortal>
            <ArchiveDTableBackupsDialog
              currentTable={item}
              toggle={this.toggleArchiveDTableBackupsDialog}
            />
          </ModalPortal>
        }
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
  count: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  listDTableArchivesByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};

class Content extends Component { // todo: check all-dtables page delete function
  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      expireDays: 30,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listDTableArchivesByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listDTableArchivesByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, currentPage, count, curPerPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      if (!items || items.length === 0) {
        return (
          <DTableEmptyTip text={gettext('No Archived bases')} src={`${mediaUrl}img/no-items-tip.png`} />
        );
      }
      return (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="18%">{gettext('Name')}</th>
                <th width="32%">ID</th>
                <th width="25%">{gettext('Storage used')}</th>
                <th width="15%">{gettext('Rows in big data storage')}</th>
                <th width="5%">{/* Operations*/}</th>
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
            currentPage={currentPage}
            hasNextPage={Utils.hasNextPage(currentPage, curPerPage, count)}
            canResetPerPage={true}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
          />
        </Fragment>
      );
    }
  }

}

Content.propTypes = contentPropTypes;

const archivedDTablesPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class DTableArchives extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      dtables: [],
      perPage: 100,
      currentPage: 1,
      count: 0,
      deletedBaseUuids: [],
      isShowDeleteArchivesDialog: false,
      deleteLoading: false,
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listDTableArchivesByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listDTableArchivesByPage(1);
    });
  };

  listDTableArchivesByPage = (page) => {
    sysAdminServiceApi.sysAdminListDTableArchives(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        dtables: res.data.bases,
        count: res.data.count,
        currentPage: page,
        deletedBaseUuids: res.data.base_deleted,
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

  toggleDeleteArchivesDialog = () => {
    this.setState({ isShowDeleteArchivesDialog: !this.state.isShowDeleteArchivesDialog });
  };

  onDeleteInvalidArchives = () => {
    const { deletedBaseUuids } = this.state;
    this.setState({ deleteLoading: true });
    sysAdminServiceApi.sysAdminDeleteDTableArchives(deletedBaseUuids).then((res) => {
      let count = res.data.success_count;
      let dtables = this.state.dtables.filter(table => {
        return deletedBaseUuids.indexOf(table.uuid) === -1;
      });
      this.setState({ dtables: dtables, deleteLoading: false });
      const msg = gettext('Successfully deleted {count} invalid database storage.').replace('{count}', count);
      toaster.success(msg);
      this.toggleDeleteArchivesDialog();
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };


  render() {
    let { deletedBaseUuids } = this.state;
    const hasInvalidBases = deletedBaseUuids.length > 0;

    return (
      <Fragment>
        <MainPanelTopBar onCloseSidePanel={this.props.onCloseSidePanel} >
          {hasInvalidBases ?
            <Button className="btn btn-secondary operation-item" onClick={this.toggleDeleteArchivesDialog}>
              {gettext('Clean database storage of deleted bases')}
            </Button>
            :
            null
          }
        </MainPanelTopBar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <DTableNav currentItem='database-storage' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errMessage={this.state.errorMsg}
                items={this.state.dtables}
                count={this.state.count}
                currentPage={this.state.currentPage}
                listDTableArchivesByPage={this.listDTableArchivesByPage}
                curPerPage={this.state.perPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
        {this.state.isShowDeleteArchivesDialog &&
          <DeleteInvalidArchivesDialog
            deleteCancel={this.toggleDeleteArchivesDialog}
            onDeleteInvalidArchives={this.onDeleteInvalidArchives}
            deleteLoading={this.state.deleteLoading}
          />
        }
      </Fragment>
    );
  }

}

DTableArchives.propTypes = archivedDTablesPropTypes;

export default DTableArchives;
