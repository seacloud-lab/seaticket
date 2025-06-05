import React from 'react';
import deepCopy from 'deep-copy';
import { CellType, DEFAULT_DATE_FORMAT, FORMULA_COLUMN_TYPES, FORMULA_RESULT_TYPE } from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import {
  TextFormatter,
  NumberFormatter,
  CheckboxFormatter,
  DateFormatter,
  CollaboratorFormatter,
  ImageFormatter,
  FileFormatter,
  SingleSelectFormatter,
  MultipleSelectFormatter,
  GeolocationFormatter,
  CTimeFormatter,
  CreatorFormatter,
  LastModifierFormatter,
  MTimeFormatter,
  AutoNumberFormatter,
  UrlFormatter,
  EmailFormatter,
  DurationFormatter,
} from 'dtable-ui-component';
import RatingFormatter from '../../../../components-form/cell-formatter/rating-formatter';
import { Utils } from '../../../../utils/utils';

export const getOptionIdsByNames = (column, optionNames) => {
  let optionIds = [];
  const options = (column.data && column.data.options) || [];
  if (!Array.isArray(options) || options.length === 0) return optionIds;
  for (let i = 0; i < optionNames.length; i++) {
    const optionName = optionNames[i];
    const option = options.find(item => { return item.name === optionName;});
    if (option) optionIds.push(option.id);
  }
  return optionIds;
};

const renderLongTextImages = (images) => {
  let imagesDom = images.map((image, index) => {
    return <img src={Utils.getImageThumbnailUrl(image)} alt="" key={index}/>;
  });
  return (
    <span className="longtext-icon-container longtext-formatter-image-container">
      {imagesDom}<i className="image-number">{'+'}{images.length}</i>
    </span>
  );
};

const renderLongText = (markdown) => {
  const { previewText, images, links } = getPreviewContent(markdown);
  const linksLen = links ? links.length : 0;
  const imagesLen = images ? images.length : 0;
  return (
    <div className="longtext-formatter">
      {linksLen > 0 &&
        <span className="longtext-icon-container longtext-formatter-links-container">
          <i className="dtable-font dtable-icon-url"></i>{links.length}
        </span>
      }
      {imagesLen > 0 && renderLongTextImages(images)}
      <span className="longtext-formatter-preview-container">{previewText}</span>
    </div>
  );
};

const getLinkedValueFormatter = (row, column, related_user_list) => {
  const { key, array_type: type, array_data: data } = column;
  const value = row[key];
  if (type === CellType.COLLABORATOR) {
    return value;
  }
  // link | link-formula reset value
  row[key] = value && value.map(item => item.display_value);

  // make a column copy
  let newColumn = deepCopy(column);
  newColumn.type = type;
  newColumn.data = data;
  return covertRow(row, newColumn, related_user_list);
};

export const DATASET_NOT_SUPPORT_COLUMN_TYPES = [CellType.BUTTON];

export const covertRow = (row, column, related_user_list) => {
  if (!row || !column) {
    return null;
  }
  let { key, type, data } = column;
  data = data || {};
  const value = row[key];
  if (!value || DATASET_NOT_SUPPORT_COLUMN_TYPES.includes(type)) {
    return null;
  }
  let result;
  switch (type) {
    case CellType.TEXT:
      result = <TextFormatter value={value}/>;
      break;
    case CellType.LONG_TEXT:
      result = renderLongText(value);
      break;
    case CellType.IMAGE:
      /* eslint-disable-next-line */
      const { server } = window.app.pageOptions;
      result = <ImageFormatter value={value} isSample={true} server={server}/>;
      break;
    case CellType.FILE:
      result = <FileFormatter value={value} isSample={false}/>;
      break;
    case CellType.COLLABORATOR:
      result = <CollaboratorFormatter collaborators={related_user_list} value={value} enableDeleteCollaborator={false} />;
      break;
    case CellType.CREATOR:
      result = <CreatorFormatter collaborators={related_user_list} value={value} />;
      break;
    case CellType.LAST_MODIFIER:
      result = <LastModifierFormatter collaborators={related_user_list} value={value} />;
      break;
    case CellType.SINGLE_SELECT:
      result = <SingleSelectFormatter value={value} options={data.options || []}/>;
      break;
    case CellType.MULTIPLE_SELECT:
      result = <MultipleSelectFormatter value={value} options={data.options || []}/>;
      break;
    case CellType.DATE:
      result = <DateFormatter value={value} format={data.format}/>;
      break;
    case CellType.CTIME:
      result = <CTimeFormatter value={value} />;
      break;
    case CellType.MTIME:
      result = <MTimeFormatter value={value} />;
      break;
    case CellType.NUMBER:
      // todo: value is 0.00% formatter return null
      result = <NumberFormatter value={value} data={data}/>;
      break;
    case CellType.CHECKBOX:
      result = <CheckboxFormatter value={value} />;
      break;
    case CellType.GEOLOCATION:
      result = <GeolocationFormatter value={value} />;
      break;
    case CellType.URL:
      result = <UrlFormatter value={value}/>;
      break;
    case CellType.DURATION:
      result = <DurationFormatter value={value} format={data.duration_format}/>;
      break;
    case CellType.EMAIL:
      result = <EmailFormatter value={value}/>;
      break;
    case CellType.AUTO_NUMBER:
      result = <AutoNumberFormatter value={value}/>;
      break;
    case CellType.RATE:
      result = <RatingFormatter value={value} column={column} isReadOnly={true}/>;
      break;
    case CellType.LINK:
      result = getLinkedValueFormatter(row, column, related_user_list);
      break;
    case CellType.LINK_FORMULA:
      result = value.toString();
      break;
    default:
      result = value.toString();
  }
  return result;
};

export const getCellRecordWidth = (column, isSample = false) => {
  let { type, data } = column;
  switch (type) {
    case CellType.DATE: {
      let isShowHourAndMinute = data && data.format && data.format.indexOf('HH:mm') > -1;
      return isShowHourAndMinute ? 160 : 110;
    }
    case CellType.LONG_TEXT:
    case CellType.AUTO_NUMBER:
    case CellType.URL:
    case CellType.EMAIL: {
      return 200;
    }
    case CellType.CHECKBOX: {
      return 80;
    }
    case CellType.NUMBER: {
      return 120;
    }
    case CellType.CTIME:
    case CellType.MTIME: {
      return 170;
    }
    case CellType.RATE: {
      const { rate_max_number } = data || {};
      const rateMaxNumber = rate_max_number || 5;
      return 16 * rateMaxNumber + 20;
    }
    case CellType.IMAGE:
    case CellType.FILE: {
      return isSample ? 60 : 160;
    }
    default: {
      return 160;
    }
  }
};

export function getDateColumnFormat(column) {
  let format = (column && column.data && column.data.format) ? column.data.format : DEFAULT_DATE_FORMAT;
  // Old Europe format is D/M/YYYY new format is DD/MM/YYYY
  format = format.replace(/D\/M\/YYYY/, 'DD/MM/YYYY');
  return format;
}

export function isCheckboxColumn(column) {
  let { type, data } = column;
  if (FORMULA_COLUMN_TYPES.includes(type)) {
    const { result_type, array_type } = data || {};
    if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
      return array_type === CellType.CHECKBOX;
    }
    return false;
  }
  return type === CellType.CHECKBOX;
}

export const getFormulaArrayValue = (value, isFlat = true) => {
  if (!Array.isArray(value)) return [];
  if (!isFlat) return getTwoDimensionArrayValue(value);
  return value
    .map(item => {
      if (Object.prototype.toString.call(item) !== '[object Object]') {
        return item;
      }
      if (!Object.prototype.hasOwnProperty.call(item, 'display_value')) return item;
      const { display_value } = item;
      if (!Array.isArray(display_value) || display_value.length === 0) return display_value;
      return display_value.map(i => {
        if (Object.prototype.toString.call(i) === '[object Object]') {
          if (!Object.prototype.hasOwnProperty.call(i, 'display_value')) return i;
          const { display_value } = i;
          return display_value;
        }
        return i;
      });
    })
    .flat()
    .filter(item => isValidCellValue(item));
};

export const convertValueToDtableLongTextValue = (value) => {
  const valueType = Object.prototype.toString.call(value);
  if (value && valueType === '[object String]') {
    return getPreviewContent(value);
  }
  if (valueType === '[object Object]') {
    return value;
  }
  return '';
};


export const isValidCellValue = (value) => {
  if (value === undefined) return false;
  if (value === null) return false;
  if (value === '') return false;
  if (JSON.stringify(value) === '{}') return false;
  if (JSON.stringify(value) === '[]') return false;
  return true;
};

export const getTwoDimensionArrayValue = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (Object.prototype.toString.call(item) !== '[object Object]') {
        return item;
      }
      if (!Object.prototype.hasOwnProperty.call(item, 'display_value')) return item;
      const { display_value } = item;
      if (!Array.isArray(display_value) || display_value.length === 0) return display_value;
      return display_value.map(i => {
        if (Object.prototype.toString.call(i) === '[object Object]') {
          if (!Object.prototype.hasOwnProperty.call(i, 'display_value')) return i;
          const { display_value } = i;
          return display_value;
        }
        return i;
      });
    });
};

export function isArrayFormalColumn(columnType) {
  return [
    CellType.IMAGE,
    CellType.FILE,
    CellType.MULTIPLE_SELECT,
    CellType.COLLABORATOR
  ].includes(columnType);
}
