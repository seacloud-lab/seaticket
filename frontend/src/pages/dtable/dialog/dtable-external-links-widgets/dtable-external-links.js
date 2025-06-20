import React from 'react';
import PropTypes from 'prop-types';
import { gettext, mediaUrl } from '../../../../constants';
import { DTableEmptyTip } from 'dtable-ui-component';

class DTableExternalLinks extends React.Component {

  render() {
    const { dtableExternalLinks, emptyExternalLinksTip } = this.props;
    const table = (
      <table>
        <thead>
          <tr>
            <th className="pl-2" width="80%">{gettext('Token')}</th>
            <th width="20%"></th>
          </tr>
        </thead>
        <tbody>
          {dtableExternalLinks.map((item, index) => {
            return (
              <tr key={index} className="external-link-item ">
                <td className="pl-2">
                  {item.token}
                </td>
                <td>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{gettext('View')}</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
    const emptyTip = (
      <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={emptyExternalLinksTip} />
    );

    return dtableExternalLinks.length === 0 ? emptyTip : table;
  }
}

DTableExternalLinks.propTypes = {
  dtableExternalLinks: PropTypes.array,
  emptyExternalLinksTip: PropTypes.string,
};

export default DTableExternalLinks;
