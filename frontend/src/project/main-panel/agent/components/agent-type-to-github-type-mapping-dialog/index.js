import React, { useCallback, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader, CustomizeSelect, Option, Icon, CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import { getConnectionIcon } from '../../../connections/utils';
import { CONNECTION_TYPE } from '../../../connections/constants';

import './index.css';

const AgentType2GithubTypeMappingDialog = ({
  agentType,
  githubIssueTypes,
  onCancel,
  onConfirm,
}) => {
  const [selectedType, setSelectedType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = useMemo(() => {
    return (githubIssueTypes || [])
      .filter((item) => Boolean(item?.name))
      .map((item) => ({
        value: item.name,
        label: <Option option={item} />,
      }));
  }, [githubIssueTypes]);

  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    onConfirm(selectedType, (error) => {
      if (error) {
        setIsSubmitting(false);
      }
    });
  }, [selectedType, onConfirm]);

  return (
    <Modal isOpen={true} centered={true} toggle={onCancel} className="agent-type-mapping-github-type-modal">
      <ModalHeader toggle={onCancel}>{gettext('Map issue type')}</ModalHeader>
      <ModalBody>
        <div className="sea-qa-tip-title">
          {gettext('Select suitable issue type')}
        </div>
        <div className="sea-qa-tip-default">
          {gettext('No matching GitHub org type for Agent. Please select manually. You can modify it in settings later.')}
        </div>
        <div className="github-issue-type-mapping-table">
          <div className="github-issue-type-mapping-table-header github-issue-type-mapping-table-row">
            <div className="github-issue-type-mapping-table-cell">
              <div className="github-issue-type-mapping-title">
                <Icon symbol="ai-processing" className="github-issue-type-mapping-title-icon" />
                <span>{gettext('Agent issue type')}</span>
              </div>
            </div>
            <div className="github-issue-type-mapping-table-cell">
              <div className="github-issue-type-mapping-title">
                <img src={getConnectionIcon(CONNECTION_TYPE.GITHUB_ISSUE)} alt="GitHub issue" className="github-issue-type-mapping-title-icon" />
                <span>{gettext('GitHub issue type')}</span>
              </div>
            </div>
          </div>
          <div className="github-issue-type-mapping-table-body">
            <div key={agentType} className="github-issue-type-mapping-table-row">
              <div className="github-issue-type-mapping-table-cell">
                <Option option={{ name: agentType, color: '#fff' }} className="github-issue-type-agent-type" />
              </div>
              <div className="github-issue-type-mapping-table-cell">
                <CustomizeSelect
                  className="github-issue-type-selector"
                  value={options.find((option) => option.value === selectedType) || null}
                  options={options}
                  placeholder={gettext('Please select')}
                  onChange={(value) => setSelectedType(value)}
                  disabled={options.length === 0}
                  isInModal={true}
                />
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onCancel}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!selectedType || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<CenteredLoading />) : (<>{gettext('Confirm')}</>)}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AgentType2GithubTypeMappingDialog;
