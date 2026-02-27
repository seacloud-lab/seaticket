import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Loading } from '@/components';
import { gettext } from '@/constants';
import { TopBar, Main } from '../main-panel';
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

  render() {
    let { loading, errorMsg, sysInfo } = this.state;
    let { org_count, multi_tenancy_enabled, active_users_count, users_count, groups_count, projects_count, version } = sysInfo;
    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={gettext('Info')}>
          {loading && <Loading />}
          {errorMsg && <p className="error text-center mt-4">{errorMsg}</p>}
          {(!loading && !errorMsg) && (
            <dl className="m-0">
              <dt className="info-item-heading">{gettext('Version info')}</dt>
              <dd className="info-item-content">{version}</dd>

              <dt className="info-item-heading">{gettext('Projects')}</dt>
              <dd className="info-item-content">
                <table>
                  <thead>
                    <tr>
                      <th width="50%">{gettext('Item')}</th>
                      <th width="50%">{gettext('Value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{gettext('Number of projects')}</td>
                      <td>{projects_count}</td>
                    </tr>
                  </tbody>
                </table>
              </dd>

              <dt className="info-item-heading">{gettext('Activated users')} / {gettext('Total users')}</dt>
              <dd className="info-item-content">{active_users_count} / {users_count}</dd>

              <dt className="info-item-heading">{gettext('Groups')}</dt>
              <dd className="info-item-content">{groups_count}</dd>

              {multi_tenancy_enabled &&
                <Fragment>
                  <dt className="info-item-heading">{gettext('Organizations')}</dt>
                  <dd className="info-item-content">{org_count}</dd>
                </Fragment>
              }
            </dl>
          )}
        </Main>
      </Fragment>
    );
  }
}

Info.propTypes = propTypes;

export default Info;
