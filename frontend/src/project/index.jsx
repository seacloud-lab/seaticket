import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPE, CONNECTION_TYPES, BAR_TYPES } from './constants';
import { gettext } from '../constants';
import { Utils } from '../utils/utils';
import { CenteredLoading } from '../components';

import './index.css';

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState({});

  const bars = useMemo(() => [
    {
      key: '_',
      name: '',
      children: BAR_TYPES
    }, {
      key: 'connections',
      name: gettext('Connections'),
      children: CONNECTION_TYPES
    }
  ], []);

  const toggleBar = useCallback((bar) => {
    if (activeBar?.key === bar.key) return;
    const newSearch = `?page=${bar.key}`;
    const { pathname, origin } = location;
    history.replaceState(null, null, origin + pathname + newSearch);
    setActiveBar(bar);
  }, [activeBar]);

  useEffect(() => {
    const searchParams = Utils.getUrlSearches();
    const barKey = searchParams?.page || BAR_TYPE.SEARCH;
    const bar = BAR_TYPES.find(b => b.key === barKey) || CONNECTION_TYPES.find(b => b.key === barKey);
    setActiveBar(bar || BAR_TYPES[1]);
    setLoading(false);
  }, []);

  return (
    <div className="sea-qa-project">
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <>
          <SidePanel bars={bars} activeBar={activeBar} toggleBar={toggleBar} />
          <MainPanel activeBar={activeBar} />
        </>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
