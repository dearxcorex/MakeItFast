/**
 * Navigation utilities with comprehensive error handling
 * Fixes Google Maps integration issues
 */

// Enhanced Google Maps URL generation with validation
export interface NavigationOptions {
  latitude: number;
  longitude: number;
  travelMode?: 'driving' | 'walking' | 'bicycling' | 'transit';
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  destination?: string;
}

export class NavigationUtils {
  private static readonly GOOGLE_MAPS_BASE_URL = 'https://www.google.com/maps/dir/';

  /**
   * Generate a validated Google Maps navigation URL
   */
  static generateGoogleMapsUrl(options: NavigationOptions): {
    url: string;
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const { latitude, longitude, travelMode = 'driving' } = options;

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      errors.push('Invalid coordinates: NaN values detected');
      return { url: '', isValid: false, errors };
    }

    if (latitude < -90 || latitude > 90) {
      errors.push(`Invalid latitude: ${latitude} (must be between -90 and 90)`);
    }

    if (longitude < -180 || longitude > 180) {
      errors.push(`Invalid longitude: ${longitude} (must be between -180 and 180)`);
    }

    // Validate travel mode
    const validTravelModes = ['driving', 'walking', 'bicycling', 'transit'];
    if (!validTravelModes.includes(travelMode)) {
      errors.push(`Invalid travel mode: ${travelMode}`);
    }

    if (errors.length > 0) {
      return { url: '', isValid: false, errors };
    }

    // Build URL
    const params = new URLSearchParams({
      api: '1',
      destination: `${latitude},${longitude}`,
      travelmode: travelMode
    });

    if (options.avoidHighways) {
      params.append('avoid', 'highways');
    }

    if (options.avoidTolls) {
      params.append('avoid', 'tolls');
    }

    if (options.destination) {
      params.set('destination', options.destination);
    }

    const url = `${this.GOOGLE_MAPS_BASE_URL}?${params.toString()}`;

    return { url, isValid: true, errors: [] };
  }

  /**
   * Safe navigation with comprehensive error handling
   */
  static async navigateToGoogleMaps(
    options: NavigationOptions,
    onError?: (error: string) => void
  ): Promise<boolean> {
    try {

      const result = this.generateGoogleMapsUrl(options);

      if (!result.isValid) {
        const errorMsg = `Invalid navigation parameters: ${result.errors.join(', ')}`;
        console.error('❌ Navigation error:', errorMsg);
        onError?.(errorMsg);
        return false;
      }

      // Skip popup test - it's too restrictive and may give false positives
      // Modern browsers handle popups differently during user interaction

      // Attempt navigation with multiple fallback strategies

      try {
        // Method 1: Try standard window.open
        const navigationWindow = window.open(result.url, '_blank');

        if (navigationWindow && !navigationWindow.closed) {

          // Brief check if window stays open
          setTimeout(() => {
            if (navigationWindow.closed) {
              console.warn('⚠️ Navigation window was closed by user or browser');
            }
          }, 1000);

          return true;
        }

        // Method 2: Fallback to location assignment (same tab)
        const userConfirmed = confirm(
          'Popup blocked. Open Google Maps in this tab instead?\n\n' +
          'Click OK to navigate (you can use back button to return)'
        );

        if (userConfirmed) {
          window.location.href = result.url;
          return true;
        }

        // Method 3: Copy to clipboard
        try {
          await navigator.clipboard.writeText(result.url);
          alert(
            '📋 Google Maps URL copied to clipboard!\n\n' +
            'Paste it in a new browser tab to navigate.\n\n' +
            `URL: ${result.url.substring(0, 60)}...`
          );
          return true;
        } catch {
          // Method 4: Show URL for manual copy
          const copyUrl = prompt(
            'Unable to open Google Maps or copy to clipboard.\n\n' +
            'Copy this URL manually:',
            result.url
          );
          return copyUrl !== null;
        }

      } catch (error) {
        console.error('❌ Navigation error:', error);
        onError?.(`Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }

    } catch (error) {
      const errorMsg = `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌ Navigation exception:', error);
      onError?.(errorMsg);
      return false;
    }
  }

  /**
   * Create a safe click handler for navigation buttons
   */
  static createNavigationClickHandler(
    options: NavigationOptions,
    onError?: (error: string) => void,
    onSuccess?: () => void
  ) {
    return async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();


      // Add visual feedback
      const button = event.currentTarget as HTMLElement;
      const originalText = button.textContent;

      button.style.opacity = '0.7';
      button.style.cursor = 'wait';

      try {
        const success = await this.navigateToGoogleMaps(options, onError);

        if (success) {
          onSuccess?.();
          // Briefly show success state
          if (button.textContent) {
            const icon = button.querySelector('svg');
            if (icon) {
              button.innerHTML = '✅ Opening Maps...';
              setTimeout(() => {
                button.innerHTML = originalText || '';
                if (icon && button.firstChild) {
                  button.insertBefore(icon, button.firstChild);
                }
              }, 1500);
            }
          }
        }
      } catch (error) {
        console.error('Click handler error:', error);
        onError?.(`Navigation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        // Restore button state
        setTimeout(() => {
          button.style.opacity = '';
          button.style.cursor = '';
        }, 200);
      }
    };
  }

  /**
   * Test navigation functionality
   */
  static async testNavigation(): Promise<{
    popupsAllowed: boolean;
    clipboardAvailable: boolean;
    urlGeneration: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let popupsAllowed = false;
    let clipboardAvailable = false;
    let urlGeneration = true;

    // Test popup functionality
    try {
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (testWindow && !testWindow.closed) {
        popupsAllowed = true;
        testWindow.close();
      } else {
        errors.push('Popups are blocked');
      }
    } catch {
      errors.push('Popup test failed');
    }

    // Test clipboard functionality
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        clipboardAvailable = true;
      } else {
        errors.push('Clipboard API not available');
      }
    } catch {
      errors.push('Clipboard test failed');
    }

    // Test URL generation
    try {
      const result = this.generateGoogleMapsUrl({
        latitude: 13.7563,
        longitude: 100.5018
      });

      if (!result.isValid) {
        urlGeneration = false;
        errors.push('URL generation failed');
      }
    } catch {
      urlGeneration = false;
      errors.push('URL generation test failed');
    }

    return {
      popupsAllowed,
      clipboardAvailable,
      urlGeneration,
      errors
    };
  }

  /**
   * Get fallback navigation options if Google Maps fails
   */
  static getFallbackNavigationOptions(latitude: number, longitude: number): Array<{
    name: string;
    url: string;
    description: string;
  }> {
    return [
      {
        name: 'Apple Maps',
        url: `https://maps.apple.com/?daddr=${latitude},${longitude}`,
        description: 'Navigate with Apple Maps'
      },
      {
        name: 'Waze',
        url: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
        description: 'Navigate with Waze'
      },
      {
        name: 'OpenStreetMap',
        url: `https://www.openstreetmap.org/directions?to=${latitude},${longitude}`,
        description: 'View directions on OpenStreetMap'
      },
      {
        name: 'Copy Coordinates',
        url: `${latitude}, ${longitude}`,
        description: 'Copy coordinates to clipboard'
      }
    ];
  }
}

// Utility for creating enhanced navigation buttons
export interface NavigationButtonProps {
  latitude: number;
  longitude: number;
  stationName?: string;
  className?: string;
  children: React.ReactNode;
  onNavigationStart?: () => void;
  onNavigationEnd?: (success: boolean) => void;
  onError?: (error: string) => void;
}

export const createEnhancedNavigationButton = (props: NavigationButtonProps) => {
  const {
    latitude,
    longitude,
    stationName,
    className = '',
    onNavigationStart,
    onNavigationEnd,
    onError
  } = props;

  const handleClick = NavigationUtils.createNavigationClickHandler(
    {
      latitude,
      longitude,
      destination: stationName ? `${stationName} FM Station` : undefined
    },
    (error) => {
      onError?.(error);
      onNavigationEnd?.(false);

      // Show user-friendly error with fallback options
      NavigationUtils.getFallbackNavigationOptions(latitude, longitude);
    },
    () => {
      onNavigationEnd?.(true);
    }
  );

  return {
    onClick: (event: React.MouseEvent) => {
      onNavigationStart?.();
      handleClick(event);
    },
    className: `${className} cursor-pointer`,
    'aria-label': `Navigate to ${stationName || 'station location'} with Google Maps`,
    title: `Open in Google Maps: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
  };
};