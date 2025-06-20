import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { seaQAAPI } from '../api/web-api';
import { Utils } from '../utils/utils';
import { mediaUrl } from '../constants';

import '../css/slide-captcha.css';


const propTypes = {
  onSuccess: PropTypes.func.isRequired,
};

class SlideCaptcha extends React.Component {

  constructor(props) {
    super(props);
    this.WIDTH = 310;
    this.HEIGHT = 155;
    this.SQUARE = 50;

    this.state = {
      isLoading: true,
      errorMsg: '',
      imgSrc: '',
      srcY: 0,
      isMouseDown: false,
      originX: 0,
      originY: 0,
      moveX: 0,
      moveY: 0,
      trailY: [],
      sliderContainerClassname: 'sliderContainer',
    };
  }

  componentDidMount() {
    this.getRandomImgSrc();
    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('touchmove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
    document.addEventListener('touchend', this.handleDragEnd);
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('touchmove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.removeEventListener('touchend', this.handleDragEnd);
  }

  resetImg = () => {
    this.setState({
      isLoading: true,
      errorMsg: '',
      imgSrc: '',
      srcY: 0,
      isMouseDown: false,
      originX: 0,
      originY: 0,
      moveX: 0,
      moveY: 0,
      trailY: [],
      sliderContainerClassname: 'sliderContainer',
    });
    let { WIDTH, HEIGHT, SQUARE } = this;
    const src = document.getElementById('slide-captcha-src');
    const canvas = document.getElementById('slide-captcha-canvas');
    const block = document.getElementById('slide-captcha-block');
    const srcCtx = src.getContext('2d');
    const canvasCtx = canvas.getContext('2d');
    const blockCtx = block.getContext('2d');
    srcCtx.clearRect(0, 0, WIDTH, HEIGHT + HEIGHT);
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    blockCtx.clearRect(0, 0, SQUARE, HEIGHT);
  };

  getRandomImgSrc = () => {
    this.resetImg();
    seaQAAPI.getSlideCaptcha().then((res) => {
      this.setState({
        imgSrc: 'data:image/jpeg;base64,' + res.data,
        isLoading: false,
      }, () => {
        this.draw();
      });
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      this.setState({
        isLoading: false,
        errorMsg: errorMsg,
      });
    });
  };

  draw = () => {
    let { imgSrc } = this.state;
    let { WIDTH, HEIGHT, SQUARE } = this;
    const src = document.getElementById('slide-captcha-src');
    const canvas = document.getElementById('slide-captcha-canvas');
    const block = document.getElementById('slide-captcha-block');
    const srcCtx = src.getContext('2d');
    const canvasCtx = canvas.getContext('2d');
    const blockCtx = block.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;
    img.onload = () => {
      srcCtx.drawImage(img, 0, 0, img.width, img.height);
      // crop
      let blockImage = srcCtx.getImageData(0, HEIGHT, SQUARE, SQUARE);
      let canvasImage = srcCtx.getImageData(0, 0, WIDTH, HEIGHT);

      // paste
      const srcHeight = img.height;
      const srcY = srcHeight - HEIGHT - SQUARE;
      this.setState({ srcY: srcY });
      canvasCtx.putImageData(canvasImage, 0, 0);
      blockCtx.putImageData(blockImage, 0, srcY);

      // block border
      blockCtx.beginPath();
      blockCtx.moveTo(0, srcY);
      blockCtx.lineTo(0, srcY + SQUARE);
      blockCtx.lineTo(SQUARE, srcY + SQUARE);
      blockCtx.lineTo(SQUARE, srcY);
      blockCtx.lineTo(0, srcY);
      blockCtx.lineWidth = 2;
      blockCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      blockCtx.stroke();
    };
  };

  handleDragStart = (e) => {
    const originX = e.clientX || e.touches[0].clientX;
    const originY = e.clientY || e.touches[0].clientY;
    this.setState({
      isMouseDown: true,
      sliderContainerClassname: 'sliderContainer sliderContainer_active',
      originX: originX,
      originY: originY,
    });
  };

  handleDragMove = (e) => {
    let { originX, originY, trailY, isMouseDown } = this.state;
    let { WIDTH, SQUARE } = this;
    if (!isMouseDown) {
      return;
    }
    e.preventDefault();

    const eventX = e.clientX || e.touches[0].clientX;
    const eventY = e.clientY || e.touches[0].clientY;
    const moveX = eventX - originX;
    const moveY = eventY - originY;
    if (moveX < 0 || moveX + SQUARE >= WIDTH) {
      return;
    }
    trailY.push(moveY);
    this.setState({
      moveX: moveX,
      moveY: moveY,
      trailY: trailY,
    });
  };

  handleDragEnd = (e) => {
    let { originX, trailY } = this.state;
    // check one click
    const eventX = e.clientX || e.changedTouches[0].clientX;
    if (eventX === originX) {
      this.setState({
        isMouseDown: false,
        sliderContainerClassname: 'sliderContainer',
      });
      return;
    }
    // check moveY
    function sum(x, y) { return x + y; }
    function pow(x) { return x * x; }
    const average = trailY.reduce(sum) / trailY.length;
    const deviations = trailY.map(x => x - average);
    const stddev = Math.sqrt(deviations.map(pow).reduce(sum) / trailY.length);
    // if there is no fluctuation on the Y-axis, it may not be operated by human
    if (stddev === 0) {
      this.setState({
        isMouseDown: false,
        sliderContainerClassname: 'sliderContainer sliderContainer_fail',
        originX: 0,
        originY: 0,
        moveX: 0,
        moveY: 0,
      });
      return;
    }
    // check moveX
    this.setState({
      isMouseDown: false,
    }, () => {
      this.verify();
    });
  };

  verify = () => {
    const { moveX, srcY } = this.state;
    seaQAAPI.verifySlideCaptcha(moveX, srcY).then((res) => {
      toaster.success('验证通过');
      this.setState({
        sliderContainerClassname: 'sliderContainer sliderContainer_success',
      }, () => {
        setTimeout(() => {
          this.props.onSuccess();
        }, 1000);
      });
    }).catch(error => {
      toaster.danger('验证失败');
      this.setState({
        sliderContainerClassname: 'sliderContainer sliderContainer_fail',
      }, () => {
        setTimeout(() => {
          this.getRandomImgSrc();
        }, 1000);
      });
    });
  };

  getLoadingStyle = () => {
    return {
      background: `url(${mediaUrl}img/slide-captcha.png) 0 -332px`
    };
  };

  getRefreshStyle = () => {
    return {
      background: `url(${mediaUrl}img/slide-captcha.png) 0 -233px`
    };
  };

  getSlideStyle = () => {
    return {
      background: `url(${mediaUrl}img/slide-captcha.png) 0 -13px`
    };
  };

  render() {
    let { isLoading, moveX, sliderContainerClassname, errorMsg } = this.state;
    let { WIDTH, HEIGHT, SQUARE } = this;
    let sliderContainerPointerEvents = isLoading ? 'none' : '';
    const loadingStyle = this.getLoadingStyle();
    const refreshStyle = this.getRefreshStyle();
    const slideStyle = this.getSlideStyle();
    return (
      <div className='slide-captcha'>
        {isLoading &&
          <div className='loadingContainer' style={{ width: WIDTH + 'px', height: HEIGHT + 'px' }}>
            <div className='loadingIcon' style={loadingStyle}></div>
            <span>{'加载中...'}</span>
          </div>
        }
        {errorMsg && <p className="error text-center">{errorMsg}</p>}

        <canvas id='slide-captcha-src' style={{ display: 'none' }} width={WIDTH} height={HEIGHT + HEIGHT}></canvas>
        <canvas id='slide-captcha-canvas' width={WIDTH} height={HEIGHT}></canvas>
        <div className='refreshIcon' style={refreshStyle} onClick={this.getRandomImgSrc}></div>
        <canvas
          id='slide-captcha-block'
          className='block'
          style={{ left: moveX + 'px' }}
          width={SQUARE}
          height={HEIGHT}
          onMouseDown={this.handleDragStart}
          onTouchStart={this.handleDragStart}
        >
        </canvas>

        <div
          className={sliderContainerClassname}
          style={{ width: WIDTH + 'px', pointerEvents: sliderContainerPointerEvents }}
        >
          <div className='sliderMask' style={{ width: moveX + 'px' }}>
            <div
              className='slider'
              style={{ left: moveX + 'px' }}
              onMouseDown={this.handleDragStart}
              onTouchStart={this.handleDragStart}
            >
              <span className='sliderIcon' style={slideStyle}></span>
            </div>
          </div>
          <span className='sliderText'>{'向右滑动填充拼图'}</span>
        </div>
      </div>
    );
  }
}

SlideCaptcha.propTypes = propTypes;

export default SlideCaptcha;
