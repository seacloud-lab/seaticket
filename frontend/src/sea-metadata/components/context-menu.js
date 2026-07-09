import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DropdownItem } from 'reactstrap';
import PropTypes from 'prop-types';
import { getTarget } from '@/utils/dom';
import context from '@/sea-metadata/context';
import { SubDropdown, ModalPortal } from '@/components';
import { isFunction } from '@/utils/type-detection';

const ContextMenu = ({
  createContextMenuOptions,
  target,
  ignoredTriggerElements,
  ...props
}) => {
  const menuRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [subMenuKey, setSubMenuKey] = useState('');

  const options = useMemo(() => {
    if (!isFunction(createContextMenuOptions)) return [];
    return createContextMenuOptions({ ...props, hideMenu: setVisible, position, context });
  }, [props, createContextMenuOptions, position]);

  const hideSubMenu = useCallback(() => {
    setIsSubOpen(false);
    setSubMenuKey('');
  }, []);

  const handleHide = useCallback((event) => {
    if (menuRef.current && menuRef.current.contains(event.target)) return;
    setVisible(false);
    hideSubMenu();
  }, [menuRef, hideSubMenu]);

  const onSubMenuToggle = useCallback((event, subMenu) => {
    event && event.stopPropagation();
    event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setIsSubOpen(!isSubOpen);
    setSubMenuKey(subMenu?.key || '');
  }, [isSubOpen]);

  const openSubMenu = useCallback((event, subMenu) => {
    event && event.stopPropagation();
    event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setSubMenuKey(subMenu.key);
    setIsSubOpen(true);
  }, []);

  const getMenuPosition = useCallback((x = 0, y = 0) => {
    let menuStyles = {
      top: y,
      left: x
    };
    if (!menuRef.current) {
      const indent = 10;
      const menuMargin = 20;
      const menuDefaultWidth = 200;
      const dividerHeight = 16;
      const optionHeight = 32;
      const menuDefaultHeight = options.reduce((total, option) => {
        if (option === 'Divider') return total + dividerHeight;
        return total + optionHeight;
      }, menuMargin + indent);
      if (menuStyles.left + menuDefaultWidth + indent > window.innerWidth) {
        menuStyles.left = window.innerWidth - menuDefaultWidth - indent;
      }
      if (menuStyles.top + menuDefaultHeight > window.innerHeight) {
        menuStyles.top = window.innerHeight - menuDefaultHeight;
      }
      return menuStyles;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const targetDom = target ? getTarget(target) : document.body;
    const boundaryCoordinates = targetDom.getBoundingClientRect();
    const { right: boundaryRight, bottom: boundaryBottom } = boundaryCoordinates || {};

    if (y + rect.height > boundaryBottom - 10) {
      menuStyles.top -= rect.height;
    }
    if (x + rect.width > boundaryRight) {
      menuStyles.left -= rect.width;
    }
    if (menuStyles.top < 0) {
      menuStyles.top = rect.bottom > boundaryBottom ? (boundaryBottom - 10 - rect.height) / 2 : 0;
    }
    if (menuStyles.left < 0) {
      menuStyles.left = rect.width < boundaryRight ? (boundaryRight - rect.width) / 2 : 0;
    }
    return menuStyles;
  }, [target, options]);

  const handleOptionClick = useCallback((event, option) => {
    event.stopPropagation();
    event.preventDefault();
    option && option.callback && option.callback();
    // Use setTimeout to ensure the click handler executes before hiding
    setTimeout(() => {
      setVisible(false);
      hideSubMenu();
    }, 0);
  }, [hideSubMenu]);

  const handleMainMenuMouseMove = useCallback((e) => {
    if (isSubOpen && e.target && e.target.className.includes('dropdown-item')) {
      hideSubMenu();
    }
  }, [isSubOpen, hideSubMenu]);

  useEffect(() => {
    const handleShow = (event) => {
      event.preventDefault();
      if (menuRef.current && menuRef.current.contains(event.target)) return;

      if (ignoredTriggerElements && !ignoredTriggerElements.some(target => event.target.closest(target))) {
        return;
      }

      setVisible(true);
      const position = getMenuPosition(event.clientX, event.clientY);
      setPosition(position);
    };

    const targetDom = target ? getTarget(target) : document;
    targetDom && targetDom.addEventListener('contextmenu', handleShow);
    return () => {
      targetDom && targetDom.removeEventListener('contextmenu', handleShow);
    };
  }, [target, getMenuPosition, ignoredTriggerElements]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('mousedown', handleHide);
    } else {
      document.removeEventListener('mousedown', handleHide);
    }
    return () => {
      document.removeEventListener('mousedown', handleHide);
    };
  }, [visible, handleHide]);

  if (!visible || options.length === 0) return null;

  return (
    <ModalPortal>
      <div className="dropdown-menu seaqa-dropdown-menu d-block" style={position} ref={menuRef}>
        {options.map((option, index) => {
          if (option === 'Divider') {
            return <DropdownItem key={index} divider />;
          }
          if (option.children) {
            return (
              <SubDropdown
                key={index}
                isOpen={isSubOpen && subMenuKey === option.key}
                menu={option}
                onShow={openSubMenu}
                onToggle={onSubMenuToggle}
              />
            );
          }
          return (
            <button
              key={index}
              className="dropdown-item"
              onClick={(event) => handleOptionClick(event, option)}
              onMouseMove={handleMainMenuMouseMove}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </ModalPortal>
  );
};

ContextMenu.propTypes = {
  createContextMenuOptions: PropTypes.func,
  ignoredTriggerElements: PropTypes.array,
  target: PropTypes.any,
};

export default ContextMenu;
