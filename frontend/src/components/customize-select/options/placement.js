const VIEWPORT_PADDING = 10;
const MAX_MENU_HEIGHT = 300;

export const getMenuPlacement = ({ position, viewportHeight, offset, menuHeight, isFlipped, keepFlipped }) => {
  const spaceAbove = Math.max(0, position.top - offset - VIEWPORT_PADDING);
  const spaceBelow = Math.max(0, viewportHeight - position.bottom - offset - VIEWPORT_PADDING);
  const shouldFlip = (keepFlipped && isFlipped) || (menuHeight > spaceBelow && spaceAbove > spaceBelow);

  return {
    isFlipped: shouldFlip,
    maxHeight: Math.min(shouldFlip ? spaceAbove : spaceBelow, MAX_MENU_HEIGHT),
  };
};
