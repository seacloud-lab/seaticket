import React from 'react';
import PropTypes from 'prop-types';
import { gettext, mediaUrl } from '../../../constants';
import { EmptyTip } from '../../../components';

class ExternalLinks extends React.Component {

  render() {
    const { links, emptyTip: emptyTipText } = this.props;
    const table = (
      <table>
        <thead>
          <tr>
            <th className="pl-2" width="80%">{gettext('Token')}</th>
            <th width="20%"></th>
          </tr>
        </thead>
        <tbody>
          {links.map((item, index) => {
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
      <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={emptyTipText} />
    );

    return links.length === 0 ? emptyTip : table;
  }
}

ExternalLinks.propTypes = {
  links: PropTypes.array,
  emptyTip: PropTypes.string,
};

export default ExternalLinks;
