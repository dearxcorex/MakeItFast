/**
 * NavSidebar - Navigation menu with two variants:
 * - 'desktop' (default): hover-expand rail, 64px → 200px, only visible on lg+
 * - 'mobile-drawer': always-expanded panel for use inside a slide-in drawer
 */

'use client';

import { useState } from 'react';

type ActiveTab = 'stations' | 'intermod' | 'interference' | 'analytics';

type NavItem = {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
};

interface NavSidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  variant?: 'desktop' | 'mobile-drawer';
}

const navItems: NavItem[] = [
  {
    id: 'stations',
    label: 'FM Stations',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  },
  {
    id: 'intermod',
    label: 'Intermod Calc',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'interference',
    label: 'Interference',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
];

export default function NavSidebar({ activeTab, onTabChange, variant = 'desktop' }: NavSidebarProps) {
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const isDrawer = variant === 'mobile-drawer';
  const isExpanded = isDrawer || isHoverExpanded;

  return (
    <nav
      className={`flex flex-col h-full nav-sidebar ${isDrawer ? 'w-full' : 'hidden lg:flex'}`}
      onMouseEnter={isDrawer ? undefined : () => setIsHoverExpanded(true)}
      onMouseLeave={isDrawer ? undefined : () => setIsHoverExpanded(false)}
      style={
        isDrawer
          ? undefined
          : {
              width: isHoverExpanded ? '200px' : '64px',
              transition: 'width 0.2s ease-in-out',
            }
      }
    >
      {/* Logo Section */}
      <div className="p-3 border-b border-border/30">
        <div className={`flex items-center gap-3 ${isExpanded ? '' : 'justify-center'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-gold flex-shrink-0">
            <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          {isExpanded && (
            <span className="font-heading font-bold gradient-text whitespace-nowrap overflow-hidden">
              NBTC FM
            </span>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                ${isExpanded ? '' : 'justify-center'}
                ${isActive
                  ? 'bg-primary/20 text-primary glow-gold border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }
              `}
              title={!isExpanded ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-primary' : ''}`}>
                {item.icon}
              </span>
              {isExpanded && (
                <span className={`text-sm font-medium whitespace-nowrap overflow-hidden ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Section — desktop hover indicator only */}
      {!isDrawer && (
        <div className="p-3 border-t border-border/30">
          <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isExpanded ? '' : 'justify-center'}`}>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {isExpanded && <span className="whitespace-nowrap">Collapse</span>}
          </div>
        </div>
      )}
    </nav>
  );
}
