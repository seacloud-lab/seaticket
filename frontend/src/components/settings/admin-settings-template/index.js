import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Label } from 'reactstrap';

const AdminSettingsTemplate = ({ helpTip, displayName, mainContent, attachment }) => {
  return (
    <Row>
      {displayName && (
        <Col md="3">
          <Label className="web-setting-label">{displayName}</Label>
        </Col>
      )}
      <Col md="5">
        {mainContent}
        {helpTip && <p className="seaqa-tip-default mt-1">{helpTip}</p>}
      </Col>
      <Col md="4">
        {attachment}
      </Col>
    </Row>
  );
};

AdminSettingsTemplate.propTypes = {
  displayName: PropTypes.string,
  helpTip: PropTypes.string,
  mainContent: PropTypes.object.isRequired,
  attachment: PropTypes.object
};

export default AdminSettingsTemplate;
