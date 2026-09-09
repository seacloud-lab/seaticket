import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalFooter } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CenteredLoading, IconButton, ModalHeader, Tooltip, toaster } from '@/components';
import Switch from '@/components/switch';
import { Utils } from '@/utils/utils';
import { skillsAPI } from '@/project/api';
import { SKILL_DETAIL_MODE, SKILLS_PAGE_TYPE } from '../constants';
import {
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_NAME_MAX_LENGTH,
  SKILL_NAME_RE,
  composeSkillContent,
  extractSkillBody,
} from './skill-content';

import './skill-detail-dialog.css';

const NEW_SKILL_BODY = '# Skill\n';

const SkillDetailDialog = ({ projectUuid, pageType, skillName, mode, isProjectAdmin, onSaved, onEdit, onCancel }) => {
  const isOpen = pageType !== SKILLS_PAGE_TYPE.LIST;
  const isNew = pageType === SKILLS_PAGE_TYPE.CREATE;
  const isPreview = mode === SKILL_DETAIL_MODE.PREVIEW && !isNew;
  const [isLoading, setLoading] = useState(false);
  const [skill, setSkill] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [supportAgent, setSupportAgent] = useState(false);
  const [body, setBody] = useState('');
  const [initialForm, setInitialForm] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({ name: '', description: '', body: '' });
  const editButtonRef = useRef(null);

  const clearFormErrors = useCallback(() => setFormErrors({ name: '', description: '', body: '' }), []);
  const clearFieldError = useCallback((field) => {
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const readonly = useMemo(() => {
    if (isNew || !skill) return false;
    return skill.source === 'builtin';
  }, [isNew, skill]);

  const canEditContent = isProjectAdmin && !readonly && !isPreview;
  const canSave = isProjectAdmin && !readonly && !isPreview;
  const canSwitchToEdit = isPreview && !isLoading && !readonly && isProjectAdmin;

  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return name !== initialForm.name
      || description !== initialForm.description
      || supportAgent !== initialForm.supportAgent
      || body !== initialForm.body;
  }, [body, description, initialForm, supportAgent, name]);

  const canSubmit = canSave && !isSubmitting && !isLoading && (
    isNew
      ? Boolean(name.trim() && description.trim() && body.trim())
      : isDirty
  );

  const loadSkill = useCallback(() => {
    if (!isOpen) return;
    clearFormErrors();
    if (isNew) {
      const form = { name: '', description: '', supportAgent: false, body: NEW_SKILL_BODY };
      setSkill(null);
      setName(form.name);
      setDescription(form.description);
      setSupportAgent(form.supportAgent);
      setBody(form.body);
      setInitialForm(form);
      setEnabled(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    skillsAPI.getSkill(projectUuid, skillName).then((res) => {
      const nextSkill = res?.data?.skill;
      const form = {
        name: nextSkill?.name || '',
        description: nextSkill?.description || '',
        supportAgent: Boolean(nextSkill?.support_agent),
        body: extractSkillBody(nextSkill?.content),
      };
      setSkill(nextSkill);
      setName(form.name);
      setDescription(form.description);
      setSupportAgent(form.supportAgent);
      setBody(form.body);
      setInitialForm(form);
      setEnabled(Boolean(nextSkill?.enabled));
      setLoading(false);
    }).catch((error) => {
      setLoading(false);
      setFormErrors((prev) => ({ ...prev, name: Utils.getErrorMsg(error) }));
    });
  }, [clearFormErrors, isNew, isOpen, skillName, projectUuid]);

  useEffect(() => {
    if (!isOpen) return;
    loadSkill();
  }, [isOpen, loadSkill]);

  const validateForm = useCallback(() => {
    setFormErrors({ name: '', description: '', body: '' });
    const trimmedName = name.trim();
    if (!SKILL_NAME_RE.test(trimmedName)) {
      setFormErrors((prev) => ({ ...prev, name: gettext('Skill name must use lowercase letters, digits and hyphens (e.g. issue-research).') }));
      return false;
    }
    if (trimmedName.length > SKILL_NAME_MAX_LENGTH) {
      setFormErrors((prev) => ({ ...prev, name: gettext('Skill name cannot exceed %s characters.').replace('%s', SKILL_NAME_MAX_LENGTH) }));
      return false;
    }
    if (!description.trim()) {
      setFormErrors((prev) => ({ ...prev, description: gettext('Skill description is required.') }));
      return false;
    }
    if (description.trim().length > SKILL_DESCRIPTION_MAX_LENGTH) {
      setFormErrors((prev) => ({ ...prev, description: gettext('Skill description cannot exceed %s characters.').replace('%s', SKILL_DESCRIPTION_MAX_LENGTH) }));
      return false;
    }
    if (!body.trim()) {
      setFormErrors((prev) => ({ ...prev, body: gettext('Skill instructions are required.') }));
      return false;
    }
    return true;
  }, [body, description, name]);

  const onSubmit = useCallback(() => {
    if (!canSubmit || !validateForm()) return;
    setSubmitting(true);
    const complete = () => setSubmitting(false);
    const content = composeSkillContent({ name, description, supportAgent, body });

    if (isNew) {
      skillsAPI.createSkill(projectUuid, { content, enabled }).then((res) => {
        toaster.success(gettext('Skill created.'));
        onSaved && onSaved(res?.data?.skill?.name);
      }).catch((error) => {
        setFormErrors((prev) => ({ ...prev, name: Utils.getErrorMsg(error) }));
      }).finally(complete);
      return;
    }

    skillsAPI.updateSkill(projectUuid, skillName, {
      content,
      revision: skill?.revision,
    }).then(() => {
      toaster.success(gettext('Skill updated.'));
      onSaved && onSaved(skillName);
    }).catch((error) => {
      setFormErrors((prev) => ({ ...prev, name: Utils.getErrorMsg(error) }));
    }).finally(complete);
  }, [canSubmit, validateForm, isNew, projectUuid, name, description, supportAgent, body, enabled, onSaved, skillName, skill?.revision]);

  if (!isOpen) return null;

  if (isPreview) {
    return (
      <Modal isOpen={true} toggle={onCancel} className="skill-detail-dialog">
        <ModalHeader toggle={onCancel}>
          <div className="skill-detail-dialog-header">
            <span>{gettext('Skill details')}</span>
            {canSwitchToEdit && (
              <>
                <IconButton
                  className="skill-detail-dialog-edit-button"
                  icon="rename"
                  ref={editButtonRef}
                  onClick={onEdit}
                  aria-label={gettext('Edit skill')}
                />
                <Tooltip target={editButtonRef} placement="bottom">
                  {gettext('Edit skill')}
                </Tooltip>
              </>
            )}
          </div>
        </ModalHeader>
        <ModalBody className="skill-detail-dialog-preview-modal-body">
          {isLoading ? (
            <div className="skill-detail-dialog-loading"><CenteredLoading /></div>
          ) : (
            <div className="skill-detail-dialog-preview-content">
              <div className="skill-detail-dialog-preview-name">
                <span>{name}</span>
                <span className={classnames('skills-source', skill?.source)}>
                  {skill?.source === 'builtin' ? gettext('Built-in') : gettext('Custom')}
                </span>
                {readonly && <span className="skills-source readonly">{gettext('Read-only')}</span>}
              </div>
              <div className="skill-detail-dialog-preview-description mt-2 mb-4">{description}</div>
              <div className="skill-detail-dialog-preview-body">{body}</div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={onCancel}>{gettext('Close')}</Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={true} toggle={onCancel} className="skill-detail-dialog">
        <ModalHeader toggle={onCancel}>
          <div className="skill-detail-dialog-header">
            <span>{isNew ? gettext('New skill') : gettext('Edit skill')}</span>
          </div>
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="skill-detail-dialog-loading">
              <CenteredLoading />
            </div>
          ) : (
            <div className="skill-detail-dialog-content">
              {!isNew && (
                <div className="skill-detail-dialog-subtitle mb-2">
                  {readonly ? gettext('Builtin skill (content is read-only)') : gettext('Custom skill')}
                </div>
              )}
              <div className="skill-detail-dialog-field skill-detail-dialog-name-field">
                <Label className="skill-detail-dialog-label mb-3" htmlFor="skill-name-input">{gettext('Name')}</Label>
                <Input
                  id="skill-name-input"
                  type="text"
                  className="form-control"
                  value={name}
                  maxLength={SKILL_NAME_MAX_LENGTH}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  disabled={isSubmitting || !canEditContent || !isNew}
                  style={ formErrors.name ? { borderColor: 'red' } : null}
                />
                {formErrors.name ?
                  <div className="skill-detail-dialog-hint error">{formErrors.name}</div>
                  :
                  <div className="skill-detail-dialog-hint">
                    {isNew
                      ? gettext('Lowercase letters, digits and hyphens. It cannot be changed after creation')
                      : gettext('The name of a skill cannot be changed')}
                  </div>
                }
              </div>
              <div className="skill-detail-dialog-field skill-detail-dialog-switch-field mt-2 mb-4">
                <Switch
                  checked={supportAgent}
                  onChange={(event) => setSupportAgent(Boolean(event?.target?.checked))}
                  placeholder={gettext('Use in agent too')}
                  textPosition="right"
                  disabled={isSubmitting || !canEditContent}
                  checkedTooltip={gettext('Chat only by default. Turn on for Agent.')}
                  uncheckedTooltip={gettext('Chat only by default. Turn on for Agent.')}
                  tooltipPosition="bottom-start"
                />
              </div>
              <div className="skill-detail-dialog-field skill-detail-dialog-description-field mb-3">
                <Label className="skill-detail-dialog-label mb-3" htmlFor="skill-description-input">{gettext('Description')}</Label>
                <Input
                  id="skill-description-input"
                  type="textarea"
                  className="skill-detail-dialog-description-input"
                  value={description}
                  maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    clearFieldError('description');
                  }}
                  disabled={isSubmitting || !canEditContent}
                  style={ formErrors.description ? { borderColor: 'red' } : null}
                />
                {formErrors.description && <div className="error">{formErrors.description}</div>}
              </div>
              <div className="skill-detail-dialog-field skill-detail-dialog-instructions-field">
                <Label className="skill-detail-dialog-label mb-3" htmlFor="skill-body-input">{gettext('Instructions (Markdown)')}</Label>
                <Input
                  id="skill-body-input"
                  type="textarea"
                  className="form-control skill-detail-dialog-content-input mb-3"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    clearFieldError('body');
                  }}
                  disabled={isSubmitting || !canEditContent}
                  style={ formErrors.body ? { borderColor: 'red' } : null}
                />
                {formErrors.body && <div className="error">{formErrors.body}</div>}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={onCancel} disabled={isSubmitting}>
            {gettext('Cancel')}
          </Button>
          {canSave && (
            <Button color="primary" onClick={onSubmit} disabled={!canSubmit}>
              {gettext('Submit')}
            </Button>
          )}
        </ModalFooter>
      </Modal>

    </>
  );
};

export default SkillDetailDialog;
