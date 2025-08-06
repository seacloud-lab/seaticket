import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { CustomizeMarkdownViewer } from '../../../../../../components';

import './index.css';

const propTypes = {
  className: PropTypes.string,
  value: PropTypes.object,
  formatterStyle: PropTypes.object,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
};

class Preview extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      height: 450,
      opacity: 0,
    };
  }

  componentDidMount() {
    setTimeout(() => {
      if (!this.ref) return;
      const { value } = this.props;

      // If image is included, sets the preview height to the maximum height
      const hasImage = value?.images?.length >= 2 ? true : false;
      let { height: domHeight } = this.ref.getBoundingClientRect();
      domHeight = hasImage ? 450 : domHeight;
      this.setState({
        height: Math.min(domHeight, 450),
        opacity: 1,
      });
    }, 10);
  }

  getStyle = () => {
    let { formatterStyle } = this.props;
    let { left, top } = formatterStyle;
    const { height, opacity } = this.state;
    const width = 520;
    const padding = 6;
    left = left - width > 0 ? left - width - 12 : 0;
    top = top - padding;
    if (top + height > window.innerHeight) {
      top = top - height > 0 ? top - height : 0;
    }
    return { left, top, opacity };
  };

  onMouseEnter = (e) => {
    this.props.onMouseEnter && this.props.onMouseEnter(e);
  };

  onMouseLeave = (e) => {
    this.props.onMouseLeave && this.props.onMouseLeave(e);
  };

  render() {
    const { className, value } = this.props;
    return (
      <div
        className={classnames('long-text-preview-popover', className)}
        style={this.getStyle()}
        ref={ref => this.ref = ref}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="long-text-container long-text-container-scroll">
          <CustomizeMarkdownViewer value={value ? value.text : ''} showTOC={false} />
        </div>
      </div>
    );
  }
}

Preview.propTypes = propTypes;

export default Preview;
