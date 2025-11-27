import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input, Alert } from 'reactstrap';
import classnames from 'classnames';
import { ColorSelectorPopover, CustomizeSelect, IconButton, ModalHeader } from '@/components';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import Option from '../option';
import { validateName } from '@/utils/validate';
import { isHexColor, isDarkColor } from '@/utils/color-utils';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import ObjectUtils from '@/utils/object-utils';

import './index.css';

const OptionDialog = ({
  row: oldOption,
  parentOptions,
  canModifyDescription = true,
  type,
  onSubmit,
  onToggle,
}) => {
  const [name, setName] = useState(oldOption?.name || '');
  const [description, setDescription] = useState(oldOption?.description || '');
  const [color, setColor] = useState(oldOption?.color || SELECT_OPTION_COLORS[0].COLOR);
  const [textColor, setTextColor] = useState(oldOption?.text_color || SELECT_OPTION_COLORS[0].TEXT_COLOR);
  const [parentId, setParentId] = useState(oldOption?.parent_id || '');
  const [isShowColorPopover, setIsShowColorPopover] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState({ type: '', msg: '' });
  const [lastColorOption, setLastColorOption] = useState({
    color: oldOption?.color || SELECT_OPTION_COLORS[0].COLOR,
    textColor: oldOption?.text_color || SELECT_OPTION_COLORS[0].TEXT_COLOR,
  });

  const colorInputRef = useRef(null);

  const canModifyParentOption = useMemo(() => parentOptions && Array.isArray(parentOptions) && parentOptions.length > 0, [parentOptions]);
  const formattedParentOptions = useMemo(() => {
    if (!Array.isArray(parentOptions) || parentOptions.length === 0) return [];
    return parentOptions.map(option => {
      return {
        value: option._id,
        name: option.display_name || option.name,
        label: (
          <div className="select-option-name single-option-name">
            <SelectOption option={option} className="single-select-option ml-0" />
            <IconButton className="single-check-icon no-hover-bg" icon={parentId === option.id ? 'check' : ''} />
          </div>
        ),
      };
    });
  }, [parentOptions, parentId]);
  const selectedParentOption = useMemo(() => {
    if (!Array.isArray(parentOptions) || parentOptions.length === 0) return null;
    const option = parentOptions.find(o => o._id === parentId);
    if (!option) return null;
    return {
      label: (<SelectOption option={option} className="single-select-option ml-0" />)
    };
  }, [parentOptions, parentId]);
  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!color) return false;
    if (canModifyParentOption && !parentId) return false;
    return true;
  }, [name, color, canModifyParentOption, parentId]);
  const isValidColor = useMemo(() => isHexColor(color), [color]);
  const isChanged = useMemo(() => {
    if (!oldOption) return isValid;
    const oldValue = {
      name: oldOption?.name || '',
      description: oldOption?.description || '',
      color: oldOption?.color || SELECT_OPTION_COLORS[0].COLOR,
      text_color: oldOption?.text_color || SELECT_OPTION_COLORS[0].TEXT_COLOR,
      parent_id: oldOption?.parent_id || ''
    };
    const newValue = {
      name: name.trim(),
      description,
      color,
      text_color: textColor,
      parent_id: parentId,
    };
    return ObjectUtils.isObjectChanged(oldValue, newValue);
  }, [oldOption, isValid, name, description, color, textColor, parentId]);

  const onNameChange = useCallback((event) => {
    const newName = event.target.value;
    if (newName === name) return;
    setName(newName);
  }, [name]);

  const onDescriptionChange = useCallback((event) => {
    const newDescription = event.target.value;
    if (newDescription === description) return;
    setDescription(newDescription);
  }, [description]);

  const syncGenerateColor = useCallback(() => {
    const random = Math.floor(Math.random() * (SELECT_OPTION_COLORS.length - 1));
    const option = SELECT_OPTION_COLORS[random];
    const { COLOR, TEXT_COLOR } = option;
    setColor(COLOR);
    setTextColor(TEXT_COLOR);
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

  const onSelectParentOption = useCallback((newValue) => {
    if (newValue === parentId) return;
    setParentId(newValue);
  }, [parentId]);

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
    let params = { name: validName, color, text_color: textColor };
    if (canModifyDescription) {
      params['description'] = description;
    }
    if (canModifyParentOption && oldOption?.parent_id !== parentId) {
      params['parent_id'] = parentId;
    }
    onSubmit(params, {
      success_callback: () => {
        onToggle();
      },
      fail_callback: (error) => {
        setError({ type: 'network', msg: error });
        setSubmitting(false);
      }
    });
  }, [oldOption, name, description, color, textColor, parentId, canModifyParentOption, isValidColor, canModifyDescription, onToggle, onSubmit]);

  useEffect(() => {
    if (isHexColor(color)) {
      setLastColorOption({ color, textColor });
    }
  }, [color, textColor]);

  let title = oldOption ? gettext('Edit %s') : gettext('New %s');
  title = title.replace('%s', type);

  return (
    <Modal isOpen={true} autoFocus={false} className="sea-qa-tag-dialog" toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{title}</ModalHeader>
      <ModalBody >
        <FormGroup className="tag-preview">
          <Option
            className="mw-100 text-truncate"
            option={{ name: name || gettext('Preview %s').replace('%s', type), color: lastColorOption.color, text_color: lastColorOption.textColor }}
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
        {canModifyDescription && (
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
        )}
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
        {canModifyParentOption && (
          <FormGroup>
            <Label>
              {gettext('Parent option')}
              <span className="required-tip" title={gettext('Required')}>{'*'}</span>
            </Label>
            <CustomizeSelect
              className=" sea-metadata-selector-single-select"
              value={selectedParentOption}
              options={formattedParentOptions}
              onChange={onSelectParentOption}
              placeholder={gettext('Select an option')}
              searchable={true}
              searchPlaceholder={gettext('Search options')}
              noOptionsPlaceholder={gettext('No options available')}
              isInModal={true}
            />
          </FormGroup>
        )}
        {error && error.type === 'network' && (<Alert color="danger">{error.msg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !isValid || !isChanged}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default OptionDialog;
