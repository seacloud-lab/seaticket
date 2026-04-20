import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, CustomizePopover, CustomizeLabel, IconButton } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isL } from '@/utils/hotkey';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import { isDarkColor } from '@/utils/color-utils';

import '@/project/main-panel/tickets/components/ticket-settings/type-settings/index.css';

const LabelsSettings = ({
  id,
  isReadonly,
  column,
  value: propsValue,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);

  const options = useMemo(() => {
    return getColumnOptions(column).map(o => {
      if (o.text_color) return { ...o, value: o.id };
      return { ...o, value: o.id, text_color: isDarkColor(o.color) ? '#FFF' : '#212529' };
    });
  }, [column]);

  const value = useMemo(() => {
    if (!Array.isArray(propsValue) || propsValue.length === 0) return [];
    return propsValue.map(v => getOption(options, v)).filter(Boolean).map(o => o.id);
  }, [propsValue, options]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly || isSubmitting) return;
    setIsShowEditor(true);
  }, [isReadonly, isSubmitting]);

  const handleChange = useCallback((labels) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onChange && onChange({ labels }, () => {
      setIsSubmitting(false);
    });
  }, [isSubmitting, onChange]);

  const closeEditor = useCallback(() => {
    let newValue = optionEditorContainerRef.current.getValue();
    if (isCellValueChanged(value, newValue)) {
      if (newValue.length > 0) {
        newValue = newValue.map(v => getOption(options, v)).filter(Boolean);
        newValue = newValue.map(o => o.name);
      }
      handleChange(newValue);
    }
    setIsShowEditor(false);
  }, [options, value, handleChange]);

  const handleRemove = useCallback((event, optionId) => {
    if (isShowEditor || isSubmitting) return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    let newValue = value.filter(i => i !== optionId);
    if (newValue.length > 0) {
      newValue = newValue.map(v => getOption(options, v)).filter(Boolean);
      newValue = newValue.map(o => o.name);
    }
    handleChange(newValue);
  }, [isShowEditor, isSubmitting, value, options, handleChange]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover(id)) return;

    if (isL(event)) {
      openEditor(event);
    } else if (isEsc(event)) {
      closeEditor();
    }
  }, [id, openEditor, closeEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  const labels = Array.isArray(value) && value.length > 0 ? value.map(optionId => getOption(options, optionId)).filter(Boolean) : [];

  return (
    <>
      <div className={classnames('sea-ticket-settings-item mb-4', className)}>
        <CustomizeLabel icon="multiple-select">
          {gettext('Labels')}
        </CustomizeLabel>
        <div
          className={classnames('tags-formatter', { 'valid': labels.length > 0, 'cursor-pointer': !isReadonly })}
          onClick={openEditor}
          ref={editorRef}
        >
          {labels.length > 0 ? (
            <>
              {labels.map(label => {
                return (
                  <Option option={label} key={label.id} className="sea-metadata-multiple-select-editor-option">
                    {!isReadonly && (
                      <IconButton
                        icon="close"
                        onClick={(event) => handleRemove(event, label.id)}
                        className={classnames('sea-metadata-select-remove-btn no-hover-bg', { 'cursor-pointer': !isSubmitting })}
                        size={{ btn: 14, icon: 10 }}
                        style={{ margin: '0 -2px 0 2px' }}
                        iconStyle={{ color: label.text_color }}
                      />
                    )}
                  </Option>
                );
              })}
            </>
          ) : (
            <div className="tip-default">{gettext('No labels')}</div>
          )}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <CustomizePopover
          target={editorRef}
          className="option-editor-popover popover-radius-4 sea-ticket-settings-popover"
          sameWidthWithTarget={240}
          hidePopover={closeEditor}
          hidePopoverWithEsc={closeEditor}
        >
          <OptionEditorContainer
            id={id}
            ref={optionEditorContainerRef}
            isMultiple={true}
            optionHeight="fit-content"
            placeholder={gettext('Search labels')}
            emptyTip={gettext('No labels')}
            value={value || []}
            options={options}
          >
            {({ value, onChange }) => {
              return value.map(optionId => {
                const option = getOption(options, optionId);
                if (!option) return null;
                return (
                  <Option option={option} key={optionId} className="sea-metadata-multiple-select-editor-option">
                    <IconButton
                      icon="close"
                      onClick={() => onChange(optionId)}
                      className="sea-metadata-select-remove-btn no-hover-bg"
                      size={{ btn: 14, icon: 10 }}
                      style={{ margin: '0 -2px 0 2px', cursor: 'pointer' }}
                      iconStyle={{ color: option.text_color }}
                    />
                  </Option>
                );
              });
            }}
          </OptionEditorContainer>
        </CustomizePopover>
      )}
    </>
  );
};

export default LabelsSettings;
