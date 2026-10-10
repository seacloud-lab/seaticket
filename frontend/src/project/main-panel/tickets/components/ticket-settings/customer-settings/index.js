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

  // Only active customers can be assigned. The one already on the ticket is kept
  // in the list even when it has been disabled: it then shows as the selection,
  // and picking it is what clears the field -- leaving it out would make a
  // disabled customer impossible to remove here.
  // `label` is set so the list renders plain text: customers carry no colour, and
  // without a label the editor falls back to a colourless option pill.
  const currentId = value === null || value === undefined ? '' : String(value);
  const options = useMemo(() => {
    if (isLoading) return [];
    return customersData ? customersData.rows
      .filter(o => o.status !== 'disabled' || o._id === currentId)
      .map(o => ({ ...o, value: o._id, label: o.name })) : [];
  }, [isLoading, customersData, currentId]);

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
          {/* Same chip markup as the ticket-list column (CustomerFormatter) so the
              two surfaces look identical; the chip's styles come from the link
              stylesheets, which are already in this bundle (the portal customers
              table relies on that too). A customer deleted after the ticket was
              created stays referenced in the database but is not shown here either
              -- picking a new customer replaces it. */}
          {customerOption ? (
            <div className="link-item">
              <span className="link-item-name" title={customerOption.name}>{customerOption.name}</span>
            </div>
          ) : (
            <div className="seaqa-tip-default">{gettext('No customer')}</div>
          )}
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
