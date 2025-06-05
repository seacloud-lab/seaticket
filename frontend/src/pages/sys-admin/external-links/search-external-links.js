import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Col, Form, FormGroup, Input } from 'reactstrap';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl, siteRoot, mediaUrl } from '../../../utils/constants';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import MainPanelTopbar from '../main-panel-topbar';

import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import ExterLinkOpMenu from './op-menu';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import { Link } from '@gatsbyjs/reach-router';


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

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  deleteExternalLink = () => {
    sysAdminServiceApi.sysAdminDeleteExternalLink(this.props.item.token).then(() => {
      this.props.deleteExternalLink(this.props.item.token);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  openExternalPage = (e) => {
    window.open(siteRoot + 'dtable/external-links/' + this.props.item.token + '/');
  };

  onCopyExternalLink = () => {
    const { item } = this.props;
    copy(item.url);
    toaster.success(gettext('External link is copied to the clipboard.'));
  };

  render() {
    const item = this.props.item;
    const { isDeleteDialogOpen } = this.state;
    const deleteDialogMsg = gettext('Are you sure you want to delete external link?');
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td>{item.from_dtable}</td>
          <td><Link to={`${siteRoot}sys/users/${encodeURIComponent(item.creator)}/`}>{item.creator_name}</Link></td>
          <td>{item.is_encrypted ? '√' : '×'}</td>
          <td>{item.expire_date ? dayjs(item.expire_date).format('YYYY-MM-DD') : '--'}</td>
          <td>
            {item.create_at ? dayjs(item.create_at).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </td>
          <td>{item.view_cnt}</td>
          <td>
            {this.state.isOpIconShown &&
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

const contentPropTypes = {
  loading: PropTypes.bool,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number,
  count: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  listExternalLinksByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      isOpIconShown: false,
      isDeleteDialogOpen: false,
    };
  }


  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listExternalLinksByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listExternalLinksByPage(this.props.currentPage + 1);
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
          <DTableEmptyTip text={gettext('No external links')} src={`${mediaUrl}img/no-items-tip.png`} />
        );
      } else {
        return (
          <Fragment>
            <table>
              <thead>
                <tr>
                  <th width="30%">{gettext('Base')}</th>
                  <th width="15%">{gettext('Creator')}</th>
                  <th width="10%">{gettext('Password-protected')}</th>
                  <th width="10%">{gettext('Expiration date')}</th>
                  <th width="20%">{gettext('Created at')}</th>
                  <th width='10%'>{gettext('Count')}</th>
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

class SearchExternalLinks extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      isSubmitBtnActive: false,
      loading: true,
      errorMsg: '',
      externalLinkList: [],
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
    sysAdminServiceApi.sysAdminSearchExternalLinks(this.state.query.trim(), page, this.state.perPage).then(res => {
      this.setState({
        externalLinkList: res.data.external_link_list,
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

  deleteExternalLink = (externalLink) => {
    let externalLinkList = this.state.externalLinkList.filter(curLink => {
      return curLink.token !== externalLink.token;
    });
    this.setState({ externalLinkList: externalLinkList });
  };

  render() {
    const { query, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('External links')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search external links')}</h4>
                <Form>
                  <FormGroup row>
                    <Col sm={5}>
                      <Input type="text" name="query" value={query} placeholder={gettext('Search links by token')}
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
                  items={this.state.externalLinkList}
                  count={this.state.count}
                  currentPage={this.state.currentPage}
                  deleteExternalLink={this.deleteExternalLink}
                  curPerPage={this.state.perPage}
                  resetPerPage={this.resetPerPage}
                  listExternalLinksByPage={this.getItems}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

SearchExternalLinks.propTypes = propTypes;

export default SearchExternalLinks;
