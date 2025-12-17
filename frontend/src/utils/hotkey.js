import isHotkey from 'is-hotkey';

const isModS = isHotkey('mod+s');
const isModZ = isHotkey('mod+z');
const isModL = isHotkey('mod+l');
const isModF = isHotkey('mod+f');
const isModP = isHotkey('mod+p');
const isModG = isHotkey('mod+g');
const isModDot = isHotkey('mod+.');
const isModComma = isHotkey('mod+,');
const isModSlash = isHotkey('mod+/');
const isModBackslash = isHotkey('mod+\'');
const isModSemicolon = isHotkey('mod+;');
const isModUp = isHotkey('mod+up');
const isModDown = isHotkey('mod+down');
const isModLeft = isHotkey('mod+left');
const isModRight = isHotkey('mod+right');
const isModShiftZ = isHotkey('mod+shift+z');
const isModShiftG = isHotkey('mod+shift+g');
const isModShiftDot = isHotkey('mod+shift+.');
const isModShiftComma = isHotkey('mod+shift+,');
const isShiftEnter = isHotkey('shift+enter');
const isModEnter = isHotkey('mod+enter');
const isSpace = isHotkey('space');
const isShiftModEnter = isHotkey('shift+mod+enter');
const isOptPageUp = isHotkey('opt+pageup');
const isOptPageDown = isHotkey('opt+pagedown');
const isEnter = isHotkey('enter');
const isEsc = isHotkey('esc');
const isTab = isHotkey('tab');
const isUpArrow = isHotkey('arrowup');
const isDownArrow = isHotkey('arrowdown');
const isP = isHotkey('p'); // rate setting
const isA = isHotkey('a'); // collaborators setting
const isT = isHotkey('t'); // tags setting
const isS = isHotkey('s'); // state setting
const isShiftS = isHotkey('shift+s'); // sub state setting
const isShiftT = isHotkey('shift+t'); // type setting

export { isModS, isModZ, isModL, isModF, isModP, isModG, isModDot, isModComma, isModUp, isModDown, isModLeft, isModRight,
  isShiftEnter, isModSlash, isModBackslash, isModSemicolon, isSpace, isEnter, isEsc, isOptPageDown, isOptPageUp, isShiftModEnter,
  isModShiftZ, isModShiftG, isModShiftDot, isModShiftComma, isModEnter, isTab, isUpArrow, isDownArrow,
  isP, isA, isT, isS, isShiftS, isShiftT
};
