'use client';

import { FMStation, UserLocation } from '@/types/station';
import { useTheme } from '@/contexts/ThemeContext';
import type { InterferenceStats } from '@/components/interference/InterferenceAnalysis';

interface AppHeaderProps {
  filteredStations: FMStation[];
  userLocation?: UserLocation;
  activeTab?: string;
  interferenceStats?: InterferenceStats | null;
}

export default function AppHeader({ filteredStations, userLocation, activeTab, interferenceStats }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const isInterference = activeTab === 'interference';

  return (
    <header className="glass-card border-b border-border/50 px-4 lg:px-6 py-3 relative z-10 mx-4 mt-4 rounded-2xl">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-gold">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-heading font-bold gradient-text">Task Tracker</h1>
              <p className="text-xs text-muted-foreground">
                {userLocation ? `Location: ±${userLocation.accuracy?.toFixed(0)}m` : 'NBTC FM Monitoring'}
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{userLocation ? `±${userLocation.accuracy?.toFixed(0)}m accuracy` : 'NBTC FM Monitoring'}</span>
          </div>
        </div>

        {/* Right: Desktop Stats */}
        <div className="hidden lg:flex items-center gap-3">
          {isInterference && interferenceStats ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">{interferenceStats.total}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sites</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-green-400">{interferenceStats.inspected}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span className="text-sm font-bold text-amber-400">{interferenceStats.pending}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Critical" />
                <span className="text-xs font-bold text-red-400">{interferenceStats.critical}</span>
                <div className="w-px h-4 bg-border mx-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Major" />
                <span className="text-xs font-bold text-amber-400">{interferenceStats.major}</span>
                <div className="w-px h-4 bg-border mx-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" title="Minor" />
                <span className="text-xs font-bold text-yellow-400">{interferenceStats.minor}</span>
              </div>
            </>
          ) : !isInterference && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">{filteredStations.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Stations</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-green-400">{filteredStations.filter(s => s.onAir).length}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-sm font-bold text-red-400">{filteredStations.filter(s => !s.onAir).length}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Inspected" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Pending" />
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400" title="Off Air" />
                </div>
              </div>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 glass-card rounded-xl hover:bg-secondary/50 transition-all"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Stats */}
        <div className="flex lg:hidden items-center gap-2">
          {isInterference && interferenceStats ? (
            <>
              <span className="text-xs font-bold text-primary">{interferenceStats.total}</span>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-xs text-green-400">{interferenceStats.inspected}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span className="text-xs text-amber-400">{interferenceStats.pending}</span>
              </div>
              <div className="w-px h-3 bg-border" />
            </>
          ) : !isInterference && (
            <>
              <span className="text-xs font-bold text-primary">{filteredStations.length}</span>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-xs text-green-400">{filteredStations.filter(s => s.onAir).length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span className="text-xs text-red-400">{filteredStations.filter(s => !s.onAir).length}</span>
              </div>
              <div className="w-px h-3 bg-border" />
            </>
          )}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary/50 transition-all"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
