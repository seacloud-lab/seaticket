const SERIF = 'serif';
const SANS_SERIF = 'sans-serif';
const CURSIVE = 'cursive';
const MONOSPACE = 'monospace';

// font weight
const FONT_WEIGHT_100_TO_700 = [100, 200, 300, 400, 500, 600, 700];
// const FONT_WEIGHT_100_TO_800 = [100, 200, 300, 400, 500, 600, 700, 800];

const FONT_WEIGHT_200_TO_700 = [200, 300, 400, 500, 600, 700];
const FONT_WEIGHT_200_TO_800 = [200, 300, 400, 500, 600, 700, 800];
const FONT_WEIGHT_200_TO_900 = [200, 300, 400, 500, 600, 700, 800, 900];

const FONT_WEIGHT_300_TO_700 = [300, 400, 500, 600, 700];
const FONT_WEIGHT_300_TO_800 = [300, 400, 500, 600, 700, 800];
const FONT_WEIGHT_300_TO_900 = [300, 400, 500, 600, 700, 800, 900];

const FONT_WEIGHT_400_TO_700 = [400, 500, 600, 700];
const FONT_WEIGHT_400_TO_800 = [400, 500, 600, 700, 800];
const FONT_WEIGHT_400_TO_900 = [400, 500, 600, 700, 800, 900];

// 400 and odd
const FONT_WEIGHT_400_AND_ODD = [100, 300, 400, 500, 700, 900];

// system font weight
const FONT_WEIGHT_400_700 = [400, 700];
const FONT_WEIGHT_100_400_700 = [100, 400, 700];
const FONT_WEIGHT_100_400_700_800 = [100, 400, 700, 800];

export const BACKGROUND = ['transparent', 'filled'];
export const DEFAULT_TABLE_HEADER_BACKGROUND_COLOR = '#f0f0f0';
export const FIT_MODE = ['fit', 'fill', 'stretch'];
export const FIT_MAP = {
  [FIT_MODE[0]]: 'contain',
  [FIT_MODE[1]]: 'cover',
  [FIT_MODE[2]]: 'fill'
};
export const HORIZONTAL_ALIGN = ['left', 'center', 'right'];
export const VERTICAL_ALIGN = ['top', 'middle', 'bottom'];
export const FONT_WEIGHT = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const FONT = [
  { name: 'Arial', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Arimo', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Assistant', supportFontWeight: FONT_WEIGHT_200_TO_800, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Bitter', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SERIF },
  { name: 'Cabin', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Catamaran', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Caveat', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: CURSIVE },
  { name: 'Cinzel', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SERIF },
  { name: 'Changa', supportFontWeight: FONT_WEIGHT_200_TO_800, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Comfortaa', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: CURSIVE },
  { name: 'Comic Sans MS', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Crimson Text', supportFontWeight: FONT_WEIGHT_300_TO_900, UsuallyFontFamilyName: SERIF },
  { name: 'Cuprum', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Dancing Script', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: CURSIVE },
  { name: 'Domine', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Dosis', supportFontWeight: FONT_WEIGHT_200_TO_800, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'EB Garamond', supportFontWeight: FONT_WEIGHT_400_TO_800, UsuallyFontFamilyName: SERIF },
  { name: 'Encode Sans', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Exo', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Exo 2', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Faustina', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Garamond', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Georgia', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Heebo', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Helvetica', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Helvetica', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Inconsolata', supportFontWeight: FONT_WEIGHT_200_TO_900, UsuallyFontFamilyName: MONOSPACE },
  { name: 'Inter', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Karla', supportFontWeight: FONT_WEIGHT_200_TO_800, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Kreon', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Lemonada', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: CURSIVE },
  { name: 'Libre Franklin', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Liu Jian Mao Cao', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'Long Cang', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'Lora', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Lucida Family', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Josefin Sans', supportFontWeight: FONT_WEIGHT_100_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Josefin Slab', supportFontWeight: FONT_WEIGHT_100_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Jura', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Manuale', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Markazi Text', supportFontWeight: FONT_WEIGHT_400_TO_700, UsuallyFontFamilyName: SERIF },
  { name: 'Maven Pro', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Ma Shan Zheng', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'Merriweather Sans', supportFontWeight: FONT_WEIGHT_300_TO_800, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Noto Sans HK', supportFontWeight: FONT_WEIGHT_400_AND_ODD, UsuallyFontFamilyName: SANS_SERIF }, // Chinese Hong Kong
  { name: 'Noto Sans SC', supportFontWeight: FONT_WEIGHT_400_AND_ODD, UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'Noto Sans TC', supportFontWeight: FONT_WEIGHT_400_AND_ODD, UsuallyFontFamilyName: SANS_SERIF }, // traditional Chinese
  { name: 'Noto Serif SC', supportFontWeight: [200, 300, 400, 500, 600, 700, 900], UsuallyFontFamilyName: SERIF }, // Simplified Chinese
  { name: 'Noto Serif TC', supportFontWeight: [200, 300, 400, 500, 600, 700, 900], UsuallyFontFamilyName: SERIF }, // traditional Chinese
  { name: 'Orbitron', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Oswald', supportFontWeight: FONT_WEIGHT_200_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Petrona', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SERIF },
  { name: 'Playfair Display', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SERIF },
  { name: 'Podkova', supportFontWeight: FONT_WEIGHT_400_TO_800, UsuallyFontFamilyName: SERIF },
  { name: 'Quicksand', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Raleway', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Roboto Mono', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: MONOSPACE },
  { name: 'Roboto Slab', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SERIF },
  { name: 'Rokkitt', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SERIF },
  { name: 'Rosario', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Rubik', supportFontWeight: FONT_WEIGHT_300_TO_900, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Ruda', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Saira', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Signika', supportFontWeight: FONT_WEIGHT_300_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Tahoma', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Times New Roman', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Verdana', supportFontWeight: FONT_WEIGHT_400_700, isSystemOwn: true, UsuallyFontFamilyName: SERIF },
  { name: 'Vollkorn', supportFontWeight: FONT_WEIGHT_400_TO_900, UsuallyFontFamilyName: SERIF },
  { name: 'Work Sans', supportFontWeight: FONT_WEIGHT, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'Yanone Kaffeesatz', supportFontWeight: FONT_WEIGHT_200_TO_700, UsuallyFontFamilyName: SANS_SERIF },
  { name: 'ZCOOL KuaiLe', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'ZCOOL QingKe HuangYou', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'ZCOOL XiaoWei', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: 'Zhi Mang Xing', supportFontWeight: [400], UsuallyFontFamilyName: SANS_SERIF }, // Simplified Chinese
  { name: '\u5fae\u8f6f\u96c5\u9ed1', fontFamilyName: { mac: 'Microsoft YaHei', windows: '\u5fae\u8f6f\u96c5\u9ed1' }, supportFontWeight: FONT_WEIGHT_100_400_700, isSystemOwn: true, UsuallyFontFamilyName: SANS_SERIF }, // 微软雅黑
  { name: '\u5b8b\u4f53', fontFamilyName: { mac: 'SimSun', windows: '\u5b8b\u4f53' }, supportFontWeight: FONT_WEIGHT_100_400_700_800, isSystemOwn: true, UsuallyFontFamilyName: SERIF }, // 宋体
  { name: '\u9ed1\u4f53', fontFamilyName: { mac: 'SimHei', windows: '\u9ed1\u4f53' }, supportFontWeight: [300, 500], isSystemOwn: true, UsuallyFontFamilyName: SANS_SERIF }, // 黑体
  { name: '\u6977\u4f53', fontFamilyName: { mac: 'KaiTi', windows: '\u6977\u4f53' }, supportFontWeight: [400, 700, 800], isSystemOwn: true }, // 楷体
];

export const IMAGE_SIZING = [
  'square_thumbnails',
  'fixed_height_automatic_width',
  'fixed_width_automatic_height'
];

export const IMAGE_SIZING_MAP = {
  [IMAGE_SIZING[0]]: 'image_size',
  [IMAGE_SIZING[1]]: 'image_height',
  [IMAGE_SIZING[2]]: 'image_width',
};

export const PROPERTIES_TRANSLATE_MAP = {
  'transparent': 'Transparent',
  'filled': 'Filled',
  'fit': 'Fit',
  'fill': 'Fill',
  'stretch': 'Stretch',
  'left': 'Left',
  'center': 'Center',
  'right': 'Right',
  'top': 'Top',
  'middle': 'Middle',
  'bottom': 'Bottom',
  'first_image': 'First_image',
  'all_images': 'All_images',
  'square_thumbnails': 'Square_thumbnails',
  'fixed_height_automatic_width': 'Fixed_height_automatic_width',
  'fixed_width_automatic_height': 'Fixed_width_automatic_height',
  'image_size': 'Image_size',
  'image_height': 'Image_height',
  'image_width': 'Image_width'
};

export const TABLE_ROW_HEIGHT_TYPE = {
  DEFAULT: 'default',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  QUADRUPLE: 'quadruple',
  AUTO: 'auto',
  CUSTOM: 'custom',
};

export const TABLE_ROW_HEIGHT_LIST = [
  TABLE_ROW_HEIGHT_TYPE.DEFAULT,
  TABLE_ROW_HEIGHT_TYPE.DOUBLE,
  TABLE_ROW_HEIGHT_TYPE.TRIPLE,
  TABLE_ROW_HEIGHT_TYPE.QUADRUPLE,
  TABLE_ROW_HEIGHT_TYPE.AUTO,
  TABLE_ROW_HEIGHT_TYPE.CUSTOM,
];

export const TABLE_ROW_HEIGHT_VALUE_MAP = {
  [TABLE_ROW_HEIGHT_TYPE.DEFAULT]: 32,
  [TABLE_ROW_HEIGHT_TYPE.DOUBLE]: 56,
  [TABLE_ROW_HEIGHT_TYPE.TRIPLE]: 88,
  [TABLE_ROW_HEIGHT_TYPE.QUADRUPLE]: 128,
  [TABLE_ROW_HEIGHT_TYPE.AUTO]: 0,
  [TABLE_ROW_HEIGHT_TYPE.CUSTOM]: 0,
};

export const DISPLAY_TYPE = {
  LABEL: 'label',
  TEXT: 'text',
  FIRST_IMAGE: 'first_image',
  ALL_IMAGES: 'all_images',
};

export const COMMON_DISPLAYS = [
  DISPLAY_TYPE.LABEL,
  DISPLAY_TYPE.TEXT,
];

export const IMAGE_DISPLAY_TYPE = [
  DISPLAY_TYPE.FIRST_IMAGE,
  DISPLAY_TYPE.ALL_IMAGES,
];

export const COMMON_DISPLAY_LABEL_CONFIG = {
  display_as: DISPLAY_TYPE.LABEL,
  background: 'transparent',
  backgroundColor: '#ffffff',
  padding: 0,
  borders: {
    left: false,
    right: false,
    top: false,
    bottom: false
  },
  borderColor: '#000000',
  borderWidth: 1,
  borderRadius: 0
};

export const COMMON_DISPLAY_TEXT_CONFIG = {
  display_as: DISPLAY_TYPE.TEXT,
  font: 'Arial',
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 1.4,
  horizontalAlign: 'left',
  verticalAlign: 'top',
  textColor: '#000000',
  background: 'transparent',
  backgroundColor: '#ffffff',
  padding: 0,
  borders: {
    left: false,
    right: false,
    top: false,
    bottom: false
  },
  borderColor: '#000000',
  borderWidth: 1,
  borderRadius: 0
};
