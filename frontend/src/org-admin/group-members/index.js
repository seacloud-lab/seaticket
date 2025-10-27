import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import orgAdminAPI from '../api';
import { gettext, loginUrl } from '@/constants';
import { CenteredError, CenteredLoading } from '@/components';
import GroupNav from '../group-nav';
import { TopBar, Main } from '../main-panel';
import Member from './member';

const { orgID } = window.org.pageOptions;

class GroupMembers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    orgAdminAPI.orgAdminListGroupMembers(orgID, this.props.groupID).then((res) => {
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

  renderMembers = () => {
    const { loading, errorMsg, members } = this.state;

    if (loading) return (<CenteredLoading />);
    if (errorMsg) return (<CenteredError>{errorMsg}</CenteredError>);

    return (
      <>
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
              return <Member key={index} data={item} />;
            })}
          </tbody>
        </table>
      </>
    );
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main
          title={<GroupNav groupID={this.props.groupID} currentItem='members' />}
          titleClassName="pl-0"
        >
          {this.renderMembers()}
        </Main>
      </>
    );
  }
}

GroupMembers.propTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

export default GroupMembers;
