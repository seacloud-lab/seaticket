import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import dayjs from 'dayjs';
import { toaster } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { orgID, gettext } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import ModalPortal from '../../components/modal-portal';
import DeleteTableDialog from '../dtable/dialog/delete-table-dialog';
import Paginator from '../../components/paginator';
import OrgAdminShareTableDialog from '../../components/dialog/orgadmin-dialog/orgadmin-share-table-dialog';

const ItemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteDTable: PropTypes.func.isRequired,
  exportDtable: PropTypes.func.isRequired,
};

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isItemMenuShow: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isShareDialogOpen: false
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

  onDeleteDTable = () => {
    const item = this.props.item;
    let dtableName = item.name;

    orgAdminServiceApi.orgAdminDeleteDTable(orgID, item.id).then(() => {
      this.props.deleteDTable(item);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleDeleteDialog();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleShareDialog = () => {
    this.setState({ isShareDialogOpen: !this.state.isShareDialogOpen });
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
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
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
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                  <DropdownItem onClick={this.onExportDtable}>{gettext('Export')}</DropdownItem>
                  <DropdownItem onClick={this.toggleShareDialog}>{gettext('Share')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <DeleteTableDialog
              currentTable={item}
              onDeleteDTable={this.onDeleteDTable}
              deleteCancel={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
        {this.state.isShareDialogOpen &&
          <ModalPortal>
            <OrgAdminShareTableDialog
              currentTable={item}
              shareCancel={this.toggleShareDialog}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

Item.propTypes = ItemPropTypes;

const OrgNormalDtablesPropTypes = {
  exportDtable: PropTypes.func.isRequired,
};

class OrgNormalDTables extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isItemFreezed: false,
      dtableList: [],
      page: 1,
      per_page: 25,
    });
  }

  componentDidMount() {
    this.loadDTables(this.state.page);
  }

  loadDTables(page) {
    orgAdminServiceApi.orgAdminListDTables(orgID, page, this.state.per_page).then((res) => {
      this.setState({
        dtableList: res.data.dtable_list,
        count: res.data.count
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  deleteDTable = (item) => {
    let dtableList = this.state.dtableList.slice();
    dtableList = dtableList.filter((dtable) => {return dtable.id !== item.id;});
    this.setState({ dtableList: dtableList });
  };

  exportDtable = (dtable_uuid) => {
    this.props.exportDtable(dtable_uuid);
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

  render() {
    let { dtableList, page, per_page, count } = this.state;
    return (
      <div className='cur-view-content'>
        <table>
          <thead>
            <tr>
              <th width="5%">{/* icon*/}</th>
              <th width="15%">{gettext('Name')}</th>
              <th width="30%">ID</th>
              <th width="10%">{gettext('Rows')}</th>
              <th width="20%">{gettext('Owner')}</th>
              <th width="15%">{gettext('Created at')}</th>
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
                  deleteDTable={this.deleteDTable}
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
      </div>
    );
  }
}

OrgNormalDTables.propTypes = OrgNormalDtablesPropTypes;

export default OrgNormalDTables;
