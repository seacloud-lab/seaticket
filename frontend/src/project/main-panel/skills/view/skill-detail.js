import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, CommonOperationConfirmationDialog, ModalHeader, toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { skillsAPI } from '@/project/api';
import { SKILLS_PAGE_SLUG_ID } from '../constants';
import {
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_NAME_MAX_LENGTH,
  SKILL_NAME_RE,
  composeSkillContent,
  extractMetadataText,
  splitSkillContent,
} from './skill-content';


const NEW_SKILL_BODY = '# Skill\n';

const METADATA_PLACEHOLDER = `seaticket-agent:
  enabled: true`;

const SkillDetail = ({ projectUuid, pageSlugId, isProjectAdmin, onSaved, onDeleted, onCancel }) => {
  const isOpen = pageSlugId !== SKILLS_PAGE_SLUG_ID.ALL;
  const isNew = pageSlugId === SKILLS_PAGE_SLUG_ID.NEW;
  const [isLoading, setLoading] = useState(false);
  const [skill, setSkill] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [body, setBody] = useState('');
  const [initialForm, setInitialForm] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const readonly = useMemo(() => {
    if (isNew || !skill) return false;
    return skill.source === 'builtin';
  }, [isNew, skill]);

  const canEditContent = isProjectAdmin && !readonly;
  const canSave = isProjectAdmin && !readonly;
  const canDelete = isProjectAdmin && !readonly && !isNew;

  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return name !== initialForm.name
      || description !== initialForm.description
      || metadataText !== initialForm.metadataText
      || body !== initialForm.body;
  }, [body, description, initialForm, metadataText, name]);

  const metadataInputRef = useRef(null);

  useLayoutEffect(() => {
    const el = metadataInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [metadataText, isLoading, isOpen]);

  const canSubmit = canSave && !isSubmitting && !isLoading && (
    isNew
      ? Boolean(name.trim() && description.trim() && body.trim())
      : isDirty
  );

  const loadSkill = useCallback(() => {
    if (!isOpen) return;
    if (isNew) {
      const form = { name: '', description: '', metadataText: '', body: NEW_SKILL_BODY };
      setSkill(null);
      setName(form.name);
      setDescription(form.description);
      setMetadataText(form.metadataText);
      setBody(form.body);
      setInitialForm(form);
      setEnabled(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    skillsAPI.getSkill(projectUuid, pageSlugId).then((res) => {
      const nextSkill = res?.data?.skill;
      const { frontmatter, body: skillBody } = splitSkillContent(nextSkill?.content);
      const form = {
        name: nextSkill?.name || '',
        description: nextSkill?.description || '',
        metadataText: extractMetadataText(frontmatter),
        body: skillBody,
      };
      setSkill(nextSkill);
      setName(form.name);
      setDescription(form.description);
      setMetadataText(form.metadataText);
      setBody(form.body);
      setInitialForm(form);
      setEnabled(Boolean(nextSkill?.enabled));
      setLoading(false);
    }).catch((error) => {
      setLoading(false);
      toaster.danger(Utils.getErrorMsg(error));
      onCancel && onCancel();
    });
  }, [isNew, isOpen, onCancel, pageSlugId, projectUuid]);

  useEffect(() => {
    if (!isOpen) return;
    loadSkill();
  }, [isOpen, loadSkill]);

  const validateForm = useCallback(() => {
    const trimmedName = name.trim();
    if (!SKILL_NAME_RE.test(trimmedName) || trimmedName.length > SKILL_NAME_MAX_LENGTH) {
      toaster.danger(gettext('Skill name must use lowercase letters, digits and hyphens (e.g. issue-research).'));
      return false;
    }
    if (!description.trim()) {
      toaster.danger(gettext('Skill description is required.'));
      return false;
    }
    if (description.trim().length > SKILL_DESCRIPTION_MAX_LENGTH) {
      toaster.danger(gettext('Skill description is too long.'));
      return false;
    }
    if (!body.trim()) {
      toaster.danger(gettext('Skill instructions are required.'));
      return false;
    }
    return true;
  }, [body, description, name]);

  const onSubmit = useCallback(() => {
    if (!canSubmit || !validateForm()) return;
    setSubmitting(true);
    const complete = () => setSubmitting(false);
    const content = composeSkillContent({ name, description, metadataText, body });

    if (isNew) {
      skillsAPI.validateSkill(projectUuid, { content }).then(() => {
        return skillsAPI.createSkill(projectUuid, { content, enabled });
      }).then((res) => {
        toaster.success(gettext('Skill created.'));
        onSaved && onSaved(res?.data?.skill?.name);
      }).catch((error) => {
        toaster.danger(Utils.getErrorMsg(error));
      }).finally(complete);
      return;
    }

    skillsAPI.validateSkill(projectUuid, { content, expected_name: pageSlugId }).then(() => {
      return skillsAPI.updateSkill(projectUuid, pageSlugId, {
        content,
        revision: skill?.revision,
      });
    }).then(() => {
      toaster.success(gettext('Skill updated.'));
      onSaved && onSaved(pageSlugId);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(complete);
  }, [canSubmit, validateForm, isNew, projectUuid, name, description, metadataText, body, enabled, onSaved, pageSlugId, skill?.revision]);

  const executeDelete = useCallback(() => {
    if (!canDelete) return;
    setSubmitting(true);
    skillsAPI.deleteSkill(projectUuid, pageSlugId).then(() => {
      toaster.success(gettext('Skill deleted.'));
      onDeleted && onDeleted();
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => setSubmitting(false));
  }, [canDelete, projectUuid, pageSlugId, onDeleted]);

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={true} toggle={onCancel} className="skill-detail-dialog">
        <ModalHeader toggle={onCancel}>
          {isNew ? gettext('New skill') : `/${skill?.name || pageSlugId}`}
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="skill-detail-loading">
              <CenteredLoading />
            </div>
          ) : (
            <div className="skill-detail">
              {!isNew && (
                <div className="skill-detail-subtitle mb-2">
                  {readonly ? gettext('Builtin skill (content is read-only)') : gettext('Custom skill')}
                </div>
              )}
              <div className="skill-detail-field">
                <label className="skill-detail-label" htmlFor="skill-name-input">{gettext('Name')}</label>
                <input
                  id="skill-name-input"
                  type="text"
                  className="form-control"
                  value={name}
                  placeholder="issue-research"
                  maxLength={SKILL_NAME_MAX_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting || !canEditContent || !isNew}
                />
                <div className="skill-detail-hint">
                  {isNew
                    ? gettext('Lowercase letters, digits and hyphens. It cannot be changed after creation.')
                    : gettext('The name of a skill cannot be changed.')}
                </div>
              </div>
              <div className="skill-detail-field">
                <label className="skill-detail-label" htmlFor="skill-description-input">{gettext('Description')}</label>
                <input
                  id="skill-description-input"
                  type="text"
                  className="form-control"
                  value={description}
                  maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting || !canEditContent}
                />
              </div>
              <div className="skill-detail-field">
                <label className="skill-detail-label" htmlFor="skill-metadata-input">{gettext('Metadata (YAML, optional)')}</label>
                <textarea
                  id="skill-metadata-input"
                  ref={metadataInputRef}
                  className="form-control skill-detail-metadata"
                  value={metadataText}
                  placeholder={METADATA_PLACEHOLDER}
                  onChange={(e) => setMetadataText(e.target.value)}
                  disabled={isSubmitting || !canEditContent}
                />
                <div className="skill-detail-hint">
                  {gettext('Advanced options such as seaticket-agent. Leave empty if not needed.')}
                </div>
              </div>
              <div className="skill-detail-field">
                <label className="skill-detail-label" htmlFor="skill-body-input">{gettext('Instructions (Markdown)')}</label>
                <textarea
                  id="skill-body-input"
                  className="form-control skill-detail-content"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={isSubmitting || !canEditContent}
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            {gettext('Cancel')}
          </button>
          {canDelete && (
            <button
              className="btn btn-danger"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isSubmitting}
            >
              {gettext('Delete')}
            </button>
          )}
          {canSave && (
            <button className="btn btn-primary" onClick={onSubmit} disabled={!canSubmit}>
              {gettext('Save')}
            </button>
          )}
        </ModalFooter>
      </Modal>

      {isDeleteDialogOpen && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete skill')}
          message={gettext('Are you sure you want to delete this skill?')}
          confirmBtnText={gettext('Delete')}
          toggleDialog={() => setDeleteDialogOpen(false)}
          executeOperation={executeDelete}
        />
      )}
    </>
  );
};

export default SkillDetail;
