import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, Loading } from '@/components';
import { gettext, isPro, isDefaultAdmin } from '@/constants';
import { Utils } from '@/utils/utils';
import MainPanelTopbar from '../main-panel-topbar';
import sysAdminAPI from '@/sys-admin/api';

import './index.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class Info extends Component {

  constructor(props) {
    super(props);
    this.fileInput = React.createRef();
    this.state = {
      loading: true,
      errorMsg: '',
      sysInfo: {}
    };
  }

  componentDidMount() {
    sysAdminAPI.sysAdminGetSysInfo().then((res) => {
      this.setState({
        loading: false,
        sysInfo: res.data
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
  }

  uploadLicenseFile = (e) => {

    // no file selected
    if (!this.fileInput.current.files.length) {
      return;
    }
    const file = this.fileInput.current.files[0];
    sysAdminAPI.sysAdminUploadLicense(file).then((res) => {
      let info = this.state.sysInfo;
      Object.assign(info, res.data, { with_license: true });
      this.setState({
        sysInfo: info
      });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      toaster.danger(errMsg);
    });
  };

  openFileInput = () => {
    this.fileInput.current.click();
  };


  renderLicenseDescString = (license_mode, license_to, license_expiration) => {
    if (license_mode === 'life-time') {
      if (window.app.config.lang === 'zh-cn') {
        return '永久授权给 ' + license_to + '，技术支持服务至 ' + license_expiration + ' 到期';
      } else {
        return gettext('licensed to ') + license_to + ', ' + gettext('upgrade service expired in ') + license_expiration;
      }
    } else {
      return gettext('licensed to ') + license_to + ', ' + gettext('expires on ') + license_expiration;
    }
  };

  renderBaseInfo = (base_count, archived_base_count, storage, archived_row_count) => {
    return (
      <Fragment>
        <table>
          <thead>
            <tr>
              <th width="70%">{gettext('Item')}</th>
              <th width="30%">{gettext('Value')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{gettext('Number of projects')}</td>
              <td>{base_count}</td>
            </tr>
          </tbody>
        </table>
      </Fragment>
    );
  };

  render() {
    let { license_mode, license_to, license_expiration, org_count, license_maxusers, multi_tenancy_enabled,
      active_users_count, users_count, groups_count, with_license, projects_count,
      version, archived_base_count, archived_base_storage, archived_row_count } = this.state.sysInfo;
    let { loading, errorMsg } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container system-admin-info">
            <h2 className="heading">{gettext('Info')}</h2>
            <div className="content">
              {loading && <Loading />}
              {errorMsg && <p className="error text-center mt-4">{errorMsg}</p>}
              {(!loading && !errorMsg) &&
              <dl className="m-0">
                <dt className="info-item-heading">{gettext('System info')}</dt>
                {isPro ?
                  <dd className="info-item-content">
                    {gettext('Enterprise Edition')}
                    {with_license &&
                      ' ' + this.renderLicenseDescString(license_mode, license_to, license_expiration)
                    }<br/>
                    {isDefaultAdmin &&
                      <Fragment>
                        <Button
                          type="button"
                          className="mt-2"
                          color="primary"
                          outline={true}
                          onClick={this.openFileInput}
                        >{gettext('Upload license')}
                        </Button>
                        <input className="d-none" type="file" onChange={this.uploadLicenseFile} ref={this.fileInput} />
                      </Fragment>
                    }
                  </dd> :
                  <dd className="info-item-content">
                    {gettext('Developer edition')}
                  </dd>
                }
                <dt className="info-item-heading">{gettext('Version info')}</dt>
                <dd className="info-item-content">{version}</dd>

                <dt className="info-item-heading">{gettext('Bases')}</dt>
                <dd className="info-item-content">
                  {this.renderBaseInfo(projects_count, archived_base_count, archived_base_storage, archived_row_count)}
                </dd>
                {isPro ?
                  <Fragment>
                    <dt className="info-item-heading">{gettext('Activated users')} / {gettext('Total users')} / {gettext('Limits')}</dt>
                    <dd className="info-item-content">{active_users_count}{' / '}{users_count}{' / '}{with_license ? license_maxusers : '--'}</dd>
                  </Fragment> :
                  <Fragment>
                    <dt className="info-item-heading">{gettext('Activated users')} / {gettext('Total users')}</dt>
                    <dd className="info-item-content">{active_users_count} / {users_count}</dd>
                  </Fragment>
                }

                <dt className="info-item-heading">{gettext('Groups')}</dt>
                <dd className="info-item-content">{groups_count}</dd>

                {multi_tenancy_enabled &&
                  <Fragment>
                    <dt className="info-item-heading">{gettext('Organizations')}</dt>
                    <dd className="info-item-content">{org_count}</dd>
                  </Fragment>
                }
              </dl>
              }
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

Info.propTypes = propTypes;

export default Info;
