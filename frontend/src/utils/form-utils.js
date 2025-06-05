import { CellType, FORMULA_COLUMN_TYPES } from 'dtable-utils';
import {
  FORM_SUPPORT_EDIT_TYPE,
  FORM_ELEMENTS_TYPE,
  FORM_THEME_TYPE,
  FORM_THEME_COLORS,
  FORM_THEME_BACKGROUND_COLOR,
  DEFAULT_FORM_BACKGROUND_COLOR,
} from '../constants/form-constants';

export const getSaveableColumnAttributes = (column) => {
  const { key, custom_name, is_required, description, filters, show_on_condition, filter_conjunction, options_show_type, type,
    enable_fill_default_value, default_value, enable_not_change_default_value, enable_scan_code_entry, require_fill_checked } = column;
  const attributes = {
    key,
    custom_name,
    is_required,
    description,
    filters,
    show_on_condition,
    filter_conjunction,
    enable_fill_default_value,
    default_value,
    enable_not_change_default_value,
    require_fill_checked: require_fill_checked || false,
    enable_scan_code_entry: enable_scan_code_entry || false,
  };
  if (type === CellType.SINGLE_SELECT || type === CellType.MULTIPLE_SELECT) {
    return Object.assign({}, attributes, { options_show_type });
  }
  return attributes;
};

export const getDefaultColumnAttributes = (column) => {
  if (!column) return {};
  const { key, name, type, data } = column;

  // newly added column, editable is false
  return { key, name, custom_name: '', type, data, is_required: false, description: '', filters: [], editable: false, filter_conjunction: 'And' };
};

export const getFormConfigColumns = (columns, oldColumnsMap = {}) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  return columns.map(column => {
    const defaultColumnAttributes = getDefaultColumnAttributes(column);
    return Object.assign({}, defaultColumnAttributes, oldColumnsMap[column.key]);
  });
};

export const getFormSupportColumns = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  return columns.filter(column => FORM_SUPPORT_EDIT_TYPE.includes(column.type));
};

export const getFormConfigColumnsByTable = (table) => {
  if (!table) return [];
  const { columns } = table;
  const validColumns = getFormSupportColumns(columns);
  let oldColumnsMap = {};
  validColumns.forEach(column => {
    const { key } = column;
    oldColumnsMap[key] = { editable: false };
  });
  return getFormConfigColumns(validColumns, oldColumnsMap);
};

export const getUpdatedFormConfig = (oldFormConfig, updated) => {
  const { currentColumns, remarkContent, isRemarkContentShow, tableId, notification, formName, topRemarkContent,
    isTopRemarkContentShow, successMessage, isSuccessMessageShow, successRedirect, isSuccessRedirectShow, logoURL,
    submitDeadline, isSubmitDeadlineShow, isHidePoweredBy, themeType, themeBackgroundColor, themeBackgroundImageURL,
    isTriggerWorkflow, workflowToken, elementsOrder, staticElements, isSetAllFieldsRequired, shareFormLinks,
    formColumnDescriptionColor
  } = updated;
  const saveCurrentColumns = currentColumns.filter(item => item.editable);
  const columns = saveCurrentColumns.map(column => {
    return getSaveableColumnAttributes(column);
  });
  const validElementsOrder = getValidElementsOrder(columns, elementsOrder);
  const update = {
    columns,
    table_id: tableId,
    logo_url: logoURL,
    form_name: formName,
    remarkOption: { isRemarkContentShow, remarkContent },
    notification_config: notification,
    top_remark_option: { is_top_remark_content_show: isTopRemarkContentShow, top_remark_content: topRemarkContent },
    success_message_option: { is_success_message_show: isSuccessMessageShow, success_message: successMessage },
    trigger_workflow_option: { is_trigger_workflow: isTriggerWorkflow, workflow_token: workflowToken },
    success_redirect_option: { is_success_redirect_show: isSuccessRedirectShow, success_redirect: successRedirect },
    submit_deadline_option: { is_submit_deadline_show: isSubmitDeadlineShow, submit_deadline: submitDeadline },
    powered_by_option: { isHidePoweredBy },
    theme_type: themeType,
    theme_background_color: themeBackgroundColor,
    theme_background_image_url: themeBackgroundImageURL,
    elements_order: validElementsOrder,
    static_elements: staticElements,
    form_column_description_color: formColumnDescriptionColor,
    share_form_links: shareFormLinks,
    is_set_all_fields_required: isSetAllFieldsRequired
  };
  const config = oldFormConfig;
  return Object.assign({}, config, update);
};

// If the base columns had been deleted, the elementsOrder also need to update
export const getValidElementsOrder = (columns, elementsOrder) => {
  if (elementsOrder.length === 0) return elementsOrder;
  let validElementsOrder = elementsOrder.slice(0);
  const columnKeys = columns.map(column => column.key);
  validElementsOrder.forEach(element => {
    const { key } = element;
    if (element.type === FORM_ELEMENTS_TYPE.COLUMN && !columnKeys.includes(key)) {
      validElementsOrder = validElementsOrder.filter(item => item.key !== key);
    }
  });
  return validElementsOrder;
};

export const getFormSubmitLinkByToken = (dtableWebURL, token) => {
  let slicedTableWebURL = dtableWebURL;
  if (slicedTableWebURL.charAt(slicedTableWebURL.length - 1) === '/') {
    slicedTableWebURL = slicedTableWebURL.slice(0, slicedTableWebURL.length - 1);
  }
  return `${slicedTableWebURL}/dtable/forms/${token}/`;
};

export const getThemeBackgroundColorByFormConfig = (formConfig) => {
  const { theme_type, theme_background_color } = formConfig || {};
  if (theme_type === FORM_THEME_TYPE.IMAGE) return DEFAULT_FORM_BACKGROUND_COLOR;
  const colorKey = theme_background_color || FORM_THEME_COLORS[0];
  return FORM_THEME_BACKGROUND_COLOR[colorKey];
};

export const getThemeBackgroundDisplay = (themeType, themeBackgroundColor, themeBackgroundImageURL) => {
  if (themeType === FORM_THEME_TYPE.IMAGE) return themeBackgroundImageURL;
  const color = themeBackgroundColor || FORM_THEME_COLORS[0];
  return `#${color}`;
};

export const getThemeBackgroundColor = (themeType, themeBackgroundColor) => {
  if (themeType === FORM_THEME_TYPE.COLOR) {
    const colorKey = themeBackgroundColor || FORM_THEME_COLORS[0];
    return FORM_THEME_BACKGROUND_COLOR[colorKey];
  }
  return DEFAULT_FORM_BACKGROUND_COLOR;
};

export const getThemeBackground = (themeType, themeBackgroundColor, themeBackgroundImageURL) => {
  if (themeType === FORM_THEME_TYPE.COLOR) {
    const colorKey = themeBackgroundColor || FORM_THEME_COLORS[0];
    return {
      mainBackground: FORM_THEME_BACKGROUND_COLOR[colorKey],
      themeBackground: `#${colorKey}`,
    };
  }
  return {
    mainBackground: DEFAULT_FORM_BACKGROUND_COLOR,
    themeBackground: themeBackgroundImageURL,
  };
};

export const getValidColumns = (columns, elementsOrder) => {
  const columnKeys = elementsOrder.filter(element => element.type === FORM_ELEMENTS_TYPE.COLUMN).map(item => item.key);
  if (!columnKeys || columnKeys.length === 0) return [];
  const validColumns = columns.filter(column => {
    const { type, key } = column;
    if (type === CellType.LINK || FORMULA_COLUMN_TYPES.includes(type)) {
      return false;
    }
    return columnKeys.includes(key);
  });
  return validColumns;
};

export const getShareFormLinks = (shareFormLinks) => {
  if (shareFormLinks.length === 0) return [];
  return shareFormLinks.map((linkItem) => {
    if (typeof linkItem === 'string') {
      let newLinkItem = {};
      newLinkItem.value = linkItem;
      newLinkItem.name = '';
      newLinkItem.create_time = '';
      return newLinkItem;
    } else {
      return linkItem;
    }
  });
};

export const getEmptyFieldItems = (fieldItemsList, columns) => {
  const emptyFieldItems = fieldItemsList.filter((item) => {
    const column = columns.find(column => column.key === item.column_key);
    if (column && column.type === CellType.CHECKBOX) return false;
    return !item.value || (Array.isArray(item.value) && item.value.length === 0);
  });
  return emptyFieldItems;
};

export const getSearchParams = (link) => {
  const url = new URL(link);
  const search = url.search;
  if (!search) return null;
  const paramValueIndex = search.indexOf('?');
  const validPreFillString = search.slice(paramValueIndex + 1);
  const searchParams = new URLSearchParams(validPreFillString);
  return searchParams;
};

export const getPresetContent = (fieldItemsList, columns) => {
  let presetContent = '';
  fieldItemsList.forEach(item => {
    const { column_key: columnKey, value, permission } = item;
    const column = columns.find(column => column.key === columnKey);
    if ((!column || (!value && (column.type !== CellType.CHECKBOX))) && permission !== 'hidden') return;
    const result = value.toString();
    const permissionValue = permission === 'rw' ? 'prefill' : permission === 'hidden' ? 'prefillHide' : 'prefillForce';
    const path = (permissionValue === 'prefillHide' && result === '' ) ? `${permissionValue}_${encodeURIComponent(column.name)}` : `${permissionValue}_${encodeURIComponent(column.name)}=${encodeURIComponent(result)}`;
    presetContent += `${presetContent ? '&' : ''}${path}`;
  });
  return presetContent;
};

