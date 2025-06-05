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
const isShiftEnter = isHotkey('shift+enter');
const isSpace = isHotkey('space');
const isEnter = isHotkey('enter');
const isEsc = isHotkey('esc');

export { isModS, isModZ, isModL, isModF, isModP, isModG, isModDot, isModComma, isModUp, isModDown, isModLeft, isModRight,
  isShiftEnter, isModSlash, isModBackslash, isModSemicolon, isSpace, isEnter, isEsc };
