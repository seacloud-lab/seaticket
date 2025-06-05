import React from 'react';
import PropTypes from 'prop-types';
import LongTextInlineEditor from './inline-editor';
import LongTextDialogEditor from './dialog-editor';

const LongTextEditorNormal = ({ useInlineEditor, ...props }) => {
  if (useInlineEditor) {
    return (<LongTextInlineEditor { ...props } />);
  }
  return (<LongTextDialogEditor { ...props } />);
};

LongTextEditorNormal.propTypes = {
  useInlineEditor: PropTypes.bool,
};

export default LongTextEditorNormal;
