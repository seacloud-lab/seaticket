import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Col, Form, FormGroup, Input, UncontrolledTooltip } from 'reactstrap';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl, siteRoot, multiTenancy, mediaUrl } from '../../../constants';
import { seaQAAPI } from '../../../api/web-api';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import MainPanelTopbar from '../main-panel-topbar';
import DTableOpMenu from './dtable-op-menu';
import Loading from '../../../components/loading';
import ModalPortal from '../../../components/modal-portal';
import DeleteTableDialog from '../../dtable/dialog/delete-table-dialog';
import DTableAllExternalLinksDialog from '../../dtable/dialog/dtable-all-external-links-dialog';
import Paginator from '../../../components/paginator';
import UnsetPasswordConfirmDialog from '../../dtable/dialog/unset-password-confirm-dialog';
import DTableAllAPITokensDialog from '../../dtable/dialog/dtable-all-api-tokens-dialog';
import SysAdminShareTableDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-share-table-dialog';


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
      isUnsetPasswordConfirmDialogOpen: false,
      isShowAPITokenDialog: false,
      isShowShareDTableDialog: false,
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
      case 'Unset password':
        this.toggleUnsetPasswordConfirmDialog();
        break;
      case 'API tokens':
        this.toggleAPITokenDialog();
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

  onDeleteDTable = () => {
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

  onUnsetDTablePassword = () => {
    const item = this.props.item;
    this.props.unsetDTablePassword(item);
    this.toggleUnsetPasswordConfirmDialog();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleExternalLinkDialog = () => {
    this.setState({ isExternalLinkDialogOpen: !this.state.isExternalLinkDialogOpen });
  };

  toggleAPITokenDialog = () => {
    this.setState({ isShowAPITokenDialog: !this.state.isShowAPITokenDialog });
  };

  onShareDTableToggle = () => {
    this.setState({ isShowShareDTableDialog: !this.state.isShowShareDTableDialog });
  };

  linkedTo = (item) => {
    if (item.group_id === -1) {
      return `${siteRoot}sys/users/${encodeURIComponent(item.email)}/`;
    }
    return `${siteRoot}sys/groups/${encodeURIComponent(item.group_id)}/dtables/`;
  };

  toggleUnsetPasswordConfirmDialog = () => {
    this.setState({ isUnsetPasswordConfirmDialogOpen: !this.state.isUnsetPasswordConfirmDialogOpen });
  };

  render() {
    const item = this.props.item;
    let operations = ['External links', 'API tokens', 'Delete', 'Export', 'Copy', 'Repair'];
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
          <td>{item.rows_count}</td>
          <td>
            <Link to={this.linkedTo(item)}>{item.owner}</Link>
          </td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>{file_size}</td>
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
            <DeleteTableDialog
              currentTable={item}
              onDeleteDTable={this.onDeleteDTable}
              deleteCancel={this.toggleDeleteDialog}
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
        {this.state.isUnsetPasswordConfirmDialogOpen &&
          <ModalPortal>
            <UnsetPasswordConfirmDialog
              currentTable={item}
              onUnsetDTablePassword={this.onUnsetDTablePassword}
              unsetPasswordCancel={this.toggleUnsetPasswordConfirmDialog}
            />
          </ModalPortal>
        }

        {this.state.isShowAPITokenDialog && (
          <ModalPortal>
            <DTableAllAPITokensDialog
              currentTable={item}
              toggle={this.toggleAPITokenDialog}
            />
          </ModalPortal>
        )}
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
  loading: PropTypes.bool,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  deleteDTable: PropTypes.func,
  curPerPage: PropTypes.number,
  count: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  listDTablesByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  unsetDTablePassword: PropTypes.func,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      isOpIconShown: false,
      isDeleteDialogOpen: false,
      isExternalLinkDialogOpen: false,
    };
  }


  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listDTablesByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listDTablesByPage(this.props.currentPage + 1);
  };


  render() {
    const { loading, errorMsg, items, currentPage, count, curPerPage } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      if (!items.length) {
        return (
          <DTableEmptyTip text={gettext('No bases')} src={`${mediaUrl}img/no-items-tip.png`} />
        );
      } else {
        return (
          <Fragment>
            <table>
              <thead>
                <tr>
                  <th width="5%">{/* icon*/}</th>
                  <th width="15%">{gettext('Name')}</th>
                  <th width="30%">ID</th>
                  <th width="10%">{gettext('Rows')}</th>
                  <th width="10%">{gettext('Owner')}</th>
                  <th width="15%">{gettext('Created At')}</th>
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
                    deleteDTable={this.props.deleteDTable}
                    unsetDTablePassword={this.props.unsetDTablePassword}
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
}

Content.propTypes = contentPropTypes;

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class SearchDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      isSubmitBtnActive: false,
      loading: true,
      errorMsg: '',
      dtables: [],
      perPage: 25,
      currentPage: 1,
      count: 0
    };
  }

  componentDidMount() {
    let params = (new URL(document.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      query: params.get('query') || '',
      perPage: parseInt(params.get('per_page') || perPage),
      currentPage: parseInt(params.get('page') || currentPage)
    }, () => {
      this.getItems(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getItems(1);
    });
  };

  getSearchResult = (e) => {
    e.preventDefault();
    this.getItems(1);
  };

  getItems = (page) => {
    sysAdminServiceApi.sysAdminSearchDTables(this.state.query.trim(), page, this.state.perPage).then(res => {
      this.setState({
        dtables: res.data.dtables,
        loading: false,
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

  handleInputChange = (e) => {
    this.setState({
      query: e.target.value
    }, this.checkSubmitBtnActive);
  };

  checkSubmitBtnActive = () => {
    const { query } = this.state;
    this.setState({
      isSubmitBtnActive: query.trim()
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

  render() {
    const { query, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Base')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search bases')}</h4>
                <Form>
                  <FormGroup row>
                    <Col sm={5}>
                      <Input type="text" name="query" value={query} placeholder={gettext('Search bases')}
                        onChange={this.handleInputChange}/>
                    </Col>
                  </FormGroup>
                  <FormGroup row>
                    <Col sm={{ size: 5 }}>
                      <button className="btn btn-outline-primary" disabled={!isSubmitBtnActive}
                        onClick={this.getSearchResult}>{gettext('Submit')}
                      </button>
                    </Col>
                  </FormGroup>
                </Form>
              </div>
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
                <Content
                  loading={this.state.loading}
                  errorMsg={this.state.errorMsg}
                  items={this.state.dtables}
                  count={this.state.count}
                  currentPage={this.state.currentPage}
                  deleteDTable={this.deleteDTable}
                  curPerPage={this.state.perPage}
                  resetPerPage={this.resetPerPage}
                  listDTablesByPage={this.getItems}
                  unsetDTablePassword={this.unsetDTablePassword}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

SearchDTables.propTypes = propTypes;

export default SearchDTables;
