import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, CommonOperationConfirmationDialog, ModalHeader, toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { chatSkillsAPI } from '@/project/api';
import { SKILLS_PAGE_SLUG_ID } from '../constants';


const NEW_SKILL_TEMPLATE = '---\nname: \ndescription: \n---\n\n# Skill\n';

const SkillDetail = ({ projectUuid, pageSlugId, isProjectAdmin, onSaved, onDeleted, onCancel }) => {
  const isOpen = pageSlugId !== SKILLS_PAGE_SLUG_ID.ALL;
  const isNew = pageSlugId === SKILLS_PAGE_SLUG_ID.NEW;
  const [isLoading, setLoading] = useState(false);
  const [skill, setSkill] = useState(null);
  const [content, setContent] = useState('');
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

  const loadSkill = useCallback(() => {
    if (!isOpen) return;
    if (isNew) {
      setSkill(null);
      setContent(NEW_SKILL_TEMPLATE);
      setEnabled(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    chatSkillsAPI.getChatSkill(projectUuid, pageSlugId).then((res) => {
      const nextSkill = res?.data?.skill;
      setSkill(nextSkill);
      setContent(nextSkill?.content || '');
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

  const onSubmit = useCallback(() => {
    if (!canSave) return;
    setSubmitting(true);
    const complete = () => setSubmitting(false);

    if (isNew) {
      chatSkillsAPI.validateChatSkill(projectUuid, { content }).then(() => {
        return chatSkillsAPI.createChatSkill(projectUuid, { content, enabled });
      }).then((res) => {
        toaster.success(gettext('Skill created.'));
        onSaved && onSaved(res?.data?.skill?.name);
      }).catch((error) => {
        toaster.danger(Utils.getErrorMsg(error));
      }).finally(complete);
      return;
    }

    chatSkillsAPI.validateChatSkill(projectUuid, { content, expected_name: pageSlugId }).then(() => {
      return chatSkillsAPI.updateChatSkill(projectUuid, pageSlugId, {
        content,
        revision: skill?.revision,
      });
    }).then(() => {
      toaster.success(gettext('Skill updated.'));
      onSaved && onSaved(pageSlugId);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(complete);
  }, [canSave, isNew, projectUuid, content, enabled, onSaved, pageSlugId, skill?.revision]);

  const executeDelete = useCallback(() => {
    if (!canDelete) return;
    setSubmitting(true);
    chatSkillsAPI.deleteChatSkill(projectUuid, pageSlugId).then(() => {
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
              <textarea
                className="form-control skill-detail-content"
                rows={20}
                value={content}
                onChange={(e) => canEditContent && setContent(e.target.value)}
                disabled={isSubmitting || !canEditContent}
              />
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
            <button className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting || isLoading}>
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
