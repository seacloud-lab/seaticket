import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { OptionsEditor, CustomizeLabel } from '@/components';
import { gettext } from '@/constants';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const CustomerSettings = ({
  id,
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
  useMetadataContext,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, customersData } = useMetadataContext();

  const editorRef = useRef(null);

  // only active customers can be assigned; a disabled one is still shown below so
  // an existing ticket does not silently appear to have no customer
  const options = useMemo(() => {
    if (isLoading) return [];
    return customersData ? customersData.rows
      .filter(o => o.status !== 'disabled')
      .map(o => ({ ...o, value: o._id })) : [];
  }, [isLoading, customersData]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onCustomerChange = useCallback((customer) => {
    onChange(customer);
  }, [onChange]);

  const customerOption = getRowById(customersData, value);

  return (
    <>
      <div className={classnames('seaqa-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('Customer')}
        </CustomizeLabel>
        <div className={classnames('ticket-customer-formatter', { 'valid': customerOption, 'cursor-pointer': !isReadonly })} onClick={openEditor} ref={editorRef}>
          {customerOption ? <span className="ticket-customer-name text-truncate">{customerOption.name}</span> : <div className="seaqa-tip-default">{gettext('No customer')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionsEditor
          id={id}
          className="seaqa-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={value}
          placeholder={gettext('Search customer')}
          emptyTip={gettext('No customers')}
          options={options}
          onChange={onCustomerChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default CustomerSettings;
