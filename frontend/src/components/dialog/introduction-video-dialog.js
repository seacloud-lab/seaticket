import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { Modal, ModalBody, Button } from 'reactstrap';
import { gettext } from '../../utils/constants';
import VideoPlayer from '../video-player';
import '../../css/introduction-video-dialog.css';

const propTypes = {
  toggle: PropTypes.func.isRequired,
};

class IntroductionVideoDialog extends Component {

  renderText = () => {
    const isZhcn = window.app.pageOptions.langCode === 'zh-cn';
    const text1 = isZhcn ? 'SeaTable 是一款新一代的在线协同表格和信息管理工具。' : gettext('With SeaTable, you have ALL your data in one place.');
    const text2 = isZhcn ? '本视频介绍 SeaTable 基本使用。' : gettext('Organize, share, collaborate – we show you how.');
    return (
      <>
        <p>{text1}</p>
        <p>{text2}</p>
      </>
    );
  };

  renderMobile = () => {
    const videoJsOptions = {
      width: (window.innerWidth - 32), // padding 32
      height: 'auto',
      autoplay: false,
      controls: true,
      preload: 'auto',
      sources: [{
        src: window.app.pageOptions.introductionVideoLink,
        type: 'video/mp4',
      }]
    };
    return (
      <Modal isOpen={true} toggle={this.props.toggle} className="introduction-video introduction-video-mobile">
        <h3>{gettext('Welcome to SeaTable')}</h3>
        <div className="introduction-video-container">
          <VideoPlayer { ...videoJsOptions } />
        </div>
        <ModalBody>
          {this.renderText()}
          <Button className="introduction-video-btn" color="primary" size="lg" block onClick={this.props.toggle}>
            {gettext('Start now')}
          </Button>
        </ModalBody>
      </Modal>
    );
  };

  renderPC = () => {
    const videoJsOptions = {
      width: '798px',
      height: 'auto',
      autoplay: false,
      controls: true,
      preload: 'auto',
      sources: [{
        src: window.app.pageOptions.introductionVideoLink,
        type: 'video/mp4',
      }]
    };
    return (
      <Modal isOpen={true} toggle={this.props.toggle} className="introduction-video" size="lg">
        <VideoPlayer { ...videoJsOptions } />
        <ModalBody>
          <h3>{gettext('Welcome to SeaTable')}</h3>
          {this.renderText()}
          <p className="introduction-video-jump" onClick={this.props.toggle}>{gettext('Skip now')}</p>
        </ModalBody>
      </Modal>
    );
  };

  render() {
    return (
      <>
        <MediaQuery query="(max-width: 767.8px)">
          {this.renderMobile()}
        </MediaQuery>
        <MediaQuery query="(min-width: 767.8px)">
          {this.renderPC()}
        </MediaQuery>
      </>
    );
  }
}

IntroductionVideoDialog.propTypes = propTypes;

export default IntroductionVideoDialog;
