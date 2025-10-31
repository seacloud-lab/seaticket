import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, loginUrl, siteRoot } from '@/constants';
import { CenteredError, CenteredLoading } from '@/components';
import orgAdminAPI from '../api';
import GroupNav from '../group-nav';
import { Main, TopBar } from '../main-panel';

const { orgID } = window.org.pageOptions;

class GroupInfo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    orgAdminAPI.orgAdminGetGroup(orgID, this.props.groupID).then((res) => {
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

  renderInfo = () => {
    const { loading, errorMsg, group_name, creator_email, creator_name } = this.state;

    if (loading) {
      return (<CenteredLoading />);
    }
    if (errorMsg) {
      return (<CenteredError>{errorMsg}</CenteredError>);
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
            <Link to={`${siteRoot}org/users/info/${encodeURIComponent(creator_email)}/`}>{creator_name}</Link>
          }
        </dd>
      </dl>
    );
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main
          title={<GroupNav groupID={this.props.groupID} currentItem='info' />}
          titleClassName="pl-0"
        >
          {this.renderInfo()}
        </Main>
      </>
    );
  }
}

GroupInfo.propTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

export default GroupInfo;
