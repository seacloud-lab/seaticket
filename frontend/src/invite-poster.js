import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Stage, Layer, Text, Image as KImage, Circle } from 'react-konva';
import { appAvatarURL, mediaUrl, name } from './utils/constants';
import Loading from './components/loading';

import './css/layout.css';
import './css/invite-poster.css';

const { qrcodeSrc } = window.app.pageOptions;

class InvitePoster extends Component {

  constructor(props) {
    super(props);
    this.state = {
      posterWidth: 0,
      posterHeight: 0,
      avatarY: 0,
      textY: 0,
      qrcodeY: 0,
      scale: 1,
      backImg: null,
      avatarImg: null,
      qrcodeImg: null,
      isLoading: true,
    };
  }

  async componentDidMount() {
    const { width, height, textY, avatarY, qrcodeY, scale } = this.getPosterSize();
    const bgImage = {
      name: 'bgImage',
      width: width,
      height: height,
      url: `${mediaUrl}img/poster-background.jpg`
    };
    const avatarImage = {
      name: 'avatarImage',
      width: 50,
      height: 50,
      url: appAvatarURL
    };
    const qrcodeImage = {
      name: 'qrCodeImage',
      width: 60,
      height: 60,
      url: qrcodeSrc
    };

    try {
      const backImg = await this.loadImage(bgImage);
      const avatarImg = await this.loadImage(avatarImage);
      const qrcodeImg = await this.loadImage(qrcodeImage);
      this.setState({
        posterWidth: width,
        posterHeight: height,
        textY,
        avatarY,
        qrcodeY,
        scale,
        backImg,
        avatarImg,
        qrcodeImg,
        isLoading: false,
      });
    } catch (err) {
      this.setState({ isLoading: false });
    }
    window.addEventListener('resize', this.resize.bind(this));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resize);
  }

  getPosterSize = () => {
    const width = document.querySelector('body').offsetWidth;
    const height = document.querySelector('body').offsetHeight;
    let bgImageWidth = width - 2 * 30;
    let bgImageHeight = height - 2 * 30 - 40;
    if (width <= 320) {
      return {
        width: bgImageWidth,
        height: bgImageHeight,
        avatarY: 285,
        textY: 310,
        qrcodeY: 410,
        scale: 0.8
      };
    }

    if (width === 360 && height === 640) { // 兼容大部分 android 手机
      return {
        width: bgImageWidth,
        height: 540,
        avatarY: 330,
        textY: 360,
        qrcodeY: 475,
        scale: 0.9
      };
    }

    if (width <= 375) {
      if (bgImageHeight > 700) {
        return {
          width: 340,
          height: 620,
          avatarY: 390,
          textY: 420,
          qrcodeY: 547,
          scale: 1
        };
      }
      return {
        width: bgImageWidth,
        height: bgImageHeight,
        avatarY: 350,
        textY: 380,
        qrcodeY: 495,
        scale: 1
      };
    }

    if (width < 768) {
      return {
        width: 340,
        height: 620,
        avatarY: 390,
        textY: 420,
        qrcodeY: 547,
        scale: 1
      };
    }

    if (width >= 768) { // pc 端显示
      return {
        width: 340,
        height: 620,
        avatarY: 390,
        textY: 420,
        qrcodeY: 547,
        scale: 1
      };
    }
  };

  loadImage = (imgInfo) => {
    return new Promise((resolve, reject) => {
      const { width, height, url } = imgInfo;
      let img = new Image();
      img.src = url;
      img.width = width;
      img.height = height;
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        reject(imgInfo);
      };
    });
  };

  resize = async () => {
    const { width, height, textY, avatarY, qrcodeY, scale } = this.getPosterSize();
    const bgImage = {
      name: 'bgImage',
      width: width,
      height: height,
      url: `${mediaUrl}img/poster-background.jpg`
    };
    const backImg = await this.loadImage(bgImage);
    this.setState({
      backImg: backImg,
      posterWidth: width,
      posterHeight: height,
      textY,
      avatarY,
      qrcodeY,
      scale
    });
  };

  genPosterImg = (instance) => {
    if (instance) {
      setTimeout(() => {
        // 生成一个透明图片，使得移动端可以长按保存
        let posterImg = new Image();
        posterImg.crossOrigin = 'anonymous';
        posterImg.src = instance.toDataURL({ pixelRatio: 2 });
        posterImg.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;';

        document.body.appendChild(posterImg);
      }, 0);
    }
  };

  render() {
    let { backImg, avatarImg, qrcodeImg, isLoading } = this.state;

    if (isLoading) {
      return (
        <div className="poster-invite">
          <div className="invite-loading">
            <Loading />
          </div>
        </div>
      );
    }

    if (!isLoading && !(backImg && avatarImg && qrcodeImg)) {
      return (
        <div className="poster-invite">
          <div className="invite-loading-error">
            <Loading />
            <div className="text-center">加载出错, 请刷新页面重新获取</div>
          </div>
        </div>
      );
    }

    const { posterWidth, posterHeight, avatarY, textY, qrcodeY, scale } = this.state;
    return (
      <div className='poster-invite'>
        <div className="poster-container">
          <Stage width={posterWidth} height={posterHeight} ref={this.genPosterImg}>
            <Layer scaleY={1.0} scaleX={1.0}>
              <KImage
                x={0}
                y={0}
                width= {backImg.imgWidth}
                height={backImg.imgHeight}
                image={backImg}
              />
              <Circle
                x={42}
                y={avatarY}
                radius={25}
                fillPatternImage={avatarImg}
                fillPatternRepeat={'no-repeat'}
                fillPatternOffsetX={36}
                fillPatternOffsetY={36}
                scaleX={scale}
                scaleY={scale}
              />
              <Text
                x={18}
                y={textY}
                text={name + ' 邀请你'}
                fontSize={18}
                fill={'#72340b'}
                scaleX={scale}
                scaleY={scale}
              />
              <KImage
                x={2}
                y={qrcodeY}
                scaleX={scale}
                scaleY={scale}
                width={qrcodeImg.width}
                height={qrcodeImg.height}
                image={qrcodeImg}
              />
            </Layer>
          </Stage>
        </div>
        <span className="poster-tips">长按保存图片</span>
      </div>
    );
  }
}
const root = createRoot(document.getElementById('wrapper'));
root.render(<InvitePoster />);
