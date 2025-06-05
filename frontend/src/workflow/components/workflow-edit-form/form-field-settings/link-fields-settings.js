import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledPopover, UncontrolledTooltip, Label } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { getEventClassName } from '../../../../utils/utils';

const gettext = window.gettext;

const LinkFieldsSettings = ({ columns, column, onColumnChanged }) => {
  const [isFieldsPopoverShow, setIsFieldsPopoverShow] = useState(false);

  const onLinkFieldsToggle = () => {
    setIsFieldsPopoverShow(!isFieldsPopoverShow);
  };

  return (
    <>
      <div className="field-setting-item">
        <Label>
          {gettext('Column settings in linked table')}
          <i className="ml-1 dtable-font dtable-icon-use-help" id="link-field-settings-description" />
        </Label>
        <UncontrolledTooltip
          target='link-field-settings-description'
          placement="top"
          innerClassName="field-tooltip-inner"
        >
          {gettext('Required fields are only valid for adding new records.')}
        </UncontrolledTooltip>
        <div className="mr-2 filters-setting-btn" id="add-link-fields-settings" onClick={onLinkFieldsToggle}>
          <i className="dtable-font dtable-icon-rename mr-2"></i>
          <span>{gettext('Set column settings')}</span>
        </div>
      </div>
      {isFieldsPopoverShow &&
        <LinkFieldsPopover
          onPopoverToggle={onLinkFieldsToggle}
          columns={columns}
          column={column}
          onColumnChanged={onColumnChanged}
        />
      }
    </>
  );
};

LinkFieldsSettings.propTypes = {
  columns: PropTypes.array,
  column: PropTypes.object,
  onColumnChanged: PropTypes.func
};

const LinkFieldsPopover = ({ columns, column, onPopoverToggle, onColumnChanged }) => {
  const popoverRef = useRef(null);

  const getInitialVisibleAndRequiredColumnFields = () => {
    const visibleColumnFields = column['link_visible_column_fields'] || [];
    const requiredColumnFields = column['link_required_column_fields'] || [];
    return { visibleColumnFields, requiredColumnFields };
  };

  const getAllColumnsState = (visibleColumnKeys, requiredColumnKeys) => {
    let isAllColumnsVisible = true;
    let isAllColumnsRequired = true;
    columns.forEach(col => {
      if (isAllColumnsVisible) {
        let currentExist = (!!visibleColumnKeys.find(key => key === col.key)) || (!!requiredColumnKeys.find(key => key === col.key));
        if (!currentExist) {
          isAllColumnsVisible = false;
        }
      }
      if (isAllColumnsRequired) {
        let currentExist = !!requiredColumnKeys.find(key => key === col.key);
        if (!currentExist) {
          isAllColumnsRequired = false;
        }
      }
    });
    return { isAllColumnsVisible, isAllColumnsRequired };
  };

  const { visibleColumnFields: initialVisibleColumnFields, requiredColumnFields: initialRequiredColumnFields } = getInitialVisibleAndRequiredColumnFields();
  const { isAllColumnsVisible: initialAllVisible, isAllColumnsRequired: initialAllRequired } = getAllColumnsState(initialVisibleColumnFields, initialRequiredColumnFields);
  const [visibleColumnFields, setVisibleColumnFields] = useState(initialVisibleColumnFields);
  const [requiredColumnFields, setRequiredColumnFields] = useState(initialRequiredColumnFields);
  const [isAllColumnsVisible, setIsAllColumnsVisible] = useState(initialAllVisible);
  const [isAllColumnsRequired, setIsAllColumnsRequired] = useState(initialAllRequired);

  useEffect(() => {
    document.addEventListener('click', hidePopover, true);
    document.addEventListener('keydown', onHotKey);

    return () => {
      document.removeEventListener('click', hidePopover, true);
      document.removeEventListener('keydown', onHotKey);
    };
  }, []);

  const hidePopover = (e) => {
    if (popoverRef.current && !getEventClassName(e).includes('popover') && !popoverRef.current.contains(e.target)) {
      onPopoverToggle(e);
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  const onHotKey = (e) => {
    if (isHotkey('esc', e)) {
      e.preventDefault();
      onPopoverToggle();
    }
  };

  const onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  const getFieldChecked = (fieldColumn) => {
    let visibleChecked = false;
    let requiredChecked = false;
    if (visibleColumnFields.includes(fieldColumn.key) || requiredColumnFields.includes(fieldColumn.key)) {
      visibleChecked = true;
    }
    if (requiredColumnFields.includes(fieldColumn.key)) {
      requiredChecked = true;
    }
    return { visibleChecked, requiredChecked };
  };

  const onCommit = (isAllVisible, isAllRequired, visibleFields, requiredFields) => {
    setIsAllColumnsVisible(isAllVisible);
    setIsAllColumnsRequired(isAllRequired);
    onColumnChanged(column.key, {
      link_visible_column_fields: visibleFields,
      link_required_column_fields: requiredFields
    });
  };

  const onChangeAllColumnsVisible = () => {
    let newVisibleColumnFields = [...visibleColumnFields] || [];
    let newRequiredColumnFields = [...requiredColumnFields] || [];
    let newAllRequired = isAllColumnsRequired;

    if (isAllColumnsVisible) {
      newVisibleColumnFields = [];
      newRequiredColumnFields = [];
      newAllRequired = false;
    } else {
      columns.forEach(column => {
        const vIndex = newVisibleColumnFields.indexOf(column.key);
        if (vIndex === -1) {
          newVisibleColumnFields.push(column.key);
        }
      });
    }

    setVisibleColumnFields(newVisibleColumnFields);
    setRequiredColumnFields(newRequiredColumnFields);
    onCommit(!isAllColumnsVisible, newAllRequired, newVisibleColumnFields, newRequiredColumnFields);
  };

  const onChangeAllColumnsRequired = () => {
    let newVisibleColumnFields = [...visibleColumnFields] || [];
    let newRequiredColumnFields = [...requiredColumnFields] || [];
    let newAllVisible = isAllColumnsVisible;

    if (isAllColumnsRequired) {
      newRequiredColumnFields = [];
    } else {
      columns.forEach(column => {
        const vIndex = newVisibleColumnFields.indexOf(column.key);
        const rIndex = newRequiredColumnFields.indexOf(column.key);
        if (vIndex === -1) {
          newVisibleColumnFields.push(column.key);
        }
        if (rIndex === -1) {
          newRequiredColumnFields.push(column.key);
        }
      });
      newAllVisible = true;
    }

    setVisibleColumnFields(newVisibleColumnFields);
    setRequiredColumnFields(newRequiredColumnFields);
    onCommit(newAllVisible, !isAllColumnsRequired, newVisibleColumnFields, newRequiredColumnFields);
  };

  const onChangeColumnVisible = (column_key, checked) => {
    let newVisibleColumnFields = [...visibleColumnFields];
    let newRequiredColumnFields = [...requiredColumnFields];
    const vIndex = newVisibleColumnFields.indexOf(column_key);
    const rIndex = newRequiredColumnFields.indexOf(column_key);

    if (checked) {
      newVisibleColumnFields.push(column_key);
    } else {
      if (vIndex !== -1) {
        newVisibleColumnFields.splice(vIndex, 1);
      }
      if (rIndex !== -1) {
        newRequiredColumnFields.splice(rIndex, 1);
      }
    }

    setVisibleColumnFields(newVisibleColumnFields);
    setRequiredColumnFields(newRequiredColumnFields);
    const { isAllColumnsVisible: newAllVisible, isAllColumnsRequired: newAllRequired } = getAllColumnsState(newVisibleColumnFields, newRequiredColumnFields);
    onCommit(newAllVisible, newAllRequired, newVisibleColumnFields, newRequiredColumnFields);
  };

  const onChangeColumnRequired = (column_key, checked) => {
    let newVisibleColumnFields = [...visibleColumnFields];
    let newRequiredColumnFields = [...requiredColumnFields];
    const vIndex = newVisibleColumnFields.indexOf(column_key);
    const rIndex = newRequiredColumnFields.indexOf(column_key);

    if (checked) {
      newRequiredColumnFields.push(column_key);
      if (vIndex === -1) {
        newVisibleColumnFields.push(column_key);
      }
    } else {
      if (rIndex !== -1) {
        newRequiredColumnFields.splice(rIndex, 1);
      }
    }

    setVisibleColumnFields(newVisibleColumnFields);
    setRequiredColumnFields(newRequiredColumnFields);
    const { isAllColumnsVisible: newAllVisible, isAllColumnsRequired: newAllRequired } = getAllColumnsState(newVisibleColumnFields, newRequiredColumnFields);
    onCommit(newAllVisible, newAllRequired, newVisibleColumnFields, newRequiredColumnFields);
  };

  return (
    <UncontrolledPopover
      placement="left"
      isOpen={true}
      target="add-link-fields-settings"
      fade={false}
      hideArrow={true}
      className="workflow-link-fields-popover"
      boundariesElement={document.body}
    >
      <div ref={popoverRef} onClick={onPopoverInsideClick}>
        <div className="add-link-field-settings-container">
          <table className="add-link-fields-table">
            <thead className="add-link-fields-table-header">
              <tr>
                <th width='64%' className="text-truncate">{''}</th>
                <th width='18%' className="column-checkbox">{gettext('Visible')}</th>
                <th width='18%' className="column-checkbox">{gettext('Required')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="add-link-fields-row">
                <td>
                  <span className="add-link-fields-select-all ml-4">{gettext('Select all')}</span>
                </td>
                <td className="column-checkbox">
                  <input
                    type='checkbox'
                    checked={isAllColumnsVisible}
                    onChange={onChangeAllColumnsVisible}
                  />
                </td>
                <td className="column-checkbox">
                  <input
                    type='checkbox'
                    checked={isAllColumnsRequired}
                    onChange={onChangeAllColumnsRequired}
                  />
                </td>
              </tr>
              {columns.map(column => {
                const { visibleChecked, requiredChecked } = getFieldChecked(column);
                return (
                  <tr key={column.key} className="add-link-fields-row">
                    <td className="pl-5 text-truncate" title={column.name}>
                      <i className={`${COLUMNS_ICON_CONFIG[column.type]} mr-2 add-link-field-icon`}></i>
                      <span>{column.name}</span>
                    </td>
                    <td className="column-checkbox">
                      <input
                        type='checkbox'
                        checked={visibleChecked}
                        onChange={() => onChangeColumnVisible(column.key, !visibleChecked)}
                      />
                    </td>
                    <td className="column-checkbox">
                      <input
                        type='checkbox'
                        checked={requiredChecked}
                        onChange={() => onChangeColumnRequired(column.key, !requiredChecked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </UncontrolledPopover>
  );
};

LinkFieldsPopover.propTypes = {
  columns: PropTypes.array,
  column: PropTypes.object,
  onPopoverToggle: PropTypes.func,
  onColumnChanged: PropTypes.func
};

export default LinkFieldsSettings;
