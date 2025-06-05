import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { MarkdownPreview } from '@seafile/seafile-editor';

class LongTextWidget extends PureComponent {

  render() {
    const { className, value } = this.props;
    if (!value) return null;
    const validValue = typeof value === 'object' ? value.text : value;
    return (
      <div className={`long-text-widget-display ${className}`}>
        <MarkdownPreview value={validValue} isShowOutline={false} />
      </div>
    );
  }
}

LongTextWidget.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  className: PropTypes.string,
};

export default LongTextWidget;
