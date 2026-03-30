import React from 'react';
import PropTypes from 'prop-types';
import DateEditor from './date-editor';
import TextEditor from './text-editor';
import NumberEditor from './number-editor';
import SingleSelectEditor from './single-select-editor';
import MultipleSelectEditor from './multiple-select-editor';
import CollaboratorEditor from './collaborator-editor';
import LongTextEditor from './long-text-editor';
import TagsEditor from './tags-editor';
import TypeEditor from './type-editor';
import { CellType } from '../../constants';

// eslint-disable-next-line react/display-name
const Editor = React.forwardRef((props, ref) => {

  switch (props.column.type) {
    case CellType.TEXT: {
      return (<TextEditor ref={ref} { ...props } />);
    }
    case CellType.DATE: {
      return (<DateEditor ref={ref} { ...props } />);
    }
    case CellType.NUMBER: {
      return (<NumberEditor ref={ref} {...props} />);
    }
    case CellType.SINGLE_SELECT: {
      return (<SingleSelectEditor ref={ref} { ...props} />);
    }
    case CellType.MULTIPLE_SELECT: {
      return (<MultipleSelectEditor ref={ref} { ...props } />);
    }
    case CellType.COLLABORATOR: {
      return (<CollaboratorEditor ref={ref} { ...props } />);
    }
    case CellType.LONG_TEXT: {
      return (<LongTextEditor ref={ref} { ...props } />);
    }
    case CellType.TYPE: {
      return (<TypeEditor ref={ref} { ...props} />);
    }
    case CellType.TAGS: {
      return (<TagsEditor ref={ref} { ...props } />);
    }
    default: {
      return null;
    }
  }
});

Editor.propTypes = {
  column: PropTypes.object.isRequired,
};

export default Editor;
