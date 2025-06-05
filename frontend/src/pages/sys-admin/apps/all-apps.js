import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import Search from '../search';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot } from '../../../utils/constants';
import MainPanelTopbar from '../main-panel-topbar';
import '../../../css/system-dtable.css';
import AppsTable from './apps-table';

const allAppsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class AllApps extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      apps: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listAppsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listAppsByPage(1);
    });
  };

  listAppsByPage = (page) => {
    sysAdminServiceApi.sysAdminListExternalApps(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        apps: res.data.external_app_list,
        currentPage: page,
        hasNextPage: res.data.page_info.has_next_page
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

  getSearch = () => {
    return <Search
      placeholder={gettext('Search apps')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-apps/?query=${encodeURIComponent(keyword)}`);
  };

  onChangeAppStatus = (appUuid) => {
    const app = this.state.apps.find(app => app.app_uuid === appUuid);
    if (app){
      const inactive = !app.inactive;
      sysAdminServiceApi.sysAdminChangeExternalAppActiveStatus(appUuid, inactive).then(() => {
        app.inactive = inactive;
        toaster.success(gettext('Success'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    } else {
      toaster.warning(gettext('App not found'));
    }
  };

  onDeleteApp = (appUuid) => {
    const app = this.state.apps.find(app => app.app_uuid === appUuid);
    if (app) {
      sysAdminServiceApi.sysAdminDeleteExternalApp(appUuid).then(() => {
        toaster.success(gettext('Success'));
        this.listAppsByPage(this.state.currentPage);
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    } else {
      toaster.warning(gettext('App not found'));
    }
  };

  onDisableAppOpenAccess = (appUuid) => {
    const app = this.state.apps.find(app => app.app_uuid === appUuid);
    if (app) {
      sysAdminServiceApi.sysAdminChangeExternalAppOpenAccessStatus(appUuid, false).then(() => {
        app.can_anonymous_access = false;
        toaster.success(gettext('Success'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    } else {
      toaster.warning(gettext('App not found'));
    }
  };

  onEnableAppOpenAccess = (appUuid) => {
    const app = this.state.apps.find(app => app.app_uuid === appUuid);
    if (app) {
      sysAdminServiceApi.sysAdminChangeExternalAppOpenAccessStatus(appUuid, true).then(() => {
        app.can_anonymous_access = true;
        toaster.success(gettext('Success'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    } else {
      toaster.warning(gettext('App not found'));
    }
  };

  render() {
    const { loading, errorMsg, apps, perPage, currentPage, hasNextPage } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}></MainPanelTopbar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-content">
              <AppsTable
                loading={loading}
                errorMsg={errorMsg}
                items={apps}
                curPerPage={perPage}
                hasNextPage={hasNextPage}
                currentPage={currentPage}
                listAppsByPage={this.listAppsByPage}
                resetPerPage={this.resetPerPage}
                onChangeAppStatus={this.onChangeAppStatus}
                onDeleteApp={this.onDeleteApp}
                onDisableAppOpenAccess={this.onDisableAppOpenAccess}
                onEnableAppOpenAccess={this.onEnableAppOpenAccess}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AllApps.propTypes = allAppsPropTypes;

export default AllApps;
