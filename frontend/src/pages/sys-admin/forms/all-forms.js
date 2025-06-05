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
import OpMenu from './op-menu';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import FormTableNav from './form-table-nav';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteForm: PropTypes.func.isRequired
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
    window.open(siteRoot + 'dtable/forms/' + this.props.item.token + '/');
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

  deleteForm = () => {
    this.props.deleteForm(this.props.item.token);
  };

  render() {
    const item = this.props.item;
    let deleteDialogMsg = gettext('Are you sure you want to delete form {form_name}?').replace('{form_name}', item.form_name);

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-table-icon"><span className="dtable-font dtable-icon-form system-dtable-font" aria-hidden="true"></span></td>
          <td>
            {item.form_name}
          </td>
          <td>{item.username}</td>
          <td>{item.dtable_name}</td>
          <td>{item.submit_count}</td>
          <td>{item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '--'}</td>
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
            title={gettext('Delete form')}
            message={deleteDialogMsg}
            executeOperation={this.deleteForm}
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
  ListFormsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  deleteForm: PropTypes.func.isRequired
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
    this.props.ListFormsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.ListFormsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No forms')} />
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
                <th width="18%">{gettext('Submit count')}</th>
                <th width="18%">{gettext('Created at')}</th>
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
                  deleteForm={this.props.deleteForm}
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

class AllForms extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      forms: [],
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
      this.ListFormsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.ListFormsByPage(1);
    });
  };

  ListFormsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListForms(page, perPage).then((res) => {
      this.setState({
        loading: false,
        forms: res.data.form_list,
        currentPage: page,
        pageInfo: {
          current_page: page,
          has_next_page: res.data.form_list.length >= perPage,
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

  deleteForm = (token) => {
    sysAdminServiceApi.sysAdminDeleteForm(token).then(res => {
      let newForms = this.state.forms.filter(item => {
        return item.token !== token;
      });
      this.setState({
        forms: newForms
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
            <FormTableNav currentItem='forms' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.forms}
                curPerPage={this.state.perPage}
                pageInfo={this.state.pageInfo}
                ListFormsByPage={this.ListFormsByPage}
                resetPerPage={this.resetPerPage}
                deleteForm={this.deleteForm}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AllForms.propTypes = propTypes;

export default AllForms;
