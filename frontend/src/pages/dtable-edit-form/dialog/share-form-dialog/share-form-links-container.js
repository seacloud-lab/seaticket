import React from 'react';
import PropTypes from 'prop-types';
import FieldPresetLinkItem from '../../widgets/field-preset-link-item';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  shareFormLinks: PropTypes.array,
  defaultLinkItem: PropTypes.object,
  onDeleteLink: PropTypes.func,
  onSelectLink: PropTypes.func,
};

const ShareFormLinksContainer = ({ shareFormLinks, defaultLinkItem, onDeleteLink, onSelectLink }) => {

  return (
    <div className="form-presets-links-container">
      <table>
        <thead className="seatable-table-header-sm">
          <tr>
            <th width="20%">{gettext('Form link name')}</th>
            <th width="47%">{gettext('URL')}</th>
            <th width="18%">{gettext('Created at')}</th>
            <th width="15%">{/* operation */}</th>
          </tr>
        </thead>
        <tbody>
          <FieldPresetLinkItem
            index={'default'}
            linkItem={defaultLinkItem}
            disableButton={true}
          />
          {shareFormLinks.map((item, index) => {
            return (
              <FieldPresetLinkItem
                key={index}
                index={index}
                linkItem={item}
                onDeleteLink={onDeleteLink}
                onSelectLink={onSelectLink}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

ShareFormLinksContainer.propTypes = propTypes;

export default ShareFormLinksContainer;
