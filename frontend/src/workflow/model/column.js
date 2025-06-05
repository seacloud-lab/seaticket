import { isNumericColumn, CellType } from 'dtable-utils';
import {
  COLUMN_CONFIG_KEY,
  COLUMN_OPTIONS_SHOW_TYPE
} from '../constants';
import ObjectUtils from '../../utils/object-utils';

class Column {

  constructor(dtableColumn = {}, configColumn = {}) {
    this.name = dtableColumn.name || '';
    this.data = dtableColumn.data || {};
    this.key = dtableColumn.key || '';
    this.type = dtableColumn.type || '';

    this[COLUMN_CONFIG_KEY.DESCRIPTION] = configColumn[COLUMN_CONFIG_KEY.DESCRIPTION] || '';
    this[COLUMN_CONFIG_KEY.IS_REQUIRED] = configColumn[COLUMN_CONFIG_KEY.IS_REQUIRED] || false;

    this[COLUMN_CONFIG_KEY.SHOW_ON_CONDITION] = configColumn[COLUMN_CONFIG_KEY.SHOW_ON_CONDITION] || false;
    this[COLUMN_CONFIG_KEY.FILTER_CONJUNCTION] = configColumn[COLUMN_CONFIG_KEY.FILTER_CONJUNCTION] || 'And';
    this[COLUMN_CONFIG_KEY.FILTERS] = configColumn[COLUMN_CONFIG_KEY.FILTERS] || [];

    this[COLUMN_CONFIG_KEY.OPTIONS_SHOW_TYPE] = configColumn[COLUMN_CONFIG_KEY.OPTIONS_SHOW_TYPE] || COLUMN_OPTIONS_SHOW_TYPE.DROPDOWN;

    this[COLUMN_CONFIG_KEY.CUSTOM_NAME] = configColumn[COLUMN_CONFIG_KEY.CUSTOM_NAME] || '';

    this[COLUMN_CONFIG_KEY.ENABLE_FILL_DEFAULT_VALUE] = configColumn[COLUMN_CONFIG_KEY.ENABLE_FILL_DEFAULT_VALUE] || false;
    const defaultValue = configColumn[COLUMN_CONFIG_KEY.DEFAULT_VALUE];
    if (isNumericColumn(dtableColumn)) {
      this[COLUMN_CONFIG_KEY.DEFAULT_VALUE] = (defaultValue || defaultValue === 0) ? defaultValue : '';
    } else {
      this[COLUMN_CONFIG_KEY.DEFAULT_VALUE] = defaultValue || '';
    }
    this[COLUMN_CONFIG_KEY.ENABLE_NOT_CHANGE_DEFAULT_VALUE] = configColumn[COLUMN_CONFIG_KEY.ENABLE_NOT_CHANGE_DEFAULT_VALUE] || false;

    if (this.type === CellType.LINK) {
      this[COLUMN_CONFIG_KEY.ENABLE_ADD_NEW_RECORDS] = ObjectUtils.isObjectHasKey(configColumn, COLUMN_CONFIG_KEY.ENABLE_ADD_NEW_RECORDS) ?
        configColumn[COLUMN_CONFIG_KEY.ENABLE_ADD_NEW_RECORDS] : true;
      this[COLUMN_CONFIG_KEY.ENABLE_LINK_EXISTING_RECORDS] = ObjectUtils.isObjectHasKey(configColumn, COLUMN_CONFIG_KEY.ENABLE_LINK_EXISTING_RECORDS) ?
        configColumn[COLUMN_CONFIG_KEY.ENABLE_LINK_EXISTING_RECORDS] : true;

      this[COLUMN_CONFIG_KEY.LINK_FILTER_CONJUNCTION] = configColumn[COLUMN_CONFIG_KEY.LINK_FILTER_CONJUNCTION] || 'And';
      this[COLUMN_CONFIG_KEY.LINK_FILTERS] = configColumn[COLUMN_CONFIG_KEY.LINK_FILTERS] || [];
      this[COLUMN_CONFIG_KEY.LINK_AT_MOST_ONE_RECORD] = configColumn[COLUMN_CONFIG_KEY.LINK_AT_MOST_ONE_RECORD] || false;
      this[COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_EXISTING_LINK_BTN_NAME] = configColumn[COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_EXISTING_LINK_BTN_NAME] || false;
      this[COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_NEW_LINK_BTN_NAME] = configColumn[COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_NEW_LINK_BTN_NAME] || false;
      this[COLUMN_CONFIG_KEY.EXISTING_LINK_BTN_NAME] = configColumn[COLUMN_CONFIG_KEY.EXISTING_LINK_BTN_NAME] || '';
      this[COLUMN_CONFIG_KEY.NEW_LINK_BTN_NAME] = configColumn[COLUMN_CONFIG_KEY.NEW_LINK_BTN_NAME] || '';

      let linkVisibleFields = [];
      let linkRequiredFields = configColumn[COLUMN_CONFIG_KEY.LINK_REQUIRED_COLUMN_FIELDS] || [];
      // Compatible with old version
      const addLinkVisibleColumnFields = configColumn[COLUMN_CONFIG_KEY.LINK_VISIBLE_COLUMN_FIELDS] || [];
      const linkExistedVisibleColumnFields = configColumn[COLUMN_CONFIG_KEY.LINK_EXISTED_VISIBLE_COLUMN_FIELDS] || [];
      if (addLinkVisibleColumnFields.length > 0 && linkExistedVisibleColumnFields.length > 0) {
        linkVisibleFields = ObjectUtils.getArraysIntersection(addLinkVisibleColumnFields, linkExistedVisibleColumnFields);
      } else {
        linkVisibleFields = configColumn[COLUMN_CONFIG_KEY.LINK_VISIBLE_COLUMN_FIELDS];
      }

      // add default value "0000" for link visible column fields
      if (!Array.isArray(linkVisibleFields)) {
        linkVisibleFields = ['0000'];
      } else if (linkVisibleFields.indexOf('0000') < 0) {
        linkVisibleFields.unshift('0000');
      }
      this[COLUMN_CONFIG_KEY.LINK_VISIBLE_COLUMN_FIELDS] = linkVisibleFields;
      this[COLUMN_CONFIG_KEY.LINK_REQUIRED_COLUMN_FIELDS] = linkRequiredFields.filter(field => linkVisibleFields.includes(field));
    }
  }

}

export default Column;
