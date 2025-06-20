import React, { Fragment, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';
import { seaQAAPI } from './api/web-api';
import { gettext, mediaUrl } from './utils/constants';
import { Utils } from './utils/utils';
import { DTableEmptyTip, toaster } from 'dtable-ui-component';
import CreateWebsiteDialog from './pages/dtable/dialog/create-website-dialog';
import Paginator from './components/paginator';
import Loading from './components/loading';
import dayjs from './utils/dayjs';
import CommonOperationConfirmationDialog from './components/dialog/common-operation-confirmation-dialog';

import './css/shared-file-view.css';

const {
  projectName, workspaceID
} = window.app.pageOptions;


const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  pageInfo: PropTypes.object,
  deleteWebsite: PropTypes.func.isRequired,
  getListByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
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
    this.props.getListByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No websites')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="20%">{gettext('Website url')}</th>
                <th width="35%">{gettext('Sitemap Url')}</th>
                <th width="20%">{gettext('Created at')}</th>
                <th width="20%">{gettext('Last crawled at')}</th>
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
                  deleteWebsite={this.props.deleteWebsite}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
            resetPerPage={this.props.resetPerPage}
            curPerPage={this.props.perPage}
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
  deleteWebsite: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isDeleteDialogOpen: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
    });
    this.props.onUnfreezedItem();
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  deleteWebsite = () => {
    this.props.deleteWebsite(this.props.item.id);
  };


  render() {
    const { isDeleteDialogOpen } = this.state;
    const { item } = this.props;

    let deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', item.url);
    let lastCrawledAt = item.last_crawled_at ? dayjs(item.last_crawled_at).fromNow() : '--';
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>{item.url}</td>
          <td>{item.sitemap_url}</td>
          <td><span title={dayjs(item.created_at).format('llll')}>{dayjs(item.created_at).fromNow()}</span></td>
          <td><span title={dayjs(item.created_at).format('llll')}>{lastCrawledAt}</span></td>
          <td><button onClick={this.toggleDeleteDialog}>{gettext('Delete')}</button></td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete website')}
            message={deleteDialogMsg}
            executeOperation={this.deleteWebsite}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

class WebsitesView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      isCreateWebsiteDialogOpen: false,
      websiteList: [],
      perPage: 25,
      currentPage: 1,
      pageInfo: {},
    };
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    this.getWebsiteListByPage(this.state.currentPage);
  }

  getWebsiteListByPage = (page) => {
    seaQAAPI.listWebsites(workspaceID, projectName, page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        websiteList: res.data.website_list,
        pageInfo: res.data.page_info
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
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

  deleteWebsite = (wesiteID) => {
    seaQAAPI.deleteWebsite(workspaceID, projectName, wesiteID).then(res => {
      let newWebsiteList = this.state.websiteList.filter(item => {
        return item.id !== wesiteID;
      });
      this.setState({
        websiteList: newWebsiteList
      });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  createWebsite = (websiteUrl, websiteSiteMapUrl) => {
    seaQAAPI.createWebsite(workspaceID, projectName, websiteUrl, websiteSiteMapUrl).then(res => {
      let newWebsiteList = this.state.websiteList;
      newWebsiteList.unshift(res.data.website);
      this.setState({
        websiteList: newWebsiteList
      });
      this.toggleCreateWebsiteDialog();
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };


  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getWebsiteListByPage(1);
    });
  };

  toggleCreateWebsiteDialog = () => {
    this.setState({ isCreateWebsiteDialogOpen: !this.state.isCreateWebsiteDialogOpen });
  };

  render() {
    let { isCreateWebsiteDialogOpen, loading } = this.state;
    return (
      <Fragment>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Websites')}</h2>
            <Button className="btn btn-secondary operation-item" onClick={this.toggleCreateWebsiteDialog}>{gettext('New website')}</Button>
            <div className="cur-view-content">
              <Content
                loading={loading}
                errorMsg={this.state.errorMsg}
                items={this.state.websiteList}
                pageInfo={this.state.pageInfo}
                deleteWebsite={this.deleteWebsite}
                getListByPage={this.getWebsiteListByPage}
                resetPerPage={this.resetPerPage}
                perPage={this.state.perPage}
              />
            </div>
          </div>
        </div>
        {isCreateWebsiteDialogOpen &&
          <CreateWebsiteDialog
            createWebsite={this.createWebsite}
            toggleDialog={this.toggleCreateWebsiteDialog}
          />
        }
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(<WebsitesView />);
