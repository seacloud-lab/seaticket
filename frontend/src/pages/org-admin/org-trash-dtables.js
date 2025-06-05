import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { orgID, gettext, trashCleanExpireDays, mediaUrl } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import ModalPortal from '../../components/modal-portal';
import RestoreTableDialog from '../dtable/dialog/restore-table-dialog';
import Paginator from '../../components/paginator';
import EmptyDTableTrashDialog from '../dtable/dialog/empty-dtable-trash-dialog';

const ItemPropTypes = {
  item: PropTypes.object.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  restoreDTable: PropTypes.func.isRequired,
  exportDtable: PropTypes.func.isRequired,
};


class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isItemMenuShow: false,
      highlight: false,
      isRestoreDialogOpen: false,
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
        this.toggleRestoreDialog();
        break;
      default:
        break;
    }
  };

  onRestoreDTable = () => {
    const item = this.props.item;
    let dtableName = item.name;
    let owner_deleted = item.owner_deleted;

    orgAdminServiceApi.orgAdminRestoreTrashDTable(orgID, item.id, owner_deleted).then(() => {
      this.props.restoreDTable(item);
      const msg = gettext('Successfully restore {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleRestoreDialog();
  };

  toggleRestoreDialog = () => {
    this.setState({ isRestoreDialogOpen: !this.state.isRestoreDialogOpen });
  };

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true, highlight: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false, highlight: false });
    }
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.props.onUnfreezedItem();
      }
    });
  };

  onExportDtable = () => {
    const item = this.props.item;
    this.props.exportDtable(item.uuid);
  };

  render() {
    const item = this.props.item;
    let { isOpIconShown } = this.state;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td className="org-table-icon">
            <span className="dtable-font dtable-icon-table system-dtable-font" aria-hidden="true"></span>
          </td>
          <td>
            {item.name}
          </td>
          <td>{item.uuid}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown && (
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                />
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleRestoreDialog}>{gettext('Restore')}</DropdownItem>
                  <DropdownItem onClick={this.onExportDtable}>{gettext('Export')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
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

Item.propTypes = ItemPropTypes;

const OrgTrashDTablesPropTypes = {
  exportDtable: PropTypes.func.isRequired,
  onTrashEmptyConfirmDialogToggle: PropTypes.func.isRequired,
  isShowTrashEmptyConfirmDialog: PropTypes.bool.isRequired,
};

class OrgTrashDTables extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isItemFreezed: false,
      dtableList: [],
      page: 1,
      per_page: 25,
      expireDays: trashCleanExpireDays,
    });
  }

  componentDidMount() {
    this.loadDTables(1);
  }

  loadDTables = (page) => {
    orgAdminServiceApi.orgAdminListTrashDTables(orgID, page, this.state.per_page).then((res) => {
      this.setState({
        dtableList: res.data.dtable_list,
        count: res.data.count
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  restoreDTable = (item) => {
    let dtableList = this.state.dtableList.slice();
    dtableList = dtableList.filter((dtable) => {return dtable.id !== item.id;});
    this.setState({ dtableList: dtableList });
  };

  getPreviousPageList = () => {
    this.setState({
      page: this.state.page - 1
    }, () => {
      this.loadDTables(this.state.page);
    });
  };

  getNextPageList = () => {
    this.setState({
      page: this.state.page + 1
    }, () => {
      this.loadDTables(this.state.page);
    });
  };

  resetPerPage = (per_page) => {
    this.setState({
      per_page: per_page
    }, () => {
      this.loadDTables(1);
    });
  };

  exportDtable = (dtable_uuid) => {
    this.props.exportDtable(dtable_uuid);
  };

  handleEmptyTrashTables = () => {
    const { orgID } = window.org.pageOptions;
    orgAdminServiceApi.orgAdminCleanTrashDTables(orgID).then((res) => {
      this.setState({
        dtableList: [],
        page: 1
      });
      const msg = gettext('Trash cleaned');
      toaster.success(msg);
      this.props.onTrashEmptyConfirmDialogToggle();
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    let { dtableList, page, per_page, count, expireDays } = this.state;
    if (!dtableList.length) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No deleted bases')} />
      );
    }
    return (
      <div className='cur-view-content'>
        <p className="mt-4 text-secondary">
          {gettext('Tip: tables deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', expireDays)}
        </p>
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
            {dtableList.map((item, index) => {
              return (
                <Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  restoreDTable={this.restoreDTable}
                  exportDtable={this.exportDtable}
                />
              );
            })}
          </tbody>
        </table>
        <Paginator
          gotoPreviousPage={this.getPreviousPageList}
          gotoNextPage={this.getNextPageList}
          currentPage={page}
          hasNextPage={Utils.hasNextPage(page, per_page, count)}
          canResetPerPage={true}
          curPerPage={per_page}
          resetPerPage={this.resetPerPage}
        />
        {this.props.isShowTrashEmptyConfirmDialog && (
          <EmptyDTableTrashDialog
            emptyTrashCancel={this.props.onTrashEmptyConfirmDialogToggle}
            emptyTrashConfirm={this.handleEmptyTrashTables}
          />
        )}
      </div>
    );
  }
}

OrgTrashDTables.propTypes = OrgTrashDTablesPropTypes;

export default OrgTrashDTables;
