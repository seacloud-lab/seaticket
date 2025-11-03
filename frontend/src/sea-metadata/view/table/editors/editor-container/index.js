import React from 'react';
import PropTypes from 'prop-types';
import NormalEditorContainer from './normal-editor-container';
import PopupEditorContainer from './popup-editor-container';
import PreviewEditorContainer from './preview-editor-container';
import { checkIsColumnSupportPreview, checkIsPopupColumnEditor } from '../../../../utils/column';
import { EDITOR_TYPE, CellType } from '../../../../constants';

const POPUP_EDITOR_COLUMN_TYPES = [
  CellType.DATE,
  CellType.COLLABORATOR,
  CellType.SINGLE_SELECT,
  CellType.TYPE,
  CellType.MULTIPLE_SELECT,
  CellType.LONG_TEXT,
  CellType.TAGS,
  CellType.PRIORITY,
];

const EditorContainer = (props) => {
  const { column, openEditorMode } = props;
  if (!column) return null;

  if (checkIsPopupColumnEditor(column) || POPUP_EDITOR_COLUMN_TYPES.includes(column.type)) {
    return <PopupEditorContainer { ...props } />;
  }
  if (checkIsColumnSupportPreview(column) && openEditorMode === EDITOR_TYPE.PREVIEWER) {
    return <PreviewEditorContainer { ...props } />;
  }
  return <NormalEditorContainer { ...props } />;
};

EditorContainer.propTypes = {
  column: PropTypes.object,
  openEditorMode: PropTypes.string,
};

export default EditorContainer;
