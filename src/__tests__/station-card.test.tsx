import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

// Mock mapHelpers
vi.mock('@/utils/mapHelpers', () => ({
  formatInspectionDate: (d: string) => d,
}));

import StationCard from '@/components/map/StationCard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeStation = (overrides = {}) => ({
  id: '1',
  name: 'Test FM',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'Bangkok',
  state: 'Bangkok',
  genre: 'FM',
  type: 'สถานีวิทยุ',
  onAir: true,
  inspection68: 'ยังไม่ตรวจ',
  inspection69: 'ยังไม่ตรวจ',
  submitRequest: 'ยื่น',
  details: '',
  ...overrides,
});

describe('StationCard', () => {
  it('renders station name and frequency', () => {
    const { container } = render(<StationCard station={makeStation()} />);
    expect(container.textContent).toContain('Test FM');
    expect(container.textContent).toContain('98.5 FM');
  });

  it('renders on-air status', () => {
    const { container } = render(<StationCard station={makeStation({ onAir: true })} />);
    expect(container.textContent).toContain('On Air');
  });

  it('renders off-air status', () => {
    const { container } = render(<StationCard station={makeStation({ onAir: false })} />);
    expect(container.textContent).toContain('Off Air');
  });

  it('shows genre badge', () => {
    const { container } = render(<StationCard station={makeStation({ genre: 'FM' })} />);
    expect(container.textContent).toContain('FM');
  });

  it('shows Main badge for สถานีหลัก type', () => {
    const { container } = render(<StationCard station={makeStation({ type: 'สถานีหลัก' })} />);
    expect(container.textContent).toContain('Main');
  });

  it('renders Set On/Off button with onUpdateStation', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <StationCard station={makeStation({ onAir: true })} onUpdateStation={onUpdate} />
    );
    const setOffBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Set Off')
    );
    expect(setOffBtn).toBeTruthy();
  });

  it('renders Record inspection button when inspection props are provided', () => {
    const onUpdate = vi.fn();
    const onCreateInspection = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <StationCard
        station={makeStation()}
        onUpdateStation={onUpdate}
        currentUser={{ id: 1, displayName: 'iff' }}
        inspectors={[]}
        inspectionHistory={[]}
        onCreateInspection={onCreateInspection}
      />
    );
    const recordBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Record inspection')
    );
    expect(recordBtn).toBeTruthy();
  });

  it('toggles on-air when button clicked', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <StationCard station={makeStation({ onAir: true })} onUpdateStation={onUpdate} />
    );
    const setOffBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Set Off')
    )!;

    await act(async () => {
      fireEvent.click(setOffBtn);
    });

    expect(onUpdate).toHaveBeenCalledWith('1', { onAir: false });
    vi.useRealTimers();
  });

  it('opens NewInspectionForm when Record inspection button clicked', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onCreateInspection = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <StationCard
        station={makeStation()}
        onUpdateStation={onUpdate}
        currentUser={{ id: 1, displayName: 'iff' }}
        inspectors={[]}
        inspectionHistory={[]}
        onCreateInspection={onCreateInspection}
      />
    );
    const recordBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Record inspection')
    )!;

    await act(async () => {
      fireEvent.click(recordBtn);
    });

    // After clicking, the form should be visible (the panel hides the trigger when recording)
    const stillHasRecordBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Record inspection')
    );
    expect(stillHasRecordBtn).toBeFalsy();
  });

  it('renders hashtag detail buttons with onUpdateStation', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <StationCard station={makeStation()} onUpdateStation={onUpdate} />
    );
    expect(container.textContent).toContain('#deviation');
    expect(container.textContent).toContain('#intermod');
  });

  it('toggles details hashtag on click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <StationCard station={makeStation({ details: '' })} onUpdateStation={onUpdate} />
    );
    const devBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('#deviation')
    )!;

    await act(async () => {
      fireEvent.click(devBtn);
    });

    expect(onUpdate).toHaveBeenCalledWith('1', { details: '#deviation' });
  });

  it('omits the legacy "Inspected:" date row even when dateInspected is set', () => {
    const { container } = render(
      <StationCard station={makeStation({ dateInspected: '2026-01-15' })} />
    );
    // The card no longer renders its own dateInspected label;
    // history dates live inside InspectionPanel (mounted only when inspection
    // props are provided).
    expect(container.textContent).not.toContain('Inspected:');
  });

  it('shows station index when provided', () => {
    const { container } = render(
      <StationCard
        station={makeStation()}
        showStationIndex={{ current: 2, total: 5 }}
      />
    );
    expect(container.textContent).toContain('Station 2 of 5');
  });

  it('shows ไม่ยื่นคำขอ when submitRequest is ไม่ยื่น and off air', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <StationCard
        station={makeStation({ submitRequest: 'ไม่ยื่น', onAir: false })}
        onUpdateStation={onUpdate}
      />
    );
    expect(container.textContent).toContain('ไม่ยื่นคำขอ');
  });

  it('renders mobile variant with border class', () => {
    const { container } = render(
      <StationCard station={makeStation()} isMobile={true} />
    );
    expect(container.firstElementChild?.className).toContain('border');
  });

  it('does not show update buttons without onUpdateStation', () => {
    const { container } = render(<StationCard station={makeStation()} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('does not render InspectionPanel when inspection props are missing', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <StationCard station={makeStation()} onUpdateStation={onUpdate} />
    );
    const recordBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Record inspection')
    );
    expect(recordBtn).toBeFalsy();
  });
});
