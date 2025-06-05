import React from 'react';
import PropTypes from 'prop-types';
import LongTextEditorPreviewAll from './cell-editor-widgets/long-text-editor-preview-all';

const propTypes = {
  remarkContent: PropTypes.string,
  remarkTip: PropTypes.string,
  className: PropTypes.string,
};

class RemarkItem extends React.Component {
  render() {
    const { remarkContent, remarkTip, className } = this.props;
    return (
      <div className={`${className || ''} form_mode compose-editor remark-editor-content`}>
        <LongTextEditorPreviewAll
          newValue={{ text: remarkContent || remarkTip }}
          isShowEditTextBtn={false}
        />
      </div>
    );
  }
}

RemarkItem.propTypes = propTypes;

export default RemarkItem;
