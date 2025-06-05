import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../utils/constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import OrgNav from './org-nav';
import Paginator from '../../../components/paginator';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

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
      highlight: false,
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
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

  render() {
    const { item } = this.props;
    let created_at = item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '--';
    let app_config = JSON.parse(item.app_config) || {};

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td>{item.dtable_name}</td>
          <td>{app_config['app_name']}</td>
          <td>{item.app_type}</td>
          <td>{item.creator}</td>
          <td>{created_at}</td>
          <td>{item.visit_times}</td>
        </tr>
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
  listExternalAppsByPage: PropTypes.func.isRequired,
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
    this.props.listExternalAppsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.listExternalAppsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No apps')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="15%">{gettext('Base')}</th>
                <th width="15%">{gettext('App name')}</th>
                <th width="15%">{gettext('App type')}</th>
                <th width="15%">{gettext('Creator')}</th>
                <th width="25%">{gettext('Created at')}</th>
                <th width="10%">{gettext('Count')}</th>
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

const orgGroupsPropTypes = {
  orgID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class OrgExternalApps extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      externalApps: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1,
      orgName: '',
    };
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({
        orgName: res.data.org_name
      }, () => {
        let urlParams = (new URL(window.location)).searchParams;
        const { currentPage, perPage } = this.state;
        this.setState({
          perPage: parseInt(urlParams.get('per_page') || perPage),
          currentPage: parseInt(urlParams.get('page') || currentPage)
        }, () => {
          this.listExternalAppsByPage(this.state.currentPage);
        });
      });
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listExternalAppsByPage(1);
    });
  };

  listExternalAppsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListOrgExternalApps(this.props.orgID, page, perPage).then((res) => {
      this.setState({
        loading: false,
        externalApps: res.data.external_app_list,
        currentPage: page,
        pageInfo: {
          current_page: page,
          has_next_page: Utils.hasNextPage(page, perPage, res.data.count),
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

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <OrgNav
              currentItem="external-apps"
              orgID={this.props.orgID}
              orgName={this.state.orgName}
            />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.externalApps}
                curPerPage={this.state.perPage}
                pageInfo={this.state.pageInfo}
                listExternalAppsByPage={this.listExternalAppsByPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgExternalApps.propTypes = orgGroupsPropTypes;

export default OrgExternalApps;
