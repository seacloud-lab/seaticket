import React, { Component, Fragment } from 'react';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext, isPro, isDefaultAdmin } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import MainPanelTopbar from './main-panel-topbar';
import { sysAdminServiceApi } from '../../api/sys-admin-service-api';

import '../../css/system-info.css';

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
    sysAdminServiceApi.sysAdminGetSysInfo().then((res) => {
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
    sysAdminServiceApi.sysAdminUploadLicense(file).then((res) => {
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

  renderDTableServerInfo = (dtableServerInfo) => {
    return dtableServerInfo.map((info, index) => {
      let enableCluster = info.enable_cluster;
      return (
        <Fragment key={index}>
          <table>
            <thead>
              <tr>
                <th width="70%">{gettext('Item')}</th>
                <th width="30%">{gettext('Value')}</th>
              </tr>
            </thead>
            <tbody>
              {enableCluster &&
                <Fragment>
                  <tr>
                    <td>{'Node ID'}</td>
                    <td>{info.node_id}</td>
                  </tr>
                  <tr>
                    <td>{'Node URL'}</td>
                    <td>{info.node_url}</td>
                  </tr>
                  <tr>
                    <td>{'Local node URL'}</td>
                    <td>{info.local_node_url}</td>
                  </tr>
                  <tr>
                    <td>{'Start time'}</td>
                    <td>{info.start_time}</td>
                  </tr>
                  <tr>
                    <td>{'Assigned count'}</td>
                    <td>{info.assigned_keys_count}</td>
                  </tr>
                </Fragment>
              }
              <tr>
                <td>{gettext('Number of websocket connections')}</td>
                <td>{info.web_socket_count}</td>
              </tr>
              <tr>
                <td>{gettext('Number of loaded tables')}</td>
                <td>{info.loaded_dtables_count}</td>
              </tr>
              <tr>
                <td>{gettext('Number of operations in the last hour')}</td>
                <td>{info.last_period_operations_count}</td>
              </tr>
              <tr>
                <td>{gettext('Number of total operations (since start up)')}</td>
                <td>{info.operation_count_since_up}</td>
              </tr>
              <tr>
                <td>{gettext('Number of last saved tables')}</td>
                <td>{info.last_dtable_saving_count}</td>
              </tr>
              <tr>
                <td>{gettext('Last save start time')}</td>
                <td>{info.last_dtable_saving_start_time ?
                  dayjs(info.last_dtable_saving_start_time).format('YYYY-MM-DD HH:mm')
                  :
                  ''}
                </td>
              </tr>
              <tr>
                <td>{gettext('Time taken for the last save')}</td>
                <td>{(info.last_dtable_saving_end_time && info.last_dtable_saving_start_time) ?
                  ((info.last_dtable_saving_end_time - info.last_dtable_saving_start_time) / 1000).toString() + ' s'
                  :
                  ''}
                </td>
              </tr>
            </tbody>
          </table>
          <br />
        </Fragment>
      );
    });
  };

  renderDTableServerInfoInETCD = (dtable_server_info_in_etcd) => {
    return dtable_server_info_in_etcd.map((info, index) => {
      return (
        <Fragment key={index}>
          <table>
            <thead>
              <tr>
                <th width="70%">{gettext('Item')}</th>
                <th width="30%">{gettext('Value')}</th>
              </tr>
            </thead>
            <tbody>
              <Fragment>
                <tr>
                  <td>{'Node ID'}</td>
                  <td>{info.node_id}</td>
                </tr>
                <tr>
                  <td>{'Node URL'}</td>
                  <td>{info.node_url}</td>
                </tr>
                <tr>
                  <td>{'Local node URL'}</td>
                  <td>{info.local_node_url}</td>
                </tr>
                <tr>
                  <td>{'Start time'}</td>
                  <td>{info.start_time}</td>
                </tr>
                <tr>
                  <td>{'Refresh time'}</td>
                  <td>{info.refresh_time}</td>
                </tr>
                <tr>
                  <td>{'Assigned count'}</td>
                  <td>{info.assigned_keys_count}</td>
                </tr>
              </Fragment>
            </tbody>
          </table>
          <br />
        </Fragment>
      );
    });
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
              <td>{gettext('Number of bases')}</td>
              <td>{base_count}</td>
            </tr>
            <tr>
              <td>{gettext('Number of bases in big data storage')}</td>
              <td>{archived_base_count}</td>
            </tr>
            <tr>
              <td>{gettext('Storage used by big data storage')}</td>
              <td>{Utils.bytesToSize(storage)}</td>
            </tr>
            <tr>
              <td>{gettext('Number of rows in big data storage')}</td>
              <td>{archived_row_count}</td>
            </tr>
          </tbody>
        </table>
      </Fragment>
    );
  };

  render() {
    let { license_mode, license_to, license_expiration, org_count, license_maxusers, multi_tenancy_enabled,
      active_users_count, users_count, groups_count, with_license, dtables_count, dtable_server_info, dtable_server_info_in_etcd,
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
                    {/* <a className="ml-1" href="http://manual.seafile.com/deploy_pro/migrate_from_seafile_community_server.html" target="_blank" rel='noreferrer noopener'>{gettext('Upgrade to Pro Edition')}</a> */}
                  </dd>
                }
                <dt className="info-item-heading">{gettext('Version info')}</dt>
                <dd className="info-item-content">{version}</dd>

                <dt className="info-item-heading">{gettext('Bases')}</dt>
                <dd className="info-item-content">
                  {this.renderBaseInfo(dtables_count, archived_base_count, archived_base_storage, archived_row_count)}
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
                <dt className="info-item-heading">{gettext('Table server info')}</dt>
                <dd className="info-item-content">
                  {this.renderDTableServerInfo(dtable_server_info)}
                </dd>
                {(dtable_server_info_in_etcd.length > 0) &&
                  <Fragment>
                    <dt className="info-item-heading">{'ETCD info'}</dt>
                    <dd className="info-item-content">
                      {this.renderDTableServerInfoInETCD(dtable_server_info_in_etcd)}
                    </dd>
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
