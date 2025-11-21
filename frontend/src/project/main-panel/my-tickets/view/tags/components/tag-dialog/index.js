import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input, Alert } from 'reactstrap';
import classnames from 'classnames';
import { ColorSelectorPopover, IconButton, ModalHeader } from '@/components';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import Tag from '../tag';
import { validateName } from '@/utils/validate';
import { isHexColor, isDarkColor } from '@/utils/color-utils';

import './index.css';

const TagDialog = ({ row: oldTag, onSubmit, onToggle }) => {
  const [name, setName] = useState(oldTag?.name || '');
  const [description, setDescription] = useState(oldTag?.description || '');
  const [color, setColor] = useState(oldTag?.color || SELECT_OPTION_COLORS[0].COLOR);
  const [textColor, setTextColor] = useState(oldTag?.text_color || SELECT_OPTION_COLORS[0].TEXT_COLOR);
  const [isChanged, setChanged] = useState(oldTag ? true : false);
  const [isShowColorPopover, setIsShowColorPopover] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState({ type: '', msg: '' });
  const [lastColorOption, setLastColorOption] = useState({
    color: oldTag?.color || SELECT_OPTION_COLORS[0].COLOR,
    textColor: oldTag?.text_color || SELECT_OPTION_COLORS[0].TEXT_COLOR,
  });

  const colorInputRef = useRef(null);

  const isValid = useMemo(() => name.trim() && color, [name, description, color]);
  const isValidColor = useMemo(() => isHexColor(color), [color]);

  const onNameChange = useCallback((event) => {
    const newName = event.target.value;
    if (newName === name) return;
    setName(newName);
    setChanged(true);
  }, [name]);

  const onDescriptionChange = useCallback((event) => {
    const newDescription = event.target.value;
    if (newDescription === description) return;
    setDescription(newDescription);
    setChanged(true);
  }, [description]);

  const syncGenerateColor = useCallback(() => {
    const random = Math.floor(Math.random() * (SELECT_OPTION_COLORS.length - 1));
    const option = SELECT_OPTION_COLORS[random];
    const { COLOR, TEXT_COLOR } = option;
    setColor(COLOR);
    setTextColor(TEXT_COLOR);
    setChanged(true);
  }, []);

  const onColorChange = useCallback((event) => {
    let newColor = event.target.value;
    if (!newColor) newColor = '#';
    if (newColor === color) return;
    setColor(newColor);
    if (isHexColor(newColor)) {
      const textColor = isDarkColor(newColor) ? '#FFF' : '#212529';
      setTextColor(textColor);
    }
  }, [color]);

  const onColorOptionChange = useCallback(({ COLOR, TEXT_COLOR }) => {
    setColor(COLOR);
    setTextColor(TEXT_COLOR);
  }, []);

  const openColorPopover = useCallback(() => {
    setIsShowColorPopover(true);
  }, []);

  const closeColorPopover = useCallback(() => {
    setIsShowColorPopover(false);
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    const { isValid: isValidName, message: validName } = validateName(name);
    if (!isValidName) {
      setError({ type: 'name', msg: validName });
      setSubmitting(false);
      return;
    }
    if (!isValidColor) {
      setError({ type: 'color', msg: gettext('Color is invalid') });
      setSubmitting(false);
      return;
    }
    onSubmit({ name: validName, description, color, text_color: textColor }, {
      success_callback: () => {
        onToggle();
      },
      fail_callback: (error) => {
        setError({ type: 'network', msg: error });
        setSubmitting(false);
      }
    });
  }, [name, description, color, textColor, isValidColor, onToggle, onSubmit]);

  useEffect(() => {
    if (isHexColor(color)) {
      setLastColorOption({ color, textColor });
    }
  }, [color, textColor]);

  return (
    <Modal isOpen={true} autoFocus={false} className="sea-qa-tag-dialog" toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{oldTag ? gettext('Edit tag') : gettext('New tag')}</ModalHeader>
      <ModalBody >
        <FormGroup className="tag-preview">
          <Tag
            className="mw-100 text-truncate"
            tag={{ name: name || gettext('Preview tag'), color: lastColorOption.color, text_color: lastColorOption.textColor }}
          />
        </FormGroup>
        <FormGroup>
          <Label>
            {gettext('Name')}
            <span className="required-tip" title={gettext('Required')}>{'*'}</span>
          </Label>
          <Input autoFocus={true} value={name} onChange={onNameChange} />
        </FormGroup>
        {error && error.type === 'name' && (<Alert color="danger">{error.msg}</Alert>)}
        <FormGroup>
          <Label>{gettext('Description')}</Label>
          <Input
            type="textarea"
            rows={3}
            className="sea-qa-tag-description-editor"
            value={description}
            onChange={onDescriptionChange}
          />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Color')}</Label>
          <div className="d-flex algin-items-center sea-qa-tag-color-editor-container ">
            <IconButton
              icon="sync"
              style={{ backgroundColor: lastColorOption.color, color: lastColorOption.textColor }}
              className="sea-qa-tag-color-editor-btn"
              onClick={syncGenerateColor}
            />
            <Input
              innerRef={colorInputRef}
              className={classnames('sea-qa-tag-color-editor', { 'invalid': !isValidColor })}
              value={color}
              onChange={onColorChange}
              onClick={openColorPopover}
            />
          </div>
          {isShowColorPopover && (
            <ColorSelectorPopover
              target={colorInputRef}
              color={color}
              onToggle={closeColorPopover}
              onChange={onColorOptionChange}
            />
          )}
        </FormGroup>
        {error && error.type === 'color' && (<Alert color="danger">{error.msg}</Alert>)}
        {error && error.type === 'network' && (<Alert color="danger">{error.msg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !isChanged}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default TagDialog;
