import React, { useMemo, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { getType } from '@/utils/type-detection';
import ModalPortal from '../../../components/modal-portal';
import LongTextPreview from '../cell-formatter/long-text/long-text-preview';

const TextFormatter = ({ value, className, column, onClick, children: emptyFormatter }) => {
  const { is_hover_show_content } = column;

  const ref = useRef(null);
  const targetStyle = useRef({});
  const openPreviewTimer = useRef(null);
  const closePreviewTimer = useRef(null);
  const [isPreview, setPreview] = useState(false);

  const validValue = useMemo(() => {
    if (typeof value === 'number') return value + '';
    if (typeof value === 'object') return null;
    if (getType(value) === 'Boolean') return value + '';
    return value;
  }, [value]);

  const onMouseEnter = useCallback(() => {
    // in case that there is no `modal-wrapper`
    if (!document.getElementById('modal-wrapper')) return;
    openPreviewTimer.current && clearTimeout(openPreviewTimer.current);
    openPreviewTimer.current = null;
    if (!value) return;
    if (isPreview) {
      closePreviewTimer.current && clearTimeout(closePreviewTimer.current);
      closePreviewTimer.current = null;
      return;
    }
    openPreviewTimer.current = setTimeout(() => {
      targetStyle.current = ref.current ? ref.current.getBoundingClientRect() : {};
      setPreview(true);
    }, 2000);
  }, [isPreview, value, openPreviewTimer]);

  const onMouseLeave = useCallback(() => {
    openPreviewTimer.current && clearTimeout(openPreviewTimer.current);
    openPreviewTimer.current = null;
    closePreviewTimer.current = setTimeout(() => {
      if (!isPreview) return;
      setPreview(false);
    }, 2000);
  }, [isPreview, openPreviewTimer]);

  const onPreviewMouseEnter = useCallback(() => {
    closePreviewTimer.current && clearTimeout(closePreviewTimer.current);
    closePreviewTimer.current = null;
  }, [closePreviewTimer]);

  const onPreviewMouseLeave = useCallback(() => {
    if (!isPreview) return;
    setPreview(false);
  }, [isPreview]);

  if (!validValue) return emptyFormatter || null;

  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container text-formatter', className, { 'hover-decoration': column?.click } )}
      title={is_hover_show_content ? '' : validValue}
      onClick={column?.click && onClick ? onClick : () => {}}
      onMouseEnter={is_hover_show_content ? onMouseEnter : () => {}}
      onMouseLeave={is_hover_show_content ? onMouseLeave : () => {}}
      ref={ref}
    >
      {validValue}
      {isPreview && (
        <ModalPortal>
          <LongTextPreview
            value={{ text: validValue }}
            targetStyle={targetStyle.current}
            onMouseEnter={onPreviewMouseEnter}
            onMouseLeave={onPreviewMouseLeave}
          />
        </ModalPortal>
      )}
    </div>
  );
};

TextFormatter.propTypes = {
  value: PropTypes.any,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default TextFormatter;
