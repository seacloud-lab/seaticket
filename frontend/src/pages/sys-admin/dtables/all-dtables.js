import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { UncontrolledTooltip } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import Search from '../search';
import { seaQAAPI } from '../../../api/web-api';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot, multiTenancy, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import ModalPortal from '../../../components/modal-portal';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import DTableOpMenu from './dtable-op-menu';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import DTableNav from './dtables-nav';
import DTableAllExternalLinksDialog from '../../../home/dialog/all-external-links-dialog';
import SysAdminShareTableDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-share-table-dialog';

import '../../../css/system-dtable.css';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteDTable: PropTypes.func.isRequired,
  unsetDTablePassword: PropTypes.func,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isExternalLinkDialogOpen: false,
      isShowDTableIODialog: false,
      isShowCopyDTable: false,
      isShowShareDTableDialog: false,
      taskId: '',
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
      case 'External links':
        this.toggleExternalLinkDialog();
        break;
      case 'Export':
        this.exportDTable();
        break;
      case 'Copy':
        this.onCopyDTableToggle();
        break;
      case 'Share':
        this.onShareDTableToggle();
        break;
      case 'Repair':
        this.onRepairDTableToggle();
        break;
      default:
        break;
    }
  };

  cancelDTableIOTask = () => {
    clearInterval(this.timer);
    let dtable_uuid = this.props.item.uuid;
    seaQAAPI.cancelDTableIOTask(this.state.taskId, dtable_uuid, 'export').then(res => {
      this.setState({
        isShowDTableIODialog: false,
        taskId: '',
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  exportDTable = () => {
    let { item } = this.props;
    const dtableUuid = item.uuid;
    let task_id = '';
    sysAdminServiceApi.sysAdminExportDtable(dtableUuid).then(res => {
      task_id = res.data.task_id;
      this.setState({
        isShowDTableIODialog: true,
        taskId: task_id
      });
      return seaQAAPI.queryDTableIOStatusByTaskId(task_id);
    }).then(res => {
      if (res.data.is_finished === true) {
        this.setState({ isShowDTableIODialog: false });
        location.href = siteRoot + 'sys/dtableadmin/export-dtable/?task_id=' + task_id + '&dtable_uuid=' + dtableUuid;
      } else {
        this.timer = setInterval(() => {
          seaQAAPI.queryDTableIOStatusByTaskId(task_id).then(res => {
            if (res.data.is_finished === true) {
              this.setState({ isFinished: true });
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              location.href = siteRoot + 'sys/dtableadmin/export-dtable/?task_id=' + task_id + '&dtable_uuid=' + dtableUuid;
            }
          }).catch(error => {
            if (this.state.isFinished === false) {
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              toaster.danger(gettext('Failed to export. Please check whether the size of table attachments exceeds the limit.'));
            }
          });
        }, 1000);
      }
      this.setState({ isFinished: false });
    }).catch(error => {
      this.setState({ isShowDTableIODialog: false });
      if (error.response && error.response.status === 500) {
        const error_msg = error.response.data ? error.response.data['error_msg'] : null;
        if (error_msg && error_msg !== 'Internal Server Error') {
          toaster.danger(error_msg);
        } else {
          toaster.danger(gettext('Internal Server Error.'));
        }
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  onDeleteProject = () => {
    const item = this.props.item;
    const dtableName = item.name;
    const dtable_uuid = item.uuid;

    sysAdminServiceApi.sysAdminDeleteDTable(dtable_uuid).then(() => {
      this.props.deleteDTable(item);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleDeleteDialog();
  };

  onRepairDTableToggle = () => {
    const item = this.props.item;
    const dtableName = item.name;
    const dtable_uuid = item.uuid;

    sysAdminServiceApi.sysAdminRepairDtable(dtable_uuid).then(() => {
      const msg = gettext('Successfully repair {name}.').replace('{name}', dtableName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

  };

  onDTableIODialogToggle = () => {
    this.setState({ isShowDTableIODialog: !this.state.isShowDTableIODialog });
  };

  onCopyDTableToggle = () => {
    this.setState({
      isShowCopyDTable: !this.state.isShowCopyDTable
    });
    this.onUnfreezedItem();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleExternalLinkDialog = () => {
    this.setState({ isExternalLinkDialogOpen: !this.state.isExternalLinkDialogOpen });
  };

  onShareDTableToggle = () => {
    this.setState({ isShowShareDTableDialog: !this.state.isShowShareDTableDialog });
  };

  render() {
    const item = this.props.item;
    let operations = ['External links', 'Delete', 'Export', 'Copy', 'Repair'];
    if (!multiTenancy){
      operations = operations.concat('Share');
    }
    if (item.is_encrypted) {
      operations = operations.concat(['Unset password']);
    }

    const file_size = item.file_size ? Utils.bytesToSize(item.file_size) : '--';
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-table-icon">
            <i
              className={`dtable-font dtable-icon-table${item.is_encrypted ? '-encryption' : ''} system-dtable-font`}
              aria-hidden="true"
            >
            </i>
          </td>
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
          <td><span className="ml-2">{item.rows_count}</span></td>
          <td>{item.owner}</td>
          <td><span className="pl-2 d-block">{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</span></td>
          <td><span className="pl-2 d-block">{dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss')}</span></td>
          <td><span className="pl-4">{file_size}</span></td>
          <td>
            {this.state.isOpIconShown &&
              <DTableOpMenu
                operations={operations}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <CommonOperationConfirmationDialog
              title={gettext('Delete base')}
              message={gettext('Are you sure you want to delete the base {placeholder} ?').replace('{placeholder}', `<b>${item.name}</b>`)}
              executeOperation={this.onDeleteProject}
              confirmBtnText={gettext('Delete')}
              toggleDialog={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
        {this.state.isExternalLinkDialogOpen &&
          <ModalPortal>
            <DTableAllExternalLinksDialog
              currentTable={item}
              toggle={this.toggleExternalLinkDialog}
            />
          </ModalPortal>
        }
        {this.state.isShowShareDTableDialog && (
          <SysAdminShareTableDialog
            currentTable={item}
            shareCancel={this.onShareDTableToggle}
          />
        )}
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
  deleteDTable: PropTypes.func.isRequired,
  unsetDTablePassword: PropTypes.func,
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
                <th width="4%">{/* icon*/}</th>
                <th width="15%">{gettext('Name')}</th>
                <th width="17%">ID</th>
                <th width="7%"><span className="ml-2">{gettext('Rows')}</span></th>
                <th width="10%">{gettext('Owner')}</th>
                <th width="15%"><span className="pl-2">{gettext('Created at')}</span></th>
                <th width="15%"><span className="pl-2">{gettext('Updated at')}</span></th>
                <th width="9%">
                  <div className="pl-4">
                    {gettext('Size')}
                    <span className="dtable-font dtable-icon-use-help ml-1" id='dtable-icon-use-help-tip'>
                      <UncontrolledTooltip
                        placement="bottom"
                        target='dtable-icon-use-help-tip'
                      >
                        {gettext('The size of the assets of the base is not included')}
                      </UncontrolledTooltip>
                    </span>
                  </div>
                </th>
                <th width="8%">{/* Operations*/}</th>
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
                  deleteDTable={this.props.deleteDTable}
                  unsetDTablePassword={this.props.unsetDTablePassword}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
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

const allDTablesPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class AllDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      dtables: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listDTablesByPage(this.state.currentPage);
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
    sysAdminServiceApi.sysAdminListAllDTables(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        dtables: res.data.dtables,
        pageInfo: res.data.page_info,
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

  deleteDTable = (dtable) => {
    let dtables = this.state.dtables.filter(table => {
      return table.uuid !== dtable.uuid;
    });
    this.setState({ dtables: dtables });
  };

  unsetDTablePassword = (dtable) => {
    sysAdminServiceApi.sysAdminUnsetDTablePassword(dtable.uuid).then((res) => {
      const updateTable = res.data.dtable;
      let dtables = this.state.dtables.map((table) => {
        if (table.uuid === dtable.uuid) {
          table = Object.assign({}, table, updateTable);
        }
        return table;
      });
      this.setState({ dtables: dtables });
      const msg = gettext('Successfully unset password of base {name}.').replace('{name}', dtable.name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search bases')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-dtables/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    const { loading, errorMsg, dtables, pageInfo, perPage } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}></MainPanelTopbar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <DTableNav currentItem='all-dtables' />
            <div className="cur-view-content">
              <Content
                loading={loading}
                errorMsg={errorMsg}
                items={dtables}
                pageInfo={pageInfo}
                curPerPage={perPage}
                listDTablesByPage={this.listDTablesByPage}
                deleteDTable={this.deleteDTable}
                unsetDTablePassword={this.unsetDTablePassword}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AllDTables.propTypes = allDTablesPropTypes;

export default AllDTables;
