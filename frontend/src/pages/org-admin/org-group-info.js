import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, loginUrl, siteRoot } from '../../constants';
import Loading from '../../components/loading';
import OrgAdminGroupNav from '../../components/org-admin-group-nav';
import MainPanelTopbar from './main-panel-topbar';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';

import '../../css/org-admin-user.css';

const { orgID } = window.org.pageOptions;

const orgGroupInfoPropTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

class OrgGroupInfo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    orgAdminServiceApi.orgAdminGetGroup(orgID, this.props.groupID).then((res) => {
      this.setState(Object.assign({
        loading: false
      }, res.data));
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: gettext('Group not found')
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
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <OrgAdminGroupNav groupID={this.props.groupID} currentItem='info' />
            <div className="cur-view-content">
              <Content
                data={this.state}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgGroupInfo.propTypes = orgGroupInfoPropTypes;

const contentPropTypes = {
  data: PropTypes.object,
};

class Content extends Component {

  render() {
    const {
      loading, errorMsg,
      group_name, creator_email, creator_name
    } = this.props.data;

    if (loading) {
      return <Loading />;
    }
    if (errorMsg) {
      return <p className="error text-center mt-2">{errorMsg}</p>;
    }

    return (
      <dl className="m-0">
        <dt className="info-item-heading">{gettext('Name')}</dt>
        <dd>{group_name}</dd>
        <dt className="info-item-heading">{gettext('Owner')}</dt>
        <dd>
          {creator_email === 'system admin' &&
            <span>{'--'}</span>
          }
          {creator_email !== 'system admin' &&
            <Link to={`${siteRoot}org/useradmin/info/${encodeURIComponent(creator_email)}/`}>{creator_name}</Link>
          }
        </dd>
      </dl>
    );
  }
}

Content.propTypes = contentPropTypes;

export default OrgGroupInfo;
