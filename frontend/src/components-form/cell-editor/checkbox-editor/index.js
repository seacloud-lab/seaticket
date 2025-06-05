import React, { forwardRef } from 'react';
import MediaQuery from 'react-responsive';
import classnames from 'classnames';
import { Utils } from '../../../utils/utils';
import Icon from '../../../components/icon-universal';
import { DEFAULT_MARKER_STYLE } from '../../../constants/dtable-icon';

import './index.css';

const gettext = window.gettext;

function FormCheckboxEditor({ isReadOnly, isSubmitting, value, column, onCommit, isEditorShow, updateTabIndex, isRequired }, ref) {

  const onKeyDown = (event) => {
    if (event.keyCode === Utils.keyCodes.enter && !isReadOnly) {
      if (isSubmitting) return;
      event.preventDefault();
      event.stopPropagation();
      onCommit({ [column.key]: !value });
    }
  };

  const onChangeCheckboxValue = (e) => {
    e.stopPropagation();
    if (isReadOnly || isSubmitting) return;
    onCommit({ [column.key]: !value });
    updateTabIndex && updateTabIndex();
  };

  const checkboxStyle = column.data?.checkbox_style || DEFAULT_MARKER_STYLE;

  return (
    <>
      <MediaQuery query="(min-width: 767.8px)">
        <div
          className="form-checkbox-editor-container"
        >
          <div
            className={classnames(
              'grid-checkbox-row-checkbox',
              'checkbox-editor-selected-checkbox',
              {
                'read-only': isReadOnly,
                'focus': isEditorShow,
                'cursor': !isReadOnly ? 'pointer' : 'default'

              }
            )}
            ref={ref}
            onClick={onChangeCheckboxValue}
            onKeyDown={onKeyDown}
            tabIndex={0}
            aria-label={ isRequired ? gettext('Required') : ''}
          >
            {value && <Icon
              symbol={checkboxStyle.type}
              color={checkboxStyle.color}
              className='checkbox-svg grid-checkbox-check-mark'
            />}
          </div>
        </div>
      </MediaQuery>
      <MediaQuery query="(max-width: 767.8px)">
        <div
          className="form-checkbox-editor-container"
        >
          <div
            className={classnames(
              'grid-checkbox-row-checkbox',
              'checkbox-editor-selected-checkbox',
              {
                'read-only': isReadOnly,
                'focus': isEditorShow
              }
            )}
            onTouchStart={onChangeCheckboxValue}
            tabIndex={0}
            aria-label={ isRequired ? gettext('Required') : ''}
          >
            {value && <Icon
              symbol={checkboxStyle.type}
              color={checkboxStyle.color}
              className='checkbox-svg grid-checkbox-check-mark'
            />}
          </div>
        </div>
      </MediaQuery>
    </>
  );

}

const CheckboxEditor = forwardRef(FormCheckboxEditor);
export default CheckboxEditor;
