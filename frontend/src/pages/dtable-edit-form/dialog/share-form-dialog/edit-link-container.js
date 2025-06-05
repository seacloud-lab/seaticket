import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { toaster } from 'dtable-ui-component';
import { Input, InputGroup, InputGroupText, Button, UncontrolledTooltip } from 'reactstrap';
import FieldPresetItem from '../../widgets/field-preset-item';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  formLinkName: PropTypes.string,
  formCustomUrl: PropTypes.string,
  columns: PropTypes.array,
  fieldItemsList: PropTypes.array,
  onChangeLinkName: PropTypes.func,
  onChangeFormCustomUrl: PropTypes.func,
  onAddFieldItem: PropTypes.func,
  onDeleteFieldItem: PropTypes.func,
  onUpdateFieldItem: PropTypes.func,
};

const { canUseAdvancedCustomization, dtableWebURL } = window.shared.pageOptions;

const EditLinkContainer = ({ formLinkName, formCustomUrl, columns, fieldItemsList, onChangeLinkName, onChangeFormCustomUrl, onAddFieldItem, onDeleteFieldItem, onUpdateFieldItem }) => {
  const formCustomUrlStaticPart = `${dtableWebURL}dtable/forms/custom/`;
  const inputRef = useRef(null);
  const preTextRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current && preTextRef.current) {
        const preTextWidth = preTextRef.current.offsetWidth;
        inputRef.current.style.paddingLeft = `${preTextWidth + 12}px`;
      }
    }, 1);
  }, []);

  const onCopyLink = () => {
    copy(formCustomUrlStaticPart + formCustomUrl);
    toaster.success(gettext('URL is copied to the clipboard'));
  };

  return (
    <div className="edit-link-container">
      <span className="form-presets-setting-title mt-2">{gettext('Form link name')}</span>
      <Input
        className="mt-1 w-100"
        type="text"
        value={formLinkName}
        onChange={onChangeLinkName}
      />
      <div className="d-flex align-items-center mt-2">
        <span className={`form-presets-setting-title ${canUseAdvancedCustomization ? '' : 'enterprise-text'}`}>{gettext('Custom URL')}</span>
        {canUseAdvancedCustomization ? (
          <span className="dtable-font dtable-icon-use-help ml-1" id="dtable-icon-help-tip">
            <UncontrolledTooltip
              placement="bottom"
              target='dtable-icon-help-tip'
            >
              {gettext('The custom part of the URL must be between 5 and 30 characters long and may only contain letters (a-z), numbers, and hyphens.')}
            </UncontrolledTooltip>
          </span>
        ) : (
          <span className="dtable-font dtable-icon-member-free dtable-font-gold ml-1" id='dtable-icon-gold-tip'>
            <UncontrolledTooltip
              placement="bottom"
              target='dtable-icon-gold-tip'
            >
              {gettext('This feature is an enterprise version feature')}
            </UncontrolledTooltip>
          </span>
        )}
      </div>
      <InputGroup className="form-custom-url-static">
        <span className="input-pretext" ref={preTextRef} onClick={() => {}}>
          {formCustomUrlStaticPart}
        </span>
        <Input
          type="text"
          value={formCustomUrl}
          disabled={!canUseAdvancedCustomization}
          onChange={onChangeFormCustomUrl}
          innerRef={inputRef}
        />
        <InputGroupText>
          <Button
            onClick={onCopyLink}
            color="primary"
            disabled={!formCustomUrl}
          >
            {gettext('Copy')}
          </Button>
        </InputGroupText>
      </InputGroup>
      <span className="form-presets-setting-title mt-2">{gettext('Fields with prefilled values')}</span>
      {fieldItemsList.map((fieldItem) => {
        return (
          <FieldPresetItem
            key={fieldItem.key}
            fieldItem={fieldItem}
            columns={columns}
            onDeleteFieldItem={onDeleteFieldItem}
            onUpdateFieldItem={onUpdateFieldItem}
          />
        );
      })}
      <div className="add-item-btn mt-2" onClick={onAddFieldItem}>
        <i className="dtable-font dtable-icon-add-table mr-2"></i>
        <span className="add-new-option">{gettext('Add field')}</span>
      </div>
    </div>
  );
};

EditLinkContainer.propTypes = propTypes;

export default EditLinkContainer;
