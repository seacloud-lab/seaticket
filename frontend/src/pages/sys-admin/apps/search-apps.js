import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Col, Form, FormGroup, Input } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl } from '../../../utils/constants';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import MainPanelTopbar from '../main-panel-topbar';
import AppsTable from './apps-table';


const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class SearchApps extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      isSubmitBtnActive: false,
      loading: true,
      errorMsg: '',
      apps: [],
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
    sysAdminServiceApi.sysAdminSearchExternalApps(this.state.query.trim(), page, this.state.perPage).then(res => {
      this.setState({
        apps: res.data.apps,
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
        const newApps = this.state.apps.filter(app => app.app_uuid !== appUuid);
        this.setState({ apps: newApps });
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
    const { query, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('App')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search apps')}</h4>
                <Form>
                  <FormGroup row>
                    <Col sm={5}>
                      <Input type="text" name="query" value={query} placeholder={gettext('Search apps')}
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
                <AppsTable
                  loading={this.state.loading}
                  errorMsg={this.state.errorMsg}
                  items={this.state.apps}
                  hasNextPage={(this.state.count - this.state.perPage * this.state.currentPage) > 0}
                  curPerPage={this.state.perPage}
                  currentPage={this.state.currentPage}
                  resetPerPage={this.resetPerPage}
                  listAppsByPage={this.getItems}
                  onChangeAppStatus={this.onChangeAppStatus}
                  onDeleteApp={this.onDeleteApp}
                  onDisableAppOpenAccess={this.onDisableAppOpenAccess}
                  onEnableAppOpenAccess={this.onEnableAppOpenAccess}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

SearchApps.propTypes = propTypes;

export default SearchApps;
