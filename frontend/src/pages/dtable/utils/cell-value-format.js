import React from 'react';
import { CellType, getDigitalSignImageUrl, getGeolocationDisplayString } from 'dtable-utils';
import { RateFormatter } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { getFileIconUrl, formatDateValue } from '../../../components-form/utils/utils';
import SelectOption from '../../../components-form/cell-formatter-widgets/select-option';
import { isDigitalSignsUrl, generateBaseImageThumbnailUrl } from '../../../utils/url-utils';

const getImageThumbnailUrl = ({ url, dtableUuid, workspaceId }) => {
  if (isDigitalSignsUrl(url)) {
    return generateBaseImageThumbnailUrl({ workspaceId, dtableUuid, partUrl: url });
  }
  return url;
};

const getTextFormat = (value, isNewValue) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value';
  return (
    <div className={className}>
      {value}
    </div>
  );
};

const getDeletedMultipleSelectFormat = (deletedValue, column) => {
  if (!deletedValue || !Array.isArray(deletedValue) || deletedValue.length === 0) return null;
  let validOptions = [];
  let options = column.data && column.data.options ? column.data.options : [];
  deletedValue.forEach((optionID, index) => {
    let option = options.find(option => option.id === optionID);
    if (option) {
      validOptions.push(
        <div className="single-select-activity-item deleted-item" key={`activity-deleted-multiple-select-${index}`}>
          <div className="single-select-op-icon deleted-icon"><span>-</span></div>
          <SelectOption value={optionID} column={column} />
        </div>
      );
    }
  });
  return validOptions.length === 0 ? null : validOptions;
};

const getMultipleSelectFormat = (originalValue, addValue, column) => {
  let validOptions = [];
  let options = column.data && column.data.options ? column.data.options : [];
  if (originalValue && Array.isArray(originalValue) && originalValue.length > 0) {
    originalValue.forEach((optionID, index) => {
      let option = options.find(option => option.id === optionID);
      if (option) {
        validOptions.push(
          <div className='d-flex align-items-center mr-2'>
            <SelectOption value={optionID} column={column} key={`activity-multiple-select-${index}`} />
          </div>
        );
      }
    });
  }
  if (addValue && Array.isArray(addValue) && addValue.length > 0) {
    addValue.forEach((optionID, index) => {
      let option = options.find(option => option.id === optionID);
      if (option) {
        validOptions.push(
          <div className="single-select-activity-item add-item" key={`activity-add-multiple-select-${index}`}>
            <div className="single-select-op-icon add-icon"><span>+</span></div>
            <SelectOption value={optionID} column={column} />
          </div>
        );
      }
    });
  }
  return validOptions.length === 0 ? null : validOptions;
};

const getSingleSelectFormat = (optionID, column, isNewValue) => {
  if (!optionID || typeof optionID !== 'string') return null;

  let options = column.data && column.data.options ? column.data.options : [];
  let option = options.find(option => option.id === optionID);
  if (!option) return null;
  if (isNewValue) {
    return (
      <div className="single-select-activity-item add-item">
        <div className="single-select-op-icon add-icon"><span>+</span></div>
        <SelectOption value={optionID} column={column} />
      </div>
    );
  }
  return (
    <div className="single-select-activity-item deleted-item">
      <div className="single-select-op-icon deleted-icon"><span>-</span></div>
      <SelectOption value={optionID} column={column} />
    </div>
  );
};

const getCollaboratorFormat = (value, collaboratorsMap, isNewValue) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value ';

  let validCollaborators = [];
  value.forEach((item, index) => {
    let collaborator = collaboratorsMap[item];
    if (collaborator) {
      validCollaborators.push(
        <div key={`activity-collaborator-${index}`} className={`activity-collaborator ${className}`}>
          <span className="collaborator-avatar-container">
            <img className="collaborator-avatar" alt={collaborator.name} src={collaborator.avatar_url} />
          </span>
          <span className="collaborator-name">{collaborator.name}</span>
        </div>
      );
    }
  });
  return validCollaborators.length === 0 ? null : validCollaborators;
};

const getDepartmentFormat = (value, departmentListMap, isNewValue) => {
  if (!value) return null;
  const department = departmentListMap[value];
  if (!department) return null;
  return (
    <div className={`activity-department-item ${isNewValue ? 'add-item' : 'deleted-item'}`}>
      <div className="single-select-op-icon add-icon"><span>{isNewValue ? '+' : '-'}</span></div>
      <div className="department-avatar-container d-flex align-items-center justify-content-center" aria-hidden="true">
        <span className="dtable-font dtable-icon-department-single-selection"></span>
      </div>
      <span className="department-name text-truncate">{department.name}</span>
    </div>
  );
};

const getFileFormat = (value, isExpand, isNewValue) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const { mediaUrl } = window.app.config;
  const className = isNewValue ? 'new-file' : 'old-file';
  if (isExpand) {
    return value.map((item, index) => {
      return <img className={`activity-file-item ${className}`} src={getFileIconUrl(mediaUrl, item.name, item.type)} alt="" key={`activity-file-${index}`}></img>;
    });
  }
  return (
    <span className="activity-file">
      <img className={`activity-file-item expand ${className}`} src={getFileIconUrl(mediaUrl, value[0].name, value[0].type)} alt=""></img>
      {value.length !== 1 &&
        <span className="file-value-count">{`+${value.length}`}</span>
      }
    </span>
  );
};

const getImageFormat = (value, isExpand, isNewValue, { dtableUuid, workspaceId }) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const className = isNewValue ? 'new-file' : 'old-file';

  if (isExpand) {
    return value.map((item, index) => {
      const imageUrl = getImageThumbnailUrl({ url: item, dtableUuid, workspaceId });
      return <img className={`activity-file-item ${className}`} src={imageUrl} alt="" key={`activity-image-${index}`}></img>;
    });
  }

  const imageUrl = getImageThumbnailUrl({ url: value[0], dtableUuid, workspaceId });
  return (
    <span className="activity-file">
      <img className={`activity-file-item expand ${className}`} src={imageUrl} alt=""></img>
      {value.length !== 1 &&
        <span className="file-value-count">{`+${value.length}`}</span>
      }
    </span>
  );
};

const getCheckboxFormat = (value) => {
  return (
    <div className={`activity-checkbox-item ${value ? 'select-checkbox' : 'unselect-checkbox'}`}>
      <span className="dtable-font dtable-icon-check-mark grid-checkbox-check-mark"></span>
    </div>
  );
};

const getLongTextFormat = (value, isExpand, isNewValue) => {
  if ((typeof value) !== 'object' || !value.text) return null;

  let { links, images, preview, checklist } = value;
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value';
  return (
    <div className={`activity-longtext-item ${className} ${isExpand ? '' : 'activity-longtext-item-hide'}`}>
      {createLinkContent(links)}
      {createImagesContent(images)}
      {createTextContent(preview)}
      {createCheckListContent(checklist)}
    </div>
  );
};

const createCheckListContent = (checklist) => {
  return checklist && checklist.total > 0 ? <span className="longtext-icon-container longtext-formatter-check-list-container"><i className={`dtable-font dtable-icon-check-square-solid ${checklist.completed === checklist.total && 'longtext-formatter-checklist-completed'}`}></i>{`${checklist.completed}/${checklist.total}`}</span> : null;
};

const createTextContent = (textValue) => {
  if (typeof textValue !== 'string') {
    return <span className="null-value">{gettext('Empty')}</span>;
  }
  return <span className="activity-longtext-content-item">{textValue}</span>;
};

const createLinkContent = (links) => {
  if (!Array.isArray(links) || links.length === 0) {
    return null;
  }

  return (
    <span className="activity-longtext-icon-container activity-longtext-link-item">
      <i className="dtable-font dtable-icon-url"></i>{links.length}
    </span>
  );
};

const createImagesContent = (images) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }
  return (
    <span className="activity-longtext-icon-container activity-longtext-image-item">
      <img src={images[0]} alt=""/>
      <i className="image-number">{images.length > 1 ? '+' + images.length : null}</i>
    </span>
  );
};

const getGeolocationFormatter = (cellValue, columnData, isNewValue) => {
  if (typeof cellValue !== 'object') return null;
  const value = getGeolocationDisplayString(cellValue, columnData);
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value';
  return (
    <div className={className}>
      <span>{value}</span>
    </div>
  );
};

const getDateFormatter = (value, column, isNewValue) => {
  if (!value || typeof value !== 'string') return null;
  const format = column.data && column.data.format;
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value';
  return (
    <div className={className}>
      {formatDateValue(value, format) || null}
    </div>
  );
};

const getRateFormatter = (value, column, isNewValue) => {
  if (!value || value === 0) return null;
  const className = isNewValue ? 'activity-new-cell-value' : 'activity-old-cell-value rate-item';
  return (
    <div className={className}>
      <RateFormatter value={value} data={column.data || {}} editable={false}/>
    </div>
  );
};

const getAllValue = (value, oldValue) => {
  let deletedValue = oldValue; let originalValue = []; let addValue = value;
  if (oldValue && Array.isArray(oldValue) && value && Array.isArray(value)) {
    deletedValue = oldValue.filter(item => !value.includes(item));
    addValue = value.filter(item => !oldValue.includes(item));
    originalValue = value.filter(item => oldValue.includes(item));
  }
  return { deletedValue, addValue, originalValue };
};

const getFormattedCellValueItem = (cell, isExpand, { userListMap, departmentListMap, dtableUuid, workspaceId }) => {
  let { value, old_value: oldValue, column_type, column_data, column_key, column_name } = cell;
  let cellValue = value;
  let cellOldValue = oldValue;
  let column = {
    key: column_key,
    type: column_type,
    data: column_data,
    name: column_name,
  };
  switch (column_type) {
    case CellType.TEXT: {
      cellValue = getTextFormat(value, true);
      cellOldValue = getTextFormat(oldValue, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.DATE: {
      cellValue = getDateFormatter(value, column, true);
      cellOldValue = getDateFormatter(oldValue, column, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.SINGLE_SELECT: {
      cellValue = getSingleSelectFormat(value, column, true);
      cellOldValue = getSingleSelectFormat(oldValue, column, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.MULTIPLE_SELECT: {
      const { deletedValue, originalValue, addValue } = getAllValue(value, oldValue);
      cellValue = getMultipleSelectFormat(originalValue, addValue, column);
      cellOldValue = getDeletedMultipleSelectFormat(deletedValue, column);
      return { cellValue, cellOldValue, column };
    }
    case CellType.FILE: {
      cellValue = getFileFormat(cellValue, isExpand, true);
      cellOldValue = getFileFormat(cellOldValue, isExpand, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.IMAGE: {
      cellValue = getImageFormat(cellValue, isExpand, true, { dtableUuid, workspaceId });
      cellOldValue = getImageFormat(cellOldValue, isExpand, false, { dtableUuid, workspaceId });
      return { cellValue, cellOldValue, column };
    }
    case CellType.DIGITAL_SIGN: {
      const signImages = [getDigitalSignImageUrl(cellValue)].filter(Boolean);
      const oldSignImages = [getDigitalSignImageUrl(cellOldValue)].filter(Boolean);
      cellValue = getImageFormat(signImages, isExpand, true, { dtableUuid, workspaceId });
      cellOldValue = getImageFormat(oldSignImages, isExpand, false, { dtableUuid, workspaceId });
      return { cellValue, cellOldValue, column };
    }
    case CellType.DEPARTMENT_SINGLE_SELECT: {
      cellValue = getDepartmentFormat(cellValue, departmentListMap, true);
      cellOldValue = getDepartmentFormat(cellOldValue, departmentListMap, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.CHECKBOX: {
      cellValue = getCheckboxFormat(cellValue);
      cellOldValue = null;
      return { cellValue, cellOldValue, column };
    }
    case CellType.LONG_TEXT: {
      cellValue = getLongTextFormat(cellValue, isExpand, true);
      cellOldValue = getLongTextFormat(cellOldValue, isExpand, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.LINK: {
      cellValue = getTextFormat(Array.isArray(value) ? value.join(',') : '', true);
      cellOldValue = getTextFormat(Array.isArray(oldValue) ? oldValue.join(',') : '', false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.COLLABORATOR: {
      cellValue = getCollaboratorFormat(cellValue, userListMap, true);
      cellOldValue = getCollaboratorFormat(cellOldValue, userListMap, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.NUMBER: {
      if (typeof cellValue !== 'string' && typeof cellValue !== 'number') {
        cellValue = null;
      }
      if (typeof cellOldValue !== 'string' && typeof cellOldValue !== 'number') {
        cellOldValue = null;
      }
      cellValue = cellValue || cellValue === 0 ?
        <div className="activity-new-cell-value">
          {cellValue}
        </div>
        : null;
      cellOldValue = cellOldValue || cellOldValue === 0 ?
        <div className="activity-old-cell-value">
          {cellOldValue}
        </div>
        : null;
      return { cellValue, cellOldValue, column };
    }
    case CellType.GEOLOCATION: {
      cellValue = getGeolocationFormatter(cellValue, column_data, true);
      cellOldValue = getGeolocationFormatter(cellOldValue, column_data, false);
      return { cellValue, cellOldValue, column };
    }
    case CellType.RATE: {
      cellValue = getRateFormatter(cellValue, column, true);
      cellOldValue = getRateFormatter(cellOldValue, column, false);
      return { cellValue, cellOldValue, column };
    }
    default: {
      cellValue = (
        <div className="activity-new-cell-value">
          {cellValue || null}
        </div>
      );
      cellOldValue = (
        <div className="activity-old-cell-value">
          {cellOldValue || null}
        </div>
      );
      return { cellValue, cellOldValue, column };
    }
  }
};

const getFormattedCellValue = (rowData, isExpand, { userListMap, departmentListMap, dtableUuid, workspaceId }) => {
  let newValues = [];
  let oldValues = [];
  let columns = [];
  rowData.forEach(cell => {
    let { cellValue, cellOldValue, column } = getFormattedCellValueItem(cell, isExpand, { userListMap, departmentListMap, dtableUuid, workspaceId });
    newValues.push(cellValue);
    oldValues.push(cellOldValue);
    columns.push(column);
  });
  return { newValues, oldValues, columns };
};

export { getFormattedCellValue };
