import React, { Component } from 'react';
import { Utils } from '@/utils/utils';
import { isEnter, isEsc } from '@/utils/hotkey';
import { siteRoot, gettext, avatarURL } from '@/constants';
import IconBtn from '../icon-button';
import Icon from '../icon';

import './account.css';

const { projectUuid, name } = window.app.pageOptions;

class ExternalUserAccount extends Component {

  constructor(props) {
    super(props);
    this.state = {
      showInfo: false,
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onDocumentKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }

  componentDidUpdate() {
    if (this.state.showInfo) {
      this.addEvents();
    } else {
      this.removeEvents();
    }
  }

  onDocumentKeydown = (e) => {
    if (isEnter(e)) {
      if (document.activeElement && document.activeElement.id === 'my-info') {
        this.onClickAccount();
      }
    } else if (isEsc(e)) {
      this.setState({ showInfo: false });
    }
  };

  getContainer = () => {
    return this.containerRef;
  };

  addEvents = () => {
    ['click', 'touchstart', 'keyup'].forEach(event =>
      document.addEventListener(event, this.handleDocumentClick, true)
    );
  };

  removeEvents = () => {
    ['click', 'touchstart', 'keyup'].forEach(event =>
      document.removeEventListener(event, this.handleDocumentClick, true)
    );
  };

  handleDocumentClick = (e) => {
    if (e && (e.which === 3 || (e.type === 'keyup' && e.which !== Utils.keyCodes.tab))) return;
    const container = this.getContainer();
    if (container.contains(e.target) && container !== e.target && (e.type !== 'keyup' || e.which === Utils.keyCodes.tab)) {
      return;
    }
    this.setState({
      showInfo: !this.state.showInfo,
    });
  };

  onClickAccount = () => {
    this.setState({
      showInfo: !this.state.showInfo,
    });
  };

  setContainer = (ref) => {
    this.containerRef = ref;
  };

  render() {
    return (
      <div id="account" ref={this.setContainer}>
        <span
          id="my-info"
          onClick={this.onClickAccount}
          className="account-toggle no-deco d-none d-md-block"
          aria-label={gettext('View profile and more')}
          title={gettext('View profile and more')}
          tabIndex={0}
        >
          <span>
            <img src={avatarURL} width="36" height="36" className="avatar" alt={gettext('Avatar')} />
          </span>
        </span>
        <IconBtn
          icon="more-vertical"
          className="account-toggle mobile-icon d-md-none"
          aria-label={gettext('View profile and more')}
          title={gettext('View profile and more')}
          onClick={this.onClickAccount}
        />
        <div id="user-info-popup" className={`account-popup sf-popover ${this.state.showInfo ? '' : 'hide'}`}>
          <div className="sf-popover-con">
            <div className="item o-hidden">
              <img src={avatarURL} width="32" height="32" className="avatar" alt={gettext('Avatar')} />
              <div className="txt text-truncate">{name}</div>
            </div>
            <a href={siteRoot + `portal-external/logout/${projectUuid}/`} className="item mt-2">
              <Icon symbol="logout" />
              {gettext('Log out')}
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ExternalUserAccount;
