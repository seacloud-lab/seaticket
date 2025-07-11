import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { getPreviewContent } from '@seafile/seafile-editor';
import Preview from './preview';
import { Icon, ModalPortal } from '../../../../../../components';

import './index.css';

class LongTextFormatter extends React.Component {

  static defaultProps = {
    value: {
      text: '',
      images: [],
      links: [],
      preview: '',
    },
  };

  constructor(props) {
    super(props);
    this.formatterStyle = null;
    this.state = {
      isPreview: false
    };
  }

  componentWillUnmount() {
    this.clearOpenPreviewTimer();
    this.clearClosePreviewTimer();
  }

  renderLinks = (value) => {
    const links = value.links;
    if (!Array.isArray(links) || links.length === 0) return null;
    return (
      <span className="links-container">
        <Icon symbol="url" />
        {links.length}
      </span>
    );
  };

  renderCheckList = (value) => {
    const checkList = value.checklist;
    if (!checkList || checkList.total === 0) return null;
    return (
      <span className="check-list-container">
        <Icon symbol="check-square-solid" className={checkList.completed === checkList.total ? 'check-list-completed' : ''} />
        {`${checkList.completed}/${checkList.total}`}
      </span>
    );
  };

  renderImages = (value) => {
    const images = value.images;
    if (!Array.isArray(images) || images.length === 0) return null;
    return (
      <span className="images-container">
        <img src={images[0]} alt=""/>
        <i className="image-number">{images.length > 1 ? '+' + images.length : null}</i>
      </span>
    );
  };

  renderContent = (value) => {
    return (<span className="preview-text-content">{value.preview}</span>);
  };

  translateValue = () => {
    const { value } = this.props;
    if (!value) return {};
    const valueType = Object.prototype.toString.call(value);
    if (valueType === '[object String]') {
      const isMarkdown = true;
      const previewTextNeedSlice = false;
      const { previewText, images, links, checklist } = getPreviewContent(value, isMarkdown, previewTextNeedSlice);
      const newValue = Object.assign({}, { text: value, preview: previewText.slice(0, 200), images, links, checklist });
      return newValue;
    }
    if (valueType === '[object Object]') {
      return value;
    }
    return {};
  };

  clearOpenPreviewTimer = () => {
    if (!this.openPreviewTimer) return;
    clearTimeout(this.openPreviewTimer);
    this.openPreviewTimer = null;
  };

  clearClosePreviewTimer = () => {
    if (!this.closePreviewTimer) return;
    clearTimeout(this.closePreviewTimer);
    this.closePreviewTimer = null;
  };

  onMouseEnter = () => {

    // in case that there is no `modal-wrapper`
    if (!document.getElementById('modal-wrapper')) return;

    this.clearOpenPreviewTimer();
    if (this.props.value) {
      this.openPreviewTimer = setTimeout(() => {
        const style = this.ref.getBoundingClientRect();
        this.formatterStyle = style;
        this.setState({ isPreview: true });
      }, 2000);
    }
  };

  onMouseLeave = () => {
    this.clearOpenPreviewTimer();

    // Case 1: The mouse moves out of the cell and is not in the preview component, close the preview component after 2S
    this.closePreviewTimer = setTimeout(() => {
      if (this.state.isPreview) {
        this.setState({ isPreview: false });
      }
    }, 2000);
  };

  // Case 2: The mouse moves out of the cell and into the preview component, do not close the preview component
  onPreviewMouseEnter = () => {
    this.clearClosePreviewTimer();
  };

  // Case 2: The mouse move out of the preview component, close the preview component
  onPreviewMouseLeave = () => {
    if (this.state.isPreview) {
      this.setState({ isPreview: false });
    }
  };

  render() {
    const { isPreview } = this.state;
    const { className, previewClassName } = this.props;
    const value = this.translateValue();
    return (
      <div
        className={classnames('long-text-formatter', className)}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        ref={ref => this.ref = ref}
      >
        {this.renderLinks(value)}
        {this.renderCheckList(value)}
        {this.renderImages(value)}
        {this.renderContent(value)}
        {isPreview &&
          <ModalPortal>
            <Preview
              className={previewClassName}
              value={value}
              formatterStyle={this.formatterStyle}
              onMouseEnter={this.onPreviewMouseEnter}
              onMouseLeave={this.onPreviewMouseLeave}
            />
          </ModalPortal>
        }
      </div>
    );
  }
}

LongTextFormatter.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  className: PropTypes.string,
  previewClassName: PropTypes.string,
};

export default LongTextFormatter;
