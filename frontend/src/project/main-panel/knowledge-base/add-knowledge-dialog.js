import React from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { ModalHeader } from '@/components';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { gettext, lang } from '@/constants';

const AddKnowledgeDialog = ({ isOpen, toggle, isSubmitting, question, answer, setQuestion, setAnswer, onSubmit, editorAPI }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} style={{ minWidth: 600 }}>
      <ModalHeader toggle={toggle}>{gettext('New knowledge record')}</ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup>
            <Label for="kbQuestion">{gettext('Question')}</Label>
            <Input type="text" id="kbQuestion" value={question} readOnly={isSubmitting} onChange={(e) => setQuestion(e.target.value)} />
          </FormGroup>
          <FormGroup>
            <Label>{gettext('Answer')}</Label>
            <LongTextInlineEditor
              isAlwaysEnableEdit={true}
              lang={lang}
              headerName={gettext('Answer')}
              value={answer || ''}
              autoSave={true}
              saveDelay={20 * 1000}
              isCheckBrowser={true}
              isImageUploadOnly={false}
              isSupportMultipleFiles={true}
              editorApi={editorAPI}
              autoFocus={false}
              onSaveEditorValue={setAnswer}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={onSubmit} disabled={isSubmitting || !question.trim() || !(typeof answer === 'string' ? answer.trim() : (answer && answer.text && answer.text.trim()))}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddKnowledgeDialog;
