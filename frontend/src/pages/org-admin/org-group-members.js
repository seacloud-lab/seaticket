import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { gettext, loginUrl, siteRoot } from '../../utils/constants';
import Loading from '../../components/loading';
import OrgAdminGroupNav from '../../components/org-admin-group-nav';
import MainPanelTopbar from './main-panel-topbar';

import '../../css/org-admin-user.css';

const { orgID } = window.org.pageOptions;

const orgGroupMembersPropTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

class OrgGroupMembers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    orgAdminServiceApi.orgAdminListGroupMembers(orgID, this.props.groupID).then((res) => {
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
            <OrgAdminGroupNav groupID={this.props.groupID} currentItem='members' />
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

OrgGroupMembers.propTypes = orgGroupMembersPropTypes;

const contentPropTypes = {
  data: PropTypes.object.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const {
      loading, errorMsg, members
    } = this.props.data;

    if (loading) {
      return <Loading />;
    }
    if (errorMsg) {
      return <p className="error text-center mt-2">{errorMsg}</p>;
    }

    return (
      <Fragment>
        <table className="table-hover">
          <thead>
            <tr>
              <th width="5%">{/* icon */}</th>
              <th width="55%">{gettext('Name')}</th>
              <th width="30%">{gettext('Role')}</th>
              <th width="10%">{/* Operations*/}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((item, index) => {
              return <Item key={index} data={item} />;
            })}
          </tbody>
        </table>
      </Fragment>
    );
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  data: PropTypes.object.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
  }

  getRoleText() {
    switch (this.props.data.role) {
      case 'Owner':
        return gettext('Owner');
      case 'Admin':
        return gettext('Admin');
      case 'Member':
        return gettext('Member');
      default:
        return null;
    }
  }

  render() {
    const item = this.props.data;
    return (
      <tr>
        <td className="text-center"><img src={item.avatar_url} alt="" className="avatar" width="32" /></td>
        <td><Link to={`${siteRoot}org/useradmin/info/${encodeURIComponent(item.email)}/`}>{item.name}</Link></td>
        <td>{this.getRoleText()}</td>
        <td></td>
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

export default OrgGroupMembers;
