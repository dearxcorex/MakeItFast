import { FMStation } from '@/types/station';

export const fmStations: FMStation[] = [
  {
    id: '1',
    name: 'KROQ',
    frequency: 106.7,
    latitude: 34.0522,
    longitude: -118.2437,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Alternative Rock',
    description: 'World famous KROQ - Alternative Rock',
    website: 'https://kroq.radio.com',
    transmitterPower: 58000
  },
  {
    id: '2',
    name: 'KLOS',
    frequency: 95.5,
    latitude: 34.1022,
    longitude: -118.3437,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Classic Rock',
    description: 'Classic Rock of Southern California',
    website: 'https://klos.com',
    transmitterPower: 50000
  },
  {
    id: '3',
    name: 'KPWR',
    frequency: 105.9,
    latitude: 34.0722,
    longitude: -118.2937,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Hip Hop',
    description: 'Power 106 - Hip Hop and R&B',
    transmitterPower: 44000
  },
  {
    id: '4',
    name: 'KCRW',
    frequency: 89.9,
    latitude: 34.0422,
    longitude: -118.4937,
    city: 'Santa Monica',
    state: 'CA',
    genre: 'Public Radio',
    description: 'Public Radio from Santa Monica College',
    website: 'https://kcrw.com',
    transmitterPower: 59000
  },
  {
    id: '5',
    name: 'KBIG',
    frequency: 104.3,
    latitude: 34.1422,
    longitude: -118.1437,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Adult Contemporary',
    description: 'My FM - Adult Contemporary Hits',
    transmitterPower: 25000
  },
  {
    id: '6',
    name: 'KFWB',
    frequency: 93.1,
    latitude: 33.9522,
    longitude: -118.2237,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Top 40',
    description: 'Jack FM - Playing What We Want',
    transmitterPower: 40000
  },
  {
    id: '7',
    name: 'KDAY',
    frequency: 93.5,
    latitude: 34.0322,
    longitude: -118.2737,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Old School Hip Hop',
    description: 'Old School 93.5 KDAY',
    transmitterPower: 30000
  },
  {
    id: '8',
    name: 'KIIS',
    frequency: 102.7,
    latitude: 34.0622,
    longitude: -118.2137,
    city: 'Los Angeles',
    state: 'CA',
    genre: 'Top 40',
    description: 'Kiss FM - Today\'s Hit Music',
    website: 'https://1027kiisfm.com',
    transmitterPower: 50000
  }
];

export const getUniqueGenres = (): string[] => {
  const genres = fmStations.map(station => station.genre);
  return Array.from(new Set(genres)).sort();
};

export const getUniqueCities = (): string[] => {
  const cities = fmStations.map(station => station.city);
  return Array.from(new Set(cities)).sort();
};