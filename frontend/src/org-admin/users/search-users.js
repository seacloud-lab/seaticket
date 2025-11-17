import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Col, Form, FormGroup, Input } from 'reactstrap';
import { toaster, EmptyTip, CenteredLoading, CenteredError } from '@/components';
import OrgUserInfo from '../models/org-user';
import orgAdminAPI from '../api';
import { Utils } from '@/utils/utils';
import { gettext, loginUrl, orgID, mediaUrl } from '@/constants';
import { TopBar, Main } from '../main-panel';
import Users from './users';

class SearchUsers extends Component {

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      loading: true,
      errorMsg: '',
      currentPage: 1,
      perPage: 100,
      hasNextPage: false,
      userList: [],
      count: 0
    };
  }

  componentDidMount() {
    let params = (new URL(document.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      query: params.get('query') || '',
      perPage: parseInt(params.get('per_page') || perPage),
      currentPage: parseInt(params.get('page') || currentPage),
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

  getSearchUsers = (e) => {
    e.preventDefault();
    this.getItems(1);
  };

  getItems = (page) => {
    let { query, perPage } = this.state;
    orgAdminAPI.orgAdminSearchUsers(orgID, query.trim(), page, perPage).then(res => {
      let userList = res.data.user_list.map(item => {
        return new OrgUserInfo(item);
      });
      this.setState({
        userList: userList,
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

  onChangePageNum = (num) => {
    const { page: oldPage } = this.state;
    let newPage;
    if (num === 1) {
      newPage = oldPage + 1;
    } else {
      newPage = oldPage - 1;
    }
    this.setState({ page: newPage }, () => {
      this.getItems(newPage);
    });
  };

  handleInputChange = (e) => {
    this.setState({ query: e.target.value });
  };

  deleteUser = (user) => {
    orgAdminAPI.orgAdminDeleteOrgUser(orgID, user.email).then(res => {
      let newUserList = this.state.userList.filter(item => {
        return item.email !== user.email;
      });
      this.setState({ userList: newUserList });
      toaster.success(gettext('%s deleted').replace('%s', gettext('1 user')));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renderContent = () => {
    const { loading, errorMsg, userList, currentPage, perPage, count } = this.state;
    if (loading) return (<CenteredLoading />);
    if (errorMsg) return (<CenteredError>{errorMsg}</CenteredError>);
    if (userList.length === 0) {
      return (
        <EmptyTip text={gettext('No users')} src={`${mediaUrl}img/no-items-tip.png`} />
      );
    }
    return (
      <Users
        currentTab={'users'}
        toggleDelete={this.deleteUser}
        users={userList}
        page={currentPage}
        pageNext={Utils.hasNextPage(currentPage, perPage, count)}
        perPage={perPage}
        onChangePageNum={this.onChangePageNum}
        onChangePerPage={this.resetPerPage}
      />
    );
  };

  render() {
    let { query } = this.state;

    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <Main title={gettext('Users')} className="mb-6">
          <div className="mt-4 mb-6">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search users')}</h4>
            <Form>
              <FormGroup row>
                <Col sm={5}>
                  <Input type="text" name="query" value={query} placeholder={gettext('Search users')}
                    onChange={this.handleInputChange}/>
                </Col>
              </FormGroup>
              <FormGroup row>
                <Col sm={{ size: 5 }}>
                  <button
                    className="btn btn-outline-primary" disabled={!query.trim()}
                    onClick={this.getSearchUsers}>{gettext('Submit')}
                  </button>
                </Col>
              </FormGroup>
            </Form>
          </div>
          <div className="mt-4">
            <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
            {this.renderContent()}
          </div>
        </Main>
      </Fragment>
    );
  }
}

SearchUsers.propTypes = {
  onCloseSidePanel: PropTypes.func
};

export default SearchUsers;
