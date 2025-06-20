import React, { Fragment } from 'react';
import { Popover } from 'reactstrap';
import { gettext } from '../../../constants/config';
import PropTypes from 'prop-types';
import Loading from '../../../components/loading';
import { seaQAAPI } from '../../../api/web-api';
import User from '../model/user';
import '../../../css/user-info-popover.css';

const propTypes = {
  target: PropTypes.string.isRequired,
  isUserDetailPopoverShow: PropTypes.bool.isRequired,
  userEmail: PropTypes.string,
};

class UserInfoPopOver extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      userInfo: null,
      isLoading: false,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isUserDetailPopoverShow === true) {
      if (!this.state.userInfo) {
        this.setState({ isLoading: true });
        let userEmail = nextProps.userEmail;
        seaQAAPI.getUserCommonInfo(userEmail).then(res => {
          const userInfo = new User(res.data);
          this.setState({ userInfo: userInfo, isLoading: false });
        }).catch(error => {
          this.setState({ isLoading: false });
        });
      }
    }
  }

  renderPopoverContent = () => {
    const { isUserDetailPopoverShow } = this.props;
    if (!isUserDetailPopoverShow) {
      return null;
    }
    let { userInfo, isLoading } = this.state;
    if (isLoading) {
      return <Loading />;
    }

    if (!userInfo) {
      return (
        <div className="user-popover-header">
          <div className="user-popover-title user-not-found">
            <span>{gettext('User not found')}</span>
          </div>
        </div>
      );
    }
    return (
      <Fragment>
        <div className="user-popover-header">
          <div className="user-popover-title">
            <img className="user-popover-avatar" alt="" src={userInfo.avatar_url} />
            <span className="user-popover-name">
              <span className="text-truncate">
                {userInfo.name}
              </span>
            </span>
          </div>
        </div>
        <div className="user-popover-body">
          <div className="user-detail-list">
            <span className="user-detail-email">{gettext('Email')}</span>
            <span className="user-detail-email-content">{userInfo.contact_email ? userInfo.contact_email : '--'}</span>
          </div>
        </div>
      </Fragment>);
  };

  render() {
    const { target, isUserDetailPopoverShow } = this.props;
    return (
      <Popover
        target={target}
        placement='bottom'
        isOpen={isUserDetailPopoverShow}
        boundariesElement={document.body}
        className="user-info-popover"
      >
        <div className="user-popover-container">
          {this.renderPopoverContent()}
        </div>
      </Popover>
    );
  }
}

UserInfoPopOver.propTypes = propTypes;

export default UserInfoPopOver;
