import { CellType } from 'dtable-utils';
import {
  BACKGROUND,
  FIT_MAP,
  FONT,
  IMAGE_DISPLAY_TYPE,
  STATIC_CELL_TYPE,
  IMAGE_SIZING,
  DEFAULT_LANGUAGE,
  HORIZONTAL_ALIGN,
  VERTICAL_ALIGN,
  LINK_TABLE,
  TABLE_TYPES,
  PAGE_HEADER_FOOTER_TYPES,
  TABLE_ROW_HEIGHT_TYPE,
} from '../constants';
import { getTableValidRowHeight, geTableWidgetRowHeightValue } from './widget-utils';
import { getFormatProperties } from './common-utils';
import { isMac } from '../../utils/utils';

const isHasProperty = (property, obj) => {
  return Object.keys(obj).indexOf(property) > -1;
};

const getBorderWidth = (borders, width) => {
  const { left, right, top, bottom } = borders;
  const newWidth = width + 'px';
  return `
    ${top ? newWidth : 0} ${right ? newWidth : 0} ${bottom ? newWidth : 0} ${left ? newWidth : 0}
  `;
};

export const getWidgetContainerStyle = (widget, scalingRatio = 1) => {
  const { layout_data } = widget;
  const { x, y, rotation, width, height, zIndex } = layout_data;
  return {
    position: 'absolute',
    transform: `translate(${x * scalingRatio}px, ${y * scalingRatio}px) rotate(${rotation}deg)`,
    transformOrigin: '0 0',
    // top: layout_data.y,
    // left: layout_data.x,
    width: width * scalingRatio,
    height: height * scalingRatio,
    zIndex: zIndex
  };
};

export const updateFontStyle = (style, configData) => {
  const font = 'font';
  if (isHasProperty(font, configData)) {
    const fontFamily = 'fontFamily';
    const fontSize = 'fontSize';
    const fontWeight = 'fontWeight';
    const lineHeight = 'lineHeight';
    const selectFont = configData[font];
    const configFontWeight = configData[fontWeight];
    const fontObject = FONT.find(item => item.name === selectFont) || {};
    const { UsuallyFontFamilyName, supportFontWeight, fontFamilyName } = fontObject;
    const selectFontWeight = supportFontWeight.find(item => item === configFontWeight) ? configFontWeight : supportFontWeight[0];
    loadFontContent(fontObject, selectFontWeight);
    const fontName = fontFamilyName && isMac() ? fontFamilyName['mac'] : selectFont;
    const lang = window.app && window.app.config && window.app.config.lang ? window.app.config.lang : DEFAULT_LANGUAGE;
    style[fontFamily] = `${fontName}, ${lang === DEFAULT_LANGUAGE ? '\u5b8b\u4f53' : 'Arial'}, ${UsuallyFontFamilyName || 'sans-serif'}`;
    style[fontSize] = configData[fontSize];
    style[fontWeight] = selectFontWeight;
    style[lineHeight] = configData[lineHeight];
  }
};

const updateHorizontalAlignStyle = (style, configData) => {
  const horizontalAlign = 'horizontalAlign';
  if (isHasProperty(horizontalAlign, configData)) {
    const verticalAlign = 'verticalAlign';
    const validHorizontalAlign = getFormatProperties(configData[horizontalAlign]);
    const validVerticalAlign = getFormatProperties(configData[verticalAlign]);
    style['textAlign'] = validHorizontalAlign;
    style['display'] = 'flex';
    style['justifyContent'] = 'flex-start';
    style['alignItems'] = 'flex-start';
    if (validHorizontalAlign === HORIZONTAL_ALIGN[1]) {
      style['justifyContent'] = 'center';
    } else if (validHorizontalAlign === HORIZONTAL_ALIGN[2]) {
      style['justifyContent'] = 'flex-end';
    }
    if (validVerticalAlign === VERTICAL_ALIGN[1]) {
      style['alignItems'] = 'center';
    } else if (validVerticalAlign === VERTICAL_ALIGN[2]) {
      style['alignItems'] = 'flex-end';
    }
  }
};

const updateTextColorStyle = (style, configData) => {
  const textColor = 'textColor';
  if (isHasProperty(textColor, configData)) {
    style['color'] = configData[textColor];
  }
};

export const updateBackgroundColorStyle = (style, configData) => {
  const background = 'background';
  if (isHasProperty(background, configData)) {
    const backgroundColor = 'backgroundColor';
    if (getFormatProperties(configData[background]) === BACKGROUND[1]) {
      style[backgroundColor] = configData[backgroundColor];
    } else {
      style[backgroundColor] = configData[background];
    }
  }
};

const updatePaddingStyle = (style, configData) => {
  const padding = 'padding';
  if (isHasProperty(padding, configData)) {
    style[padding] = configData[padding];
  }
};

const updateBordersStyle = (style, configData) => {
  const borders = 'borders';
  if (isHasProperty(borders, configData)) {
    const borderStyle = 'borderStyle';
    const borderWidth = 'borderWidth';
    style[borderStyle] = 'solid';
    style[borderWidth] = getBorderWidth(configData[borders], configData[borderWidth]);
  }
};

const updateBorderRadiusStyle = (style, configData) => {
  const borderRadius = 'borderRadius';
  if (isHasProperty(borderRadius, configData)) {
    const borderRadius = 'borderRadius';
    style[borderRadius] = configData[borderRadius];
  }
};

export const updateBorderColorStyle = (style, configData) => {
  const borderColor = 'borderColor';
  if (isHasProperty(borderColor, configData)) {
    style[borderColor] = configData[borderColor];
  }
};

export const getTableWidgetStyle = (widget) => {
  const { config_data, type } = widget;
  if (!TABLE_TYPES.includes(type)) return {};
  const configData = config_data || {};
  let titleStyle = {};
  let rowFontStyle = {};
  let cellStyle = {};
  let rowStyle = {};
  let firstRowStyle = {};
  let lastRowStyle = {};
  let firstCellStyle = {};
  let lastCellStyle = {};

  const titleStyleConfig = configData['titleStyle'] || {};
  const { is_show = true, background = BACKGROUND[1], background_color = '#f0f0f0' } = titleStyleConfig;
  updateFontStyle(titleStyle, titleStyleConfig);
  const titleHeight = getTableValidRowHeight(titleStyleConfig['rowHeight']);
  titleStyle['titleHeight'] = titleHeight;

  // background color
  const backgroundColor = background === BACKGROUND[0] ? 'transparent' : background_color;
  titleStyle['backgroundColor'] = backgroundColor;

  if (!is_show) {
    titleStyle['borderBottom'] = 'none';
  }

  const rowStyleConfig = configData['rowStyle'] || {};
  updateFontStyle(rowFontStyle, rowStyleConfig);

  const rowHeight = getTableValidRowHeight(rowStyleConfig['rowHeight']);
  const rowHeightValue = geTableWidgetRowHeightValue(rowStyleConfig);
  rowStyle['rowHeight'] = rowHeight;
  rowStyle['rowHeightValue'] = rowHeightValue;

  if (rowHeight === TABLE_ROW_HEIGHT_TYPE.AUTO) {
    if (!is_show) {
      titleStyle['height'] = 0;
    } else {
      titleStyle['minHeight'] = 32;
    }
    titleStyle['titleHeight'] = TABLE_ROW_HEIGHT_TYPE.AUTO;
  } else {
    const titleHeight = getTableValidRowHeight(titleStyleConfig['rowHeight']);
    const titleHeightValue = geTableWidgetRowHeightValue(titleStyleConfig);
    titleStyle['titleHeight'] = titleHeight;
    titleStyle['height'] = is_show ? titleHeightValue + 1 : 0;
  }

  const borderStyleConfig = configData['border'] || {};
  const { outside, horizontal, vertical } = borderStyleConfig;
  if (!vertical['hide']) {
    cellStyle['borderRight'] = `${vertical.width}px solid ${vertical.color}`;
  }
  if (!horizontal['hide']) {
    rowStyle['borderBottom'] = `${horizontal.width}px solid ${horizontal.color}`;
  }
  if (!outside['hide']) {
    firstRowStyle['borderTop'] = `${outside.width}px solid ${outside.color}`;
    lastRowStyle['borderBottom'] = `${outside.width}px solid ${outside.color}`;
    firstCellStyle['borderLeft'] = `${outside.width}px solid ${outside.color}`;
    lastCellStyle['borderRight'] = `${outside.width}px solid ${outside.color}`;
  }

  return {
    titleStyle,
    rowFontStyle,
    rowStyle,
    cellStyle,
    firstRowStyle,
    lastRowStyle,
    firstCellStyle,
    lastCellStyle
  };
};

export const getWidgetStyle = (widget) => {
  let style = {};
  const { config_data, type } = widget;
  if (type === LINK_TABLE) return {};
  if (PAGE_HEADER_FOOTER_TYPES.includes(type)) return {};

  updateFontStyle(style, config_data);
  updateHorizontalAlignStyle(style, config_data);
  updateTextColorStyle(style, config_data);
  updateBackgroundColorStyle(style, config_data);
  updatePaddingStyle(style, config_data);
  updateBordersStyle(style, config_data);
  updateBorderRadiusStyle(style, config_data);
  updateBorderColorStyle(style, config_data);
  return style;
};

export const getDeleteWidgetWidget = (widget) => {
  let style = {
    'display': 'flex',
    'justifyContent': 'center',
    'alignItems': 'center',
    'backgroundColor': 'rgb(221, 221, 221)',
    'borderRadius': '3'
  };
  const { config_data } = widget;
  const font = 'font';
  if (isHasProperty(font, config_data)) {
    const fontFamily = 'fontFamily';
    const fontSize = 'fontSize';
    const fontWeight = 'fontWeight';
    const lineHeight = 'lineHeight';
    const selectFont = config_data[font];
    const configFontWeight = config_data[fontWeight];
    const fontObject = FONT.find(item => item.name === selectFont) || {};
    const { UsuallyFontFamilyName, supportFontWeight, fontFamilyName } = fontObject;
    const selectFontWeight = supportFontWeight.find(item => item === configFontWeight) ? configFontWeight : supportFontWeight[0];
    const fontName = fontFamilyName && isMac() ? fontFamilyName['mac'] : selectFont;
    const lang = window.app && window.app.config && window.app.config.lang ? window.app.config.lang : DEFAULT_LANGUAGE;
    style[fontFamily] = `${fontName}, ${lang === DEFAULT_LANGUAGE ? '\u5b8b\u4f53' : 'Arial'}, ${UsuallyFontFamilyName || 'sans-serif'}`;
    style[fontFamily] = `${selectFont}, ${lang === DEFAULT_LANGUAGE ? '\u5b8b\u4f53' : 'Arial'}, ${UsuallyFontFamilyName || 'sans-serif'}`;
    style[fontSize] = config_data[fontSize];
    style[fontWeight] = selectFontWeight;
    style[lineHeight] = config_data[lineHeight];
  }

  return style;
};

export const getImageStyle = (widget, column, scalingRatio = 1) => {
  const { config_data, layout_data } = widget;
  const { height, width } = layout_data;
  const { fitMode = 'fitMode', display, imagePadding, imageSize, sizing } = config_data;
  const { type } = column;

  if (type === STATIC_CELL_TYPE.STATIC_IMAGE || type === CellType.DIGITAL_SIGN || display === IMAGE_DISPLAY_TYPE[0]) {
    return {
      height: height * scalingRatio,
      width: width * scalingRatio,
      pointerEvents: 'none',
      objectFit: FIT_MAP[fitMode],
    };
  }
  const baseStyle = {
    marginRight: imagePadding,
    marginBottom: imagePadding,
    pointerEvents: 'none',
    objectFit: 'cover',
  };

  const validSizing = getFormatProperties(sizing);
  switch (validSizing) {
    case IMAGE_SIZING[0]: {
      return Object.assign({}, baseStyle, {
        width: imageSize * scalingRatio,
        height: imageSize * scalingRatio }
      );
    }
    case IMAGE_SIZING[1]: {
      return Object.assign({}, baseStyle, {
        width: 'auto',
        height: imageSize * scalingRatio
      });
    }
    case IMAGE_SIZING[2]: {
      return Object.assign({}, baseStyle, {
        width: imageSize * scalingRatio,
        height: 'auto'
      });
    }
    default: {
      return baseStyle;
    }
  }
};

const loadFontContent = (fontObject = {}, fontWeight) => {
  const { name, isSystemOwn } = fontObject;
  if (isSystemOwn) return;
  let nameString = name.split(' ').join('+');
  const fontLinkId = `font-link-${nameString}-${fontWeight}`;
  if (document.getElementById(fontLinkId)) return;
  const href = `https://fonts.googleapis.com/css?family=${nameString}:${fontWeight}`;
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = href;
  fontLink.id = fontLinkId;
  fontLink.className = 'seatable-page-design-font';
  document.body.appendChild(fontLink);
};
