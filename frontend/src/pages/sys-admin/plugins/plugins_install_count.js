import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import Loading from '../../../components/loading';
import { DTableEmptyTip } from 'dtable-ui-component';
import { gettext, mediaUrl } from '../../../utils/constants';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import PluginNav from './plugin-nav';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  curPerPage: PropTypes.number,
  pageInfo: PropTypes.object.isRequired,
  listPluginsInstallCountByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPageList = () => {
    this.props.listPluginsInstallCountByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.listPluginsInstallCountByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No installed plugins')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="25%">{gettext('Plugin name')}</th>
                <th width="20%">{gettext('Plugin install count')}</th>
                <th width="35%">{gettext('Last install time')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
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

const itemPropTypes = {
  item: PropTypes.object.isRequired,
};

class Item extends Component {
  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    this.setState({
      highlight: true
    });
  };

  handleMouseLeave = () => {
    this.setState({
      highlight: false
    });
  };

  render() {
    const { item } = this.props;
    let last_install_time = item.updated_at ? dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss') : '--';
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>{item.plugin_name}</td>
          <td>{item.count}</td>
          <td>{last_install_time}</td>
        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const PluginsInstallCountPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class PluginsInstallCount extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      pluginsInstallCountList: [],
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
      this.listPluginsInstallCountByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listPluginsInstallCountByPage(1);
    });
  };

  listPluginsInstallCountByPage = (page) => {
    sysAdminServiceApi.sysAdminListPluginsInstallCount(page, this.state.perPage).then((res) => {
      if (res.data.plugins_install_count_list) {
        let plugins_install_count = res.data.count;
        let start = (page - 1) * this.state.perPage;
        let end = start + this.state.perPage;
        let has_next_page = false;
        if (plugins_install_count > end) {
          has_next_page = true;
        }

        let page_info = {
          'has_next_page': has_next_page,
          'current_page': page
        };
        this.setState({
          pluginsInstallCountList: res.data.plugins_install_count_list,
          loading: false,
          pageInfo: page_info,
        });
      } else {
        this.setState({
          loading: false,
          errorMsg: '',
        });
      }

    }).catch(error => {
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

  render() {

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
        </MainPanelTopbar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <PluginNav currentItem='plugins-install-count' />

            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.pluginsInstallCountList}
                pageInfo={this.state.pageInfo}
                listPluginsInstallCountByPage={this.listPluginsInstallCountByPage}
                curPerPage={this.state.perPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

PluginsInstallCount.propTypes = PluginsInstallCountPropTypes;

export default PluginsInstallCount;
