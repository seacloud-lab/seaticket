import React from 'react';
import PropTypes from 'prop-types';
import Formatter from './formatter';
import Editor from './editor';

import './index.css';

const LongTextInlineEditor = ({ isReadOnly, ...props }) => {
  if (isReadOnly) {
    return (<Formatter { ...props } />);
  }
  return (<Editor { ...props } />);
};

LongTextInlineEditor.propTypes = {
  isReadOnly: PropTypes.bool,
};

export default LongTextInlineEditor;
