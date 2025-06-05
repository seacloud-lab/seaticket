import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Form, FormGroup, Input, Label, InputGroup, Button, Alert, FormText, Tooltip } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { toaster, DTableRadio } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import Loading from '../../../components/loading';
import { gettext, shareLinkPasswordMinLength, shareLinkExpireDaysMax, shareLinkExpireDaysMin,
  shareLinkExpireDaysDefault } from '../../../utils/constants';


const LinkItemPropTypes = {
  externalLink: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  deleteExternalLink: PropTypes.func.isRequired,
  onCopyExternalLink: PropTypes.func.isRequired,
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

  onMouseEnter = () => {
    this.setState({ isShowOperation: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowOperation: false });
  };

  onDeleteInviteLinkSubmit = () => {
    let { externalLink } = this.props;
    this.props.deleteExternalLink(externalLink); // todo: implement it
  };

  cutLink = (link) => {
    let length = link.length;
    return link.slice(0, 10) + '...' + link.slice(length - 13);
  };

  onCopyExternalLink = () => {
    let externalLink = this.props.externalLink;
    this.props.onCopyExternalLink(externalLink.url);
  };

  getEmbedLink = () => {
    let URL = this.props.externalLink.url;
    let embedLink = URL.replace('/external-links/', '/embed/');
    return embedLink;
  };

  render() {
    let { externalLink } = this.props;
    let { isShowOperation, isShowLinkTip } = this.state;
    let embedClass = externalLink.is_custom === true ? 'd-none' : '';
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td id={`external-link-url-${externalLink.token}`}>{this.cutLink(externalLink.url)}</td>
        <Tooltip
          isOpen={isShowLinkTip}
          target={`external-link-url-${externalLink.token}`}
          placement='bottom'
          toggle={() => this.setState({ isShowLinkTip: !isShowLinkTip })}
          modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
        >
          {externalLink.url}
        </Tooltip>
        <td>{externalLink.expire_date ? dayjs(externalLink.expire_date).format('YYYY-MM-DD HH:mm') : '-'}</td>
        <td>
          <a href={this.getEmbedLink()} target="_blank" rel='noreferrer noopener' className={embedClass}>
            <span
              className={`dtable-font dtable-icon-api action-icon ${isShowOperation ? '' : 'hide'}`}
              title={gettext('Embed')}
              aria-label={gettext('Embed')}
            />
          </a>
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-copy-link action-icon ${isShowOperation ? '' : 'hide'}`}
            data-placement="bottom"
            onClick={this.onCopyExternalLink}
            title={gettext('Copy link')}
            aria-label={gettext('Copy link')}
          />
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ${isShowOperation ? '' : 'hide'}`}
            onClick={this.onDeleteInviteLinkSubmit}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

LinkItem.propTypes = LinkItemPropTypes;


const propTypes = {
  workspaceID: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
};

class GenerateDTableExternalLink extends React.Component {

  constructor(props) {
    super(props);

    this.isExpireDaysNoLimit = (parseInt(shareLinkExpireDaysMin) === 0 && parseInt(shareLinkExpireDaysMax) === 0 && shareLinkExpireDaysDefault === 0);
    this.defaultExpireDays = this.isExpireDaysNoLimit ? '' : shareLinkExpireDaysDefault;

    this.state = {
      externalLinks: [],
      isLoadingExternalLink: true,
      isConfirmDeleteShow: false,

      isShowPasswordInput: false,
      isPasswordVisible: false,
      password: '',
      passwdnew: '',
      isExpireChecked: false,
      expireDays: this.defaultExpireDays,
      errorInfo: '',
      isCustomTokenInputShow: false,
      customToken: '',
    };
  }

  componentDidMount() {
    let { workspaceID, name } = this.props;
    dtableWebAPI.getDTableExternalLink(workspaceID, name).then(res => {
      let externalLinks = res.data.links;
      this.setState({ externalLinks: externalLinks });
      if (externalLinks.length > 0) {
        this.setState({
          externalLink: externalLinks[0],
          isLoadingExternalLink: false
        });
      } else {
        this.setState({
          externalLink: null,
          isLoadingExternalLink: false,
        });
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  validParams = () => {
    let { isShowPasswordInput, password, passwdnew, isExpireChecked, expireDays } = this.state;
    // validate password
    if (isShowPasswordInput) {
      if (password.length === 0) {
        this.setState({ errorInfo: gettext('Please enter password') });
        return false;
      }
      if (password.length < shareLinkPasswordMinLength) {
        this.setState({ errorInfo: gettext('Password is too short') });
        return false;
      }
      if (password !== passwdnew) {
        this.setState({ errorInfo: gettext('Passwords don\'t match') });
        return false;
      }
    }

    // validate days
    // no limit
    let reg = /^\d+$/;
    if (this.isExpireDaysNoLimit) {
      if (isExpireChecked) {
        if (!expireDays) {
          this.setState({ errorInfo: gettext('Please enter days') });
          return false;
        }
        if (expireDays > MAX_EXPIRE_DAYS) {
          this.setState({ errorInfo: gettext('Expire days is too long') });
          return false;
        }
        if (!reg.test(expireDays)) {
          this.setState({ errorInfo: gettext('Please enter a non-negative integer') });
          return false;
        }
        this.setState({ expireDays: parseInt(expireDays) });
      }
    } else {
      if (!expireDays) {
        this.setState({ errorInfo: gettext('Please enter days') });
        return false;
      }
      if (expireDays > MAX_EXPIRE_DAYS) {
        this.setState({ errorInfo: gettext('Expire days is too long') });
        return false;
      }
      if (!reg.test(expireDays)) {
        this.setState({ errorInfo: gettext('Please enter a non-negative integer') });
        return false;
      }

      expireDays = parseInt(expireDays);
      let minDays = parseInt(shareLinkExpireDaysMin);
      let maxDays = parseInt(shareLinkExpireDaysMax);

      if (minDays !== 0 && minDays !== maxDays) {
        if (expireDays < minDays) {
          this.setState({ errorInfo: gettext('Please enter valid days') });
          return false;
        }
      }

      if (minDays === 0 && maxDays !== 0 ) {
        if (expireDays > maxDays) {
          this.setState({ errorInfo: gettext('Please enter valid days') });
          return false;
        }
      }

      if (minDays !== 0 && maxDays !== 0) {
        if (expireDays < minDays || expireDays > maxDays) {
          this.setState({ errorInfo: gettext('Please enter valid days') });
          return false;
        }
      }
      this.setState({ expireDays: expireDays });
    }

    if (this.isCustomTokenInputShow) {
      let { customToken } = this.state;
      customToken = customToken.trim();
      if (customToken.length > 100) {
        this.setState({ errorInfo: gettext('URL is too long.') });
        return false;
      }
      if (!customToken.trim()) {
        this.setState({ errorInfo: gettext('Please input custom URL.') });
      }
      if (customToken.search(/^[-0-9a-zA-Z]+$/) === -1) {
        this.setState({ errorInfo: gettext('URL can only contain alphanumeric characters or single hyphens.') });
        return false;
      } else {
        this.setState({ customToken: customToken.trim() });
      }
    }

    return true;
  };

  generateExternalLink = () => {
    let isValid = this.validParams();
    if (!isValid) {
      return;
    }
    let { workspaceID, name } = this.props;
    let { isCustomTokenInputShow, isShowPasswordInput, isExpireChecked } = this.state;
    let customToken; let password; let expireDays;
    if (isCustomTokenInputShow) {
      customToken = this.state.customToken;
    }
    if (isShowPasswordInput) {
      password = this.state.password;
    }
    if (isExpireChecked || !this.isExpireDaysNoLimit) {
      expireDays = this.state.expireDays;
    }
    dtableWebAPI.createDTableExternalLink(workspaceID, name, customToken, password, expireDays).then(res => {
      let externalLink = res.data;
      let externalLinks = this.state.externalLinks.slice();
      externalLinks.push(externalLink);
      this.setState({
        externalLinks: externalLinks,
        isCustomTokenInputShow: false,
        customToken: '',
        errorInfo: ''
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteExternalLink = (externalLink) => {
    let { workspaceID, name } = this.props;
    dtableWebAPI.deleteDTableExternalLink(workspaceID, name, externalLink.token).then(() => {
      let { externalLinks } = this.state;
      externalLinks = externalLinks.filter((item) => {
        return item.token !== externalLink.token;
      });
      this.setState({
        externalLinks: externalLinks,
        isConfirmDeleteShow: false
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onCopyExternalLink = (url) => {
    copy(url);
    toaster.success(gettext('External link is copied to the clipboard.'));
  };

  onCustomTokenInputChecked = () => {
    this.setState({
      isCustomTokenInputShow: !this.state.isCustomTokenInputShow
    }, () => {
      if (!this.state.isCustomTokenInputShow) {
        this.setState({ customToken: '' });
      }
    });
  };

  onCustomTokenInputChange = (e) => {
    let customToken = e.target.value.trim();
    this.setState({ customToken: customToken });
  };

  onPasswordInputChecked = () => {
    this.setState({ isShowPasswordInput: !this.state.isShowPasswordInput });
  };

  inputPassword = (e) => {
    let password = e.target.value.trim();
    this.setState({ password: password });
  };

  inputPasswordNew = (e) => {
    let passwdnew = e.target.value.trim();
    this.setState({ passwdnew: passwdnew });
  };

  togglePasswordVisible = () => {
    this.setState({ isPasswordVisible: !this.state.isPasswordVisible });
  };

  generatePassword = () => {
    let val = Utils.generatePassword(shareLinkPasswordMinLength);
    this.setState({
      password: val,
      passwdnew: val
    });
  };

  onExpireChecked = () => {
    this.setState({ isExpireChecked: !this.state.isExpireChecked });
  };

  onExpireDaysChanged = (e) => {
    let day = e.target.value.trim();
    this.setState({ expireDays: day });
  };

  setURLType = (type) => {
    this.setState({ isCustomTokenInputShow: type === 'custom' });
  };

  render() {

    let { externalLinks, isLoadingExternalLink, isCustomTokenInputShow, customToken } = this.state;
    if (isLoadingExternalLink) {
      return <Loading />;
    }

    let passwordLengthTip = gettext('(at least {passwordLength} characters)');
    passwordLengthTip = passwordLengthTip.replace('{passwordLength}', shareLinkPasswordMinLength);

    return (
      <div className="external-link-container">
        <Fragment>
          <p className="external-link-tip">{gettext('An external link for a base is a public link that grants read-only access to a base. An external link can also be used to embed a base in a webpage.')}</p>
          <Form className="mb-4">
            <FormGroup check>
              <Label check className="position-relative">
                <Input type="checkbox" onChange={this.onPasswordInputChecked}/>{'  '}{gettext('Add password protection')}
              </Label>
            </FormGroup>
            {this.state.isShowPasswordInput &&
              <FormGroup className="link-operation-content" check>
                <Label>{gettext('Password')}</Label>{' '}<span className="tip">{passwordLengthTip}</span>
                <InputGroup className="passwd">
                  <Input type={this.state.isPasswordVisible ? 'text' : 'password'} value={this.state.password || ''} onChange={this.inputPassword}/>
                  <Button onClick={this.togglePasswordVisible}><i className={`link-operation-icon fas ${this.state.isPasswordVisible ? 'dtable-font dtable-icon-eye' : 'dtable-font dtable-icon-eye-slash'}`}></i></Button>
                  <Button onClick={this.generatePassword}><i className="dtable-font dtable-icon-random-generation"></i></Button>
                </InputGroup>
                <Label>{gettext('Password again')}</Label>
                <Input className="passwd" type={this.state.isPasswordVisible ? 'text' : 'password'} value={this.state.passwdnew || ''} onChange={this.inputPasswordNew} />
              </FormGroup>
            }

            {this.isExpireDaysNoLimit && (
              <Fragment>
                <FormGroup check>
                  <Label check className="position-relative">
                    <Input className="expire-checkbox" type="checkbox" onChange={this.onExpireChecked} />{'  '}{gettext('Add auto expiration')}
                  </Label>
                </FormGroup>
                {this.state.isExpireChecked &&
                  <FormGroup check>
                    <Label check className='position-relative'>
                      <Input className="expire-input expire-input-border" type="text" value={this.state.expireDays} onChange={this.onExpireDaysChanged} readOnly={!this.state.isExpireChecked} />
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
                    <Input
                      className="expire-checkbox"
                      type="checkbox"
                      onChange={this.onExpireChecked}
                      checked
                      readOnly
                      disabled
                    />
                    {'  '}{gettext('Add auto expiration')}
                  </Label>
                </FormGroup>
                <FormGroup check>
                  <Label check className='position-relative'>
                    <Input
                      className="expire-input expire-input-border"
                      type="text"
                      value={this.state.expireDays}
                      onChange={this.onExpireDaysChanged}
                    />
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
            <FormGroup check>
              <Label check className="position-relative">
                <span>{gettext('URL')}</span>
              </Label>
            </FormGroup>
            <FormGroup check className='url-type'>
              <DTableRadio
                isChecked={!this.state.isCustomTokenInputShow}
                onCheckedChange={this.setURLType.bind(this, 'random')}
                label={gettext('Random URL')}
              />
            </FormGroup>
            <FormGroup check className='url-type'>
              <DTableRadio
                isChecked={this.state.isCustomTokenInputShow}
                onCheckedChange={this.setURLType.bind(this, 'custom')}
                label={gettext('Custom URL')}
              />
            </FormGroup>
            {isCustomTokenInputShow &&
              <FormGroup className="custom-url">
                <FormText className="mb-2">{gettext('URL can only contain alphanumeric characters or single hyphens.')}</FormText>
                <Input className="custom-token" value={customToken} onChange={this.onCustomTokenInputChange}/>
              </FormGroup>
            }
          </Form>
          {this.state.errorInfo && <Alert color="danger" className="mt-2">{this.state.errorInfo}</Alert>}
          <button className="btn btn-primary" onClick={this.generateExternalLink}>{gettext('Generate')}</button>
        </Fragment>

        <div className="dtable-share-link-list-container">
          <div className="h-100" style={{ maxHeight: 'calc(18rem - 1.25rem)' }}>
            <table>
              <thead>
                <tr>
                  <th width="45%">{gettext('External links')}</th>
                  <th width="40%">{gettext('Expire date')}</th>
                  <th width="5%"></th>
                  <th width="5%"></th>
                  <th width="5%"></th>
                </tr>
              </thead>
              <tbody>
                {externalLinks.map((item, index) => {
                  return (
                    <LinkItem
                      key={index}
                      index={index}
                      externalLink={item}
                      deleteExternalLink={this.deleteExternalLink}
                      onCopyExternalLink={this.onCopyExternalLink}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

GenerateDTableExternalLink.propTypes = propTypes;

export default GenerateDTableExternalLink;
