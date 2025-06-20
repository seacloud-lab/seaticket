import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot, trashCleanExpireDays, mediaUrl } from '../../../constants';
import MainPanelTopBar from '../main-panel-topbar';
import DTableNav from './dtables-nav';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import { Utils } from '../../../utils/utils';
import ModalPortal from '../../../components/modal-portal';
import RestoreTableDialog from '../../dtable/dialog/restore-table-dialog';
import DTableTrashOpMenu from './dtable-trash-op-menu';

import '../../../css/system-dtable.css';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  restoreDTable: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isRestoreDialogOpen: false
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
      case 'Restore':
        this.toggleRestoreDialog();
        break;
      default:
        break;
    }
  };

  toggleRestoreDialog = () => {
    this.setState({ isRestoreDialogOpen: !this.state.isRestoreDialogOpen });
  };

  onRestoreDTable = () => {
    const item = this.props.item;
    const dtableName = item.name;
    const owner_deleted = item.owner_deleted;

    sysAdminServiceApi.sysAdminRestoreTrashDTable(item.id, owner_deleted).then(() => {
      this.props.restoreDTable(item);
      const msg = gettext('Successfully restored {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleRestoreDialog();
  };

  render() {
    const item = this.props.item;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-table-icon"><span className="dtable-font dtable-icon-table system-dtable-font" aria-hidden="true"></span></td>
          <td>
            {item.name}
            <Fragment>
              {item.org_id !== -1 &&
                <Fragment>
                  <br />
                  <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>({item.org_name})</Link>
                </Fragment>
              }
            </Fragment>
          </td>
          <td>{item.uuid}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {this.state.isOpIconShown &&
              <DTableTrashOpMenu
                restoreDTable={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isRestoreDialogOpen &&
          <ModalPortal>
            <RestoreTableDialog
              currentTable={item}
              handleSubmit={this.onRestoreDTable}
              restoreCancel={this.toggleRestoreDialog}
              owner_deleted={item.owner_deleted}
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
  listTrashDTablesByPage: PropTypes.func.isRequired,
  restoreDTable: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};

class Content extends Component { // todo: check all-dtables page delete function
  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      expireDays: trashCleanExpireDays,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listTrashDTablesByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listTrashDTablesByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, currentPage, count, curPerPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No trash bases')} />
      );
      const table = (
        <Fragment>
          <p className="mt-4 seatable-tip-default">{gettext('Tip: tables deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', this.state.expireDays)}</p>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="18%">{gettext('Name')}</th>
                <th width="32%">ID</th>
                <th width="25%">{gettext('Owner')}</th>
                <th width="15%">{gettext('Deleted at')}</th>
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
                  restoreDTable={this.props.restoreDTable}
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

      return items.length ? table : emptyTip;
    }
  }

}

Content.propTypes = contentPropTypes;

const trashDTablesPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class TrashDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      dtables: [],
      perPage: 25,
      currentPage: 1,
      count: 0
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listTrashDTablesByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listTrashDTablesByPage(1);
    });
  };

  listTrashDTablesByPage = (page) => {
    sysAdminServiceApi.sysAdminListTrashDTables(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        dtables: res.data.trash_dtable_list,
        count: res.data.count,
        currentPage: page
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

  restoreDTable = (dtable) => {
    let dtables = this.state.dtables.filter(table => {
      return table.uuid !== dtable.uuid;
    });
    this.setState({ dtables: dtables });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <DTableNav currentItem='trash-dtables' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errMessage={this.state.errorMsg}
                items={this.state.dtables}
                count={this.state.count}
                currentPage={this.state.currentPage}
                listTrashDTablesByPage={this.listTrashDTablesByPage}
                restoreDTable={this.restoreDTable}
                curPerPage={this.state.perPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

}

TrashDTables.propTypes = trashDTablesPropTypes;

export default TrashDTables;
