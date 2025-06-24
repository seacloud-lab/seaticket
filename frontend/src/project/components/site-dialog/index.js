import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, FormGroup, Label, Alert } from 'reactstrap';
import { gettext } from '../../../constants';
import CustomModalHeader from '../../../components/modal-header';
import { isValidUrl } from '../../../utils/validate';

const SiteDialog = ({ onSubmit, onToggle, site }) => {
  const [name, setName] = useState(site?.name || '');
  const [url, setUrl] = useState(site?.url || '');
  const [sitemapUrl, setSitemapUrl] = useState(site?.sitemap_url || '');
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onNameChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === name) return;
    setName(newValue);
  }, [name]);

  const onUrlChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === url) return;
    setUrl(newValue);
  }, [url]);

  const onSitemapUrlChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === sitemapUrl) return;
    setSitemapUrl(newValue);
  }, [sitemapUrl]);

  const handleSubmit = useCallback(() => {
    const validName = name.trim();
    if (!validName) {
      setErrorMsg(gettext('Name is required'));
      return;
    }
    let validUrl = url.trim();
    if (!validUrl) {
      setErrorMsg(gettext('URL is required'));
      return;
    }
    if (!isValidUrl(validUrl)) {
      validUrl = `http://${validUrl}`;
    }

    if (site?.url === url && site?.name === name && site?.sitemap_url === sitemapUrl) {
      onToggle();
      return;
    }
    setSubmitting(true);
    onSubmit({ name, url, sitemapUrl }, () => setSubmitting(false));
  }, [site, name, url, sitemapUrl, onSubmit, onToggle]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false}>
      <CustomModalHeader toggle={onToggle}>{site ? gettext('Edit site') : gettext('New site')}</CustomModalHeader>
      <ModalBody>
        <FormGroup>
          <Label>{gettext('Name')}</Label>
          <Input value={name} onChange={onNameChange} autoFocus disabled={isSubmitting} placeholder={gettext('Please input name')} />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('URL')}</Label>
          <Input value={url} onChange={onUrlChange} disabled={isSubmitting} placeholder={gettext('Please input url')} />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Sitemap url')}</Label>
          <Input value={sitemapUrl} onChange={onSitemapUrlChange} disabled={isSubmitting} placeholder={gettext('Please input sitemap url')} />
        </FormGroup>
        {errorMsg && (<Alert color="danger">{errorMsg}</Alert>)}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting || !url || !name}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

SiteDialog.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default SiteDialog;
