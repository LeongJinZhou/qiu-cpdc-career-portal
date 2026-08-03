'use client';

import { useCallback, useRef } from 'react';

/**
 * Small shared WAI-ARIA tabs interaction model. The selected tab is the only
 * tab in the normal tab order; arrows, Home and End move within the tablist.
 * Keeping this in one hook prevents each role workspace from inventing a
 * slightly different keyboard experience.
 */
export function useAccessibleTabs(tabIds, activeTab, setActiveTab) {
  const tabRefs = useRef({});

  const onTabKeyDown = useCallback((event, currentId) => {
    const index = tabIds.indexOf(currentId);
    if (index < 0 || !tabIds.length) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabIds.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabIds.length) % tabIds.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabIds.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const nextId = tabIds[nextIndex];
    setActiveTab(nextId);
    requestAnimationFrame(() => tabRefs.current[nextId]?.focus());
  }, [setActiveTab, tabIds]);

  const getTabProps = useCallback((id) => ({
    ref: (node) => {
      if (node) tabRefs.current[id] = node;
      else delete tabRefs.current[id];
    },
    tabIndex: activeTab === id ? 0 : -1,
    onKeyDown: (event) => onTabKeyDown(event, id),
  }), [activeTab, onTabKeyDown]);

  return { getTabProps };
}
