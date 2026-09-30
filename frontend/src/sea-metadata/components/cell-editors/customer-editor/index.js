import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Container from '@/components/options-editor/static-options-editor/container';
import { gettext } from '@/constants';
import { useCustomersData } from '../../../hooks';
import { getCustomersOptions } from '../../../utils/column';
import { isEmptyCustomerId } from '../../../utils/row';

import './index.css';

const CustomerEditor = forwardRef(({
  height: rowHeight,
  column,
  value,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
}, ref) => {
  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);

  const { customersData } = useCustomersData();

  // Customers are owned by the server, so there is nothing to create here. Only
  // active customers can be assigned; one that is already on the ticket but has
  // since been disabled is left untouched rather than silently cleared.
  const options = useMemo(() => {
    return getCustomersOptions(customersData).filter(option => option.status !== 'disabled');
  }, [customersData]);

  const style = useMemo(() => {
    return { width: 300, top: 0 };
  }, []);

  const onSubmit = useCallback(() => {
    setTimeout(() => onCommit && onCommit(true), 1);
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom, right } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + rowHeight - window.innerHeight + 'px';
      }
      if (right > window.innerWidth) {
        const parentNode = editorRef.current.parentElement;
        if (parentNode) {
          const overflow = right - window.innerWidth + 10;
          parentNode.style.left = `${parentNode.offsetLeft - overflow}px`;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the cell value is the customer id itself, stored server side as an int64
  const getSelectedCustomerId = useCallback(() => {
    const selected = optionEditorContainerRef.current.getValue();
    return isEmptyCustomerId(selected) ? '' : Number(selected);
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const { key } = column;
      return { [key]: getSelectedCustomerId() };
    },
    onBlur: () => {
      onCommit && onCommit(true);
    },
  }), [column, onCommit, getSelectedCustomerId]);

  return (
    <div className="sea-metadata-single-select-editor options-editor-popover" style={style} ref={editorRef}>
      <Container
        ref={optionEditorContainerRef}
        isMultiple={false}
        isSearchEnabled={true}
        value={isEmptyCustomerId(value) ? '' : String(value)}
        emptyTip={gettext('No customers')}
        placeholder={gettext('Search customer')}
        options={options}
        onChange={onSubmit}
        onPressTab={onPressTab}
      >
      </Container>
    </div>
  );
});

CustomerEditor.displayName = 'CustomerEditor';

CustomerEditor.propTypes = {
  height: PropTypes.number,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default CustomerEditor;
