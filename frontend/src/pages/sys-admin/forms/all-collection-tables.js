import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import Paginator from '../../../components/paginator';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import FormTableNav from './form-table-nav';
import OpMenu from './op-menu';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteCollectionTables: PropTypes.func.isRequired
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

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  openFormPage = (e) => {
    window.open(siteRoot + 'dtable/collection-tables/' + this.props.item.token + '/');
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Visit':
        this.openFormPage();
        break;
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      default:
        break;
    }
  };

  deleteCollectionTables = () => {
    this.props.deleteCollectionTables(this.props.item.token);
  };

  render() {
    const item = this.props.item;
    let deleteDialogMsg = gettext('Are you sure you want to delete collection table {table_name}?').replace('{table_name}', item.table_name);

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-table-icon"><span className="dtable-font dtable-icon-form system-dtable-font" aria-hidden="true"></span></td>
          <td>
            {item.table_name}
          </td>
          <td>{item.username}</td>
          <td>{item.dtable_name}</td>
          <td>{item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '--'}</td>
          <td>{item.view_count}</td>
          <td>
            {this.state.isOpIconShown &&
              <OpMenu
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete collection table')}
            message={deleteDialogMsg}
            executeOperation={this.deleteCollectionTables}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
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
  pageInfo: PropTypes.object.isRequired,
  ListCollectionTablesByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  deleteCollectionTables: PropTypes.func.isRequired
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
    this.props.ListCollectionTablesByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.ListCollectionTablesByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No collection tables')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="18%">{gettext('Name')}</th>
                <th width="18%">{gettext('Creator')}</th>
                <th width="18%">{gettext('Bases')}</th>
                <th width="26%">{gettext('Created at')}</th>
                <th width="10%">{gettext('Count')}</th>
                <th width="5%">{/* op*/}</th>
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
                  deleteCollectionTables={this.props.deleteCollectionTables}
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

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class AllCollectionTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      collection_tables: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1,
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.ListCollectionTablesByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.ListCollectionTablesByPage(1);
    });
  };

  ListCollectionTablesByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListCollectionTables(page, perPage).then((res) => {
      this.setState({
        loading: false,
        collection_tables: res.data.collection_table_list,
        currentPage: page,
        pageInfo: {
          current_page: page,
          has_next_page: res.data.collection_table_list.length >= perPage,
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

  deleteCollectionTables = (token) => {
    sysAdminServiceApi.sysAdminDeleteCollectionTable(token).then(res => {
      let newCollectionTables = this.state.collection_tables.filter(item => {
        return item.token !== token;
      });
      this.setState({
        collection_tables: newCollectionTables
      });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <FormTableNav currentItem='collection-tables' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.collection_tables}
                curPerPage={this.state.perPage}
                pageInfo={this.state.pageInfo}
                ListCollectionTablesByPage={this.ListCollectionTablesByPage}
                resetPerPage={this.resetPerPage}
                deleteCollectionTables={this.deleteCollectionTables}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AllCollectionTables.propTypes = propTypes;

export default AllCollectionTables;
