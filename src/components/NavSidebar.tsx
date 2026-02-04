/**
 * NavSidebar - Fixed left navigation sidebar for feature switching
 * Follows dashboard conventions with glassmorphism styling
 */

'use client';

import { useState } from 'react';

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

interface NavSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function NavSidebar({ activeTab, onTabChange }: NavSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <nav
      className="hidden lg:flex flex-col h-full nav-sidebar"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        width: isExpanded ? '200px' : '64px',
        transition: 'width 0.2s ease-in-out',
      }}
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
              @23
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

      {/* Bottom Section - Expand indicator */}
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
    </nav>
  );
}
