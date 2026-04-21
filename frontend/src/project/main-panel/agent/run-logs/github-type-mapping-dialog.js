import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader, CustomizeSelect, Option } from '@/components';
import { gettext } from '@/constants';

const GithubTypeMappingDialog = ({
  isOpen,
  agentType,
  githubIssueTypes,
  onCancel,
  onConfirm,
}) => {
  const options = useMemo(() => {
    return (githubIssueTypes || [])
      .filter((item) => Boolean(item?.name))
      .map((item) => ({
        value: item.name,
        label: <Option option={item} />,
      }));
  }, [githubIssueTypes]);

  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    if (!isOpen) setSelectedType('');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} toggle={onCancel} className="github-type-mapping-modal">
      <ModalHeader toggle={onCancel}>{gettext('Map agent issue type to GitHub issue type')}</ModalHeader>
      <ModalBody>
        <div className="github-type-mapping-dialog-body">
          <div className="github-type-mapping-dialog-row">
            <div className="github-type-mapping-dialog-label">{agentType}</div>
            <CustomizeSelect
              className="github-type-mapping-dialog-selector"
              value={options.find((option) => option.value === selectedType) || null}
              options={options}
              placeholder={gettext('Please select')}
              onChange={(value) => setSelectedType(value)}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onCancel}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!selectedType} onClick={() => onConfirm(selectedType)}>
          {gettext('Confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default GithubTypeMappingDialog;
