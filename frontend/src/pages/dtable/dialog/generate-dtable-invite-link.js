import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { Button, Form, FormGroup, Label, Input, InputGroup, Alert, Tooltip } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext, shareLinkPasswordMinLength, shareLinkExpireDaysMax, shareLinkExpireDaysMin,
  shareLinkExpireDaysDefault } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import DtableSharePermissionEditor from '../../../components/select-editor/dtable-share-permission-editor';
import DTableInviteLink from '../../../models/dtable-invite-link';

const linkItemPropTypes = {
  inviteLink: PropTypes.object.isRequired,
  onCopyInviteLink: PropTypes.func.isRequired,
  onDeleteInviteLinkSubmit: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
};

const MAX_EXPIRE_DAYS = 36500;

class LinkItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperation: false,
      isShowLinkTip: false,
    };
  }

  onMouseOver = () => {
    this.setState({ isShowOperation: !this.state.isShowOperation });
  };

  convertPermission = (permission) => {
    switch (permission) {
      case 'r':
        return gettext('Read-Only');
      case 'rw':
        return gettext('Read-Write');
      default:
        return '';
    }
  };

  onCopyInviteLink = () => {
    let inviteLink = this.props.inviteLink;
    this.props.onCopyInviteLink(inviteLink.link);
  };

  onDeleteInviteLinkSubmit = () => {
    let inviteLink = this.props.inviteLink;
    this.props.onDeleteInviteLinkSubmit(inviteLink);
  };

  cutLink = (link) => {
    let length = link.length;
    return link.slice(0, 10) + '...' + link.slice(length - 13);
  };

  render() {
    let { inviteLink } = this.props;
    let { isShowOperation, isShowLinkTip } = this.state;
    let expire_date = inviteLink.expire_date ? dayjs(inviteLink.expire_date).format('YYYY-MM-DD HH:mm') : '-';
    return (
      <tr className="invite-link-tr" onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOver}>
        <td>{this.convertPermission(inviteLink.permission)}</td>
        <td id={`invite-link-url-${inviteLink.token}`}>{this.cutLink(inviteLink.link)}</td>
        <Tooltip
          isOpen={isShowLinkTip}
          target={`invite-link-url-${inviteLink.token}`}
          placement='bottom'
          toggle={() => this.setState({ isShowLinkTip: !isShowLinkTip })}
          modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
        >
          {inviteLink.link}
        </Tooltip>
        <td><span className={inviteLink.is_expired ? 'error' : '' }>{expire_date}</span></td>
        <td>
          {inviteLink.has_password && <span className="dtable-font dtable-icon-unlock"/>}
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-copy-link action-icon ${isShowOperation ? '' : 'hide'}`}
            data-placement="bottom"
            onClick={this.onCopyInviteLink}
            title={gettext('Copy link')}
            aria-label={gettext('Copy link')}
          />
          <span
            className={`dtable-font dtable-icon-x action-icon ${isShowOperation ? '' : 'hide'}`}
            onClick={this.onDeleteInviteLinkSubmit}
            title={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

LinkItem.propTypes = linkItemPropTypes;

const propTypes = {
  workspaceID: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  closeShareDialog: PropTypes.func.isRequired,
};

class GenerateDTableInviteLink extends React.Component {

  constructor(props) {
    super(props);
    this.isExpireDaysNoLimit = (parseInt(shareLinkExpireDaysMin) === 0 && parseInt(shareLinkExpireDaysMax) === 0 && shareLinkExpireDaysDefault === 0);
    this.defaultExpireDays = this.isExpireDaysNoLimit ? '' : shareLinkExpireDaysDefault;
    this.permissionOptions = ['read-only', 'read-write'];

    this.state = {
      inviteLink: null,
      inviteLinks: [],
      isLoading: true,
      currentPermission: this.permissionOptions[0],
      isSendLinkShown: false,
      permission: 'rw',
      password: '',
      passwdnew: '',
      expireDays: this.defaultExpireDays,

      errorInfo: '',
      isPasswordInputShow: false,
      isExpireInputShow: !this.isExpireDaysNoLimit,
      isPasswordVisible: false,
      errMessage: '',
    };
  }

  componentDidMount() {
    let workspaceID = this.props.workspaceID;
    let name = this.props.name;
    this.getDTableInviteLink(workspaceID, name);
  }

  getDTableInviteLink(workspaceID, name) {
    dtableWebAPI.getDTableInviteLink(workspaceID, name).then((res) => {
      let inviteLinks = res.data.dtable_share_links.map((inviteLink) => {
        return new DTableInviteLink(inviteLink);
      });
      this.setState({ inviteLinks });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      this.setState({ isLoading: true });
      toaster.danger(errMessage);
    });
  }

  validateParamsInput = () => {
    let { isPasswordInputShow, isExpireInputShow, password, passwdnew, expireDays } = this.state;
    if (isPasswordInputShow) {
      if (password.length === 0) {
        this.setState({ errorInfo: 'Please enter password' });
        return false;
      }
      if (password.length < shareLinkPasswordMinLength) {
        this.setState({ errorInfo: 'Password is too short' });
        return false;
      }
      if (password !== passwdnew) {
        this.setState({ errorInfo: 'Passwords don\'t match' });
        return false;
      }
    }

    // validate days
    // no limit
    let reg = /^\d+$/;
    if (this.isExpireDaysNoLimit) {
      if (isExpireInputShow) {
        if (!expireDays) {
          this.setState({ errorInfo: 'Please enter days' });
          return false;
        }
        if (expireDays > MAX_EXPIRE_DAYS) {
          this.setState({ errorInfo: 'Expire days is too long' });
          return false;
        }
        if (!reg.test(expireDays)) {
          this.setState({ errorInfo: 'Please enter a non-negative integer' });
          return false;
        }
        this.setState({ expireDays: parseInt(expireDays) });
      }
    } else {
      if (!expireDays) {
        this.setState({ errorInfo: 'Please enter days' });
        return false;
      }
      if (expireDays > MAX_EXPIRE_DAYS) {
        this.setState({ errorInfo: 'Expire days is too long' });
        return false;
      }
      if (!reg.test(expireDays)) {
        this.setState({ errorInfo: 'Please enter a non-negative integer' });
        return false;
      }

      expireDays = parseInt(expireDays);
      let minDays = parseInt(shareLinkExpireDaysMin);
      let maxDays = parseInt(shareLinkExpireDaysMax);

      if (minDays !== 0 && minDays !== maxDays) {
        if (expireDays < minDays) {
          this.setState({ errorInfo: 'Please enter valid days' });
          return false;
        }
      }

      if (minDays === 0 && maxDays !== 0 ) {
        if (expireDays > maxDays) {
          this.setState({ errorInfo: 'Please enter valid days' });
          return false;
        }
      }

      if (minDays !== 0 && maxDays !== 0) {
        if (expireDays < minDays || expireDays > maxDays) {
          this.setState({ errorInfo: 'Please enter valid days' });
          return false;
        }
      }
      this.setState({ expireDays: expireDays });
    }
    return true;
  };

  generateDTableInviteLink = () => {
    let isValid = this.validateParamsInput();
    if (isValid) {
      this.setState({ errorInfo: '' });
      let { workspaceID, name } = this.props;
      let { permission, password, expireDays, isPasswordInputShow, isExpireInputShow } = this.state;
      password = isPasswordInputShow ? password : null;
      expireDays = isExpireInputShow ? expireDays : null;
      dtableWebAPI.createDTableInviteLink(workspaceID, name, permission, password, expireDays).then((res) => {
        let newInviteLink = new DTableInviteLink(res.data);
        let { inviteLinks } = this.state;
        inviteLinks.push(newInviteLink);
        this.setState({
          inviteLinks,
          isPasswordInputShow: false,
          isExpireInputShow: !this.isExpireDaysNoLimit,
          password: '',
          passwdnew: '',
          expireDays: this.defaultExpireDays
        });
        toaster.success(gettext('Link generated.'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  onCopyInviteLink = (link) => {
    copy(link);
    toaster.success(gettext('Invite link is copied to the clipboard.'));
  };

  deleteInviteLink = (inviteLink) => {
    dtableWebAPI.deleteDTableInviteLink(inviteLink.token).then(() => {
      let newInviteLinks = this.state.inviteLinks.filter((item) => {
        return item.token !== inviteLink.token;
      });
      this.setState({ inviteLinks: newInviteLinks });
      toaster.success(gettext('Invite link deleted'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onDeleteInviteLinkSubmit = (currentInviteLink) => {
    this.deleteInviteLink(currentInviteLink);
  };

  updatePermission = (permission) => {
    this.setState({ permission: permission });
  };

  onPasswordInputChecked = () => {
    this.setState({ isPasswordInputShow: !this.state.isPasswordInputShow });
  };

  onExpireChecked = () => {
    this.setState({ isExpireInputShow: !this.state.isExpireInputShow });
  };

  inputPassword = (e) => {
    this.setState({ password: e.target.value });
  };

  inputPasswordNew = (e) => {
    this.setState({ passwdnew: e.target.value });
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  onExpireDaysChanged = (e) => {
    this.setState({ expireDays: e.target.value });
  };

  generatePassword = () => {
    let val = Utils.generatePassword(shareLinkPasswordMinLength);
    this.setState({
      password: val,
      passwdnew: val
    });
  };

  render() {
    let passwordLengthTip = gettext('(at least {passwordLength} characters)');
    passwordLengthTip = passwordLengthTip.replace('{passwordLength}', shareLinkPasswordMinLength);
    return (
      <div className="generate-share-link">
        <Form>
          <FormGroup>
            <Label style={{ fontSize: '14px', color: '#666666' }}>{gettext('Permission')}</Label>
            <div style={{ width: '50%' }}>
              <DtableSharePermissionEditor
                isTextMode={false}
                isEditIconShow={false}
                currentPermission={this.state.permission}
                onPermissionChanged={this.updatePermission}
              />
            </div>
          </FormGroup>
          <FormGroup check>
            <Label check className="position-relative">
              <Input type="checkbox" checked={this.state.isPasswordInputShow} onChange={this.onPasswordInputChecked}/>
              {'  '}{gettext('Add password protection')}
            </Label>
          </FormGroup>
          {this.state.isPasswordInputShow &&
            <FormGroup className="link-operation-content" check>
              <Label>{gettext('Password')}</Label>{' '}<span className="tip">{passwordLengthTip}</span>
              <InputGroup className="passwd">
                <Input
                  type={this.state.isPasswordVisible ? 'text' : 'password'}
                  value={this.state.password || ''}
                  onChange={this.inputPassword}
                  autoComplete="new-password"
                />
                <Button onClick={this.togglePasswordVisible}>
                  <i className={`link-operation-icon fas dtable-font dtable-icon-eye ${this.state.isPasswordVisible ? '' : '-slash'}`}></i>
                </Button>
                <Button onClick={this.generatePassword}>
                  <i className="dtable-font dtable-icon-random-generation"></i>
                </Button>
              </InputGroup>
              <Label>{gettext('Password again')}</Label>
              <Input
                className="passwd"
                type={this.state.isPasswordVisible ? 'text' : 'password'}
                value={this.state.passwdnew || ''}
                onChange={this.inputPasswordNew}
                autoComplete="new-password"
              />
            </FormGroup>
          }
          {this.isExpireDaysNoLimit && (
            <Fragment>
              <FormGroup check>
                <Label check className="position-relative">
                  <Input
                    className="expire-checkbox"
                    type="checkbox"
                    onChange={this.onExpireChecked}
                    checked={this.state.isExpireInputShow}
                  />
                  {'  '}{gettext('Add auto expiration')}
                </Label>
              </FormGroup>
              {this.state.isExpireInputShow &&
                <FormGroup check>
                  <Label check className='position-relative'>
                    <Input
                      className="expire-input expire-input-border"
                      type="text"
                      value={this.state.expireDays}
                      onChange={this.onExpireDaysChanged}
                      readOnly={!this.state.isExpireInputShow}
                    />
                    <span className="expir-span">{gettext('days')}</span>
                  </Label>
                </FormGroup>
              }
            </Fragment>
          )}
          {!this.isExpireDaysNoLimit && (
            <Fragment>
              <FormGroup check>
                <Label check className="position-relative">
                  <Input className="expire-checkbox" type="checkbox" onChange={this.onExpireChecked} checked readOnly disabled/>
                  {'  '}{gettext('Add auto expiration')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check className='position-relative'>
                  <Input className="expire-input expire-input-border" type="text" value={this.state.expireDays} onChange={this.onExpireDaysChanged} />
                  <span className="expir-span">{gettext('days')}</span>
                  {(parseInt(shareLinkExpireDaysMin) !== 0 && parseInt(shareLinkExpireDaysMax) !== 0) && (
                    <span className="d-inline-block ml-7">
                      ({shareLinkExpireDaysMin} - {shareLinkExpireDaysMax}{' '}{gettext('days')})
                    </span>
                  )}
                  {(parseInt(shareLinkExpireDaysMin) !== 0 && parseInt(shareLinkExpireDaysMax) === 0) && (
                    <span className="d-inline-block ml-7">
                      ({gettext('Greater than or equal to')} {shareLinkExpireDaysMin}{' '}{gettext('days')})
                    </span>
                  )}
                  {(parseInt(shareLinkExpireDaysMin) === 0 && parseInt(shareLinkExpireDaysMax) !== 0) && (
                    <span className="d-inline-block ml-7">
                      ({gettext('Less than or equal to')} {shareLinkExpireDaysMax}{' '}{gettext('days')})
                    </span>
                  )}
                </Label>
              </FormGroup>
            </Fragment>
          )}
          {this.state.errorInfo && <Alert color="danger" className="mt-2">{gettext(this.state.errorInfo)}</Alert>}
          <Button color="primary" className="mt-2" onClick={this.generateDTableInviteLink}>{gettext('Generate')}</Button>
        </Form>
        <div className="dtable-share-link-list-container">
          <div className="h-100" style={{ maxHeight: 'calc(18rem - 1.25rem)' }}>
            <table>
              <thead>
                <tr>
                  <th width="18%">{gettext('Permission')}</th>
                  <th width="38%">{gettext('Invite links')}</th>
                  <th width="26%">{gettext('Expire date')}</th>
                  <th width="6%"/>
                  <th width="12%"/>
                </tr>
              </thead>
              <tbody>
                {
                  this.state.inviteLinks.map((inviteLink, index) => {
                    return (
                      <LinkItem
                        key={inviteLink.token}
                        inviteLink={inviteLink}
                        onCopyInviteLink={this.onCopyInviteLink}
                        onDeleteInviteLinkSubmit={this.onDeleteInviteLinkSubmit}
                        index={index}
                      />
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

GenerateDTableInviteLink.propTypes = propTypes;

export default GenerateDTableInviteLink;
