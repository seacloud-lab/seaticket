import React from 'react';
import PropTypes from 'prop-types';
import { mediaUrl } from '../utils/constants';
import '../pages/dtable-share-form/css/end-remark.css';

const gettext = window.gettext;

const checkMissHttpURLReg = /^((https|http|ftp|rtsp|mms):\/\/)/;

const propTypes = {
  successMessage: PropTypes.string,
  successRedirect: PropTypes.string,
  onContinueSubmit: PropTypes.func,
};

class EndRemark extends React.Component {

  constructor(props) {
    super(props);
    this.successRedirectTimer = null;
  }

  componentDidMount() {
    let { successRedirect } = this.props;
    if (!successRedirect) return;
    if (!checkMissHttpURLReg.test(successRedirect)) {
      successRedirect = 'https://' + successRedirect;
    }
    this.successRedirect(successRedirect);
  }

  successRedirect = (redirectURL) => {
    this.successRedirectTimer = setTimeout(() => {
      location.href = redirectURL;
    }, 3000);
  };

  onContinueSubmit = () => {
    if (this.successRedirectTimer) {
      clearTimeout(this.successRedirectTimer);
      this.successRedirectTimer = null;
    }
    this.props.onContinueSubmit();
  };

  getTip = () => {
    let { successRedirect } = this.props;
    if (!successRedirect) return '';
    let tip = gettext('You are being redirected to {redirect_url}.');
    return tip.replace('{redirect_url}', decodeURIComponent(successRedirect));
  };

  render() {
    const { successMessage } = this.props;
    const tip = this.getTip();
    return (
      <div className="form-share-end-remark-container">
        <img src={`${mediaUrl}img/submit-success.png`} alt="" width="100" height="100" className="submit-success-icon" />
        <div className="form-share-end-remark-content">{successMessage || gettext('Thank you for submitting the form!')}</div>
        {tip && (<div className="form-share-end-remark-tip">{tip}</div>)}
        {(window.app.config && window.app.config.lang === 'zh-cn') && (
          <div className="form-share-continue">
            <button className="btn btn-primary" onClick={this.onContinueSubmit}>{'再填一份'}</button>
          </div>
        )}
      </div>
    );
  }
}

EndRemark.propTypes = propTypes;

export default EndRemark;
