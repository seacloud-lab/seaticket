import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl, siteRoot } from '../../../utils/constants';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import ExterLinkOpMenu from './op-menu';
import ExternalLinkNav from './external-links-nav';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import Search from '../search';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  pageInfo: PropTypes.object,
  deleteExternalLink: PropTypes.func.isRequired,
  getListByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  hasNextPage: PropTypes.bool,
  page: PropTypes.number,
  perPage: PropTypes.number
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

  getPreviousPage = () => {
    this.props.getListByPage(this.props.page - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.page + 1);
  };

  render() {
    const { loading, errorMsg, items, hasNextPage, page, resetPerPage, perPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No external links')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="20%">{gettext('Base')}</th>
                <th width="15%">{gettext('Creator')}</th>
                <th width="10%">{gettext('Password-protected')}</th>
                <th width="10%">{gettext('Expiration date')}</th>
                <th width="15%">{gettext('Table')}</th>
                <th width="10%">{'View'}</th>
                <th width="15%">{gettext('Created at')}</th>
                <th width='5%'>{gettext('Count')}</th>
                <th width="5%">{/* operation */}</th>
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
                  deleteExternalLink={this.props.deleteExternalLink}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
            currentPage={page}
            hasNextPage={hasNextPage}
            resetPerPage={resetPerPage}
            curPerPage={perPage}
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
  deleteExternalLink: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShow: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isTransferDialogOpen: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShow: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShow: false,
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

  onCopyExternalLink = () => {
    const { item } = this.props;
    copy(item.url);
    toaster.success(gettext('External link is copied to the clipboard.'));
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Visit':
        this.openExternalPage();
        break;
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'Copy to clipboard':
        this.onCopyExternalLink();
        break;
      default:
        break;
    }
  };

  openExternalPage = (e) => {
    window.open(this.props.item.url);
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  deleteExternalLink = () => {
    this.props.deleteExternalLink(this.props.item.token);
  };

  render() {
    const { isDeleteDialogOpen } = this.state;
    const { item } = this.props;
    let deleteDialogMsg = gettext('Are you sure you want to delete external link?');

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>{item.from_dtable}</td>
          <td><Link to={`${siteRoot}sys/users/${encodeURIComponent(item.creator)}/`}>{item.creator_name}</Link></td>
          <td>{item.is_encrypted ? '√' : '×'}</td>
          <td>{item.expire_date ? dayjs(item.expire_date).format('YYYY-MM-DD') : '--'}</td>
          <td>{item.table_name ? item.table_name : '--'}</td>
          <td>{item.view_name ? item.view_name : '--'}</td>
          <td>
            {item.create_at ? dayjs(item.create_at).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </td>
          <td>{item.view_cnt}</td>
          <td>
            {this.state.isOpIconShow &&
              <ExterLinkOpMenu
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete external link')}
            message={deleteDialogMsg}
            executeOperation={this.deleteExternalLink}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const ExternalLinksPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class ViewExternalLinks extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      externalLinkList: [],
      perPage: 25,
      page: 1,
      hasNextPage: false,
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { page, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      page: parseInt(urlParams.get('page') || page)
    }, () => {
      this.getExternalLinkListByPage(this.state.page);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getExternalLinkListByPage(this.state.page);
    });
  };

  getExternalLinkListByPage = (page) => {
    sysAdminServiceApi.sysAdminListViewExternalLinks(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        externalLinkList: res.data.external_link_list,
        hasNextPage: res.data.has_next_page,
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

  getListByPage = (page) => {
    this.setState({ page: page });
    this.getExternalLinkListByPage(page);
  };

  deleteExternalLink = (token) => {
    sysAdminServiceApi.sysAdminDeleteViewExternalLink(token).then(res => {
      let newLinkList = this.state.externalLinkList.filter(item => {
        return item.token !== token;
      });
      this.setState({
        externalLinkList: newLinkList
      });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search links by token')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-view-external-links/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <ExternalLinkNav currentItem="view-external-links" />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.externalLinkList}
                hasNextPage={this.state.hasNextPage}
                perPage={this.state.perPage}
                page={this.state.page}
                getListByPage={this.getListByPage}
                resetPerPage={this.resetPerPage}
                deleteExternalLink={this.deleteExternalLink}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

ViewExternalLinks.propTypes = ExternalLinksPropTypes;

export default ViewExternalLinks;
