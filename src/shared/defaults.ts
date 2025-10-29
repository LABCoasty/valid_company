import { Resume, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: 'http://localhost:8000/api/v1',
  sheetId: '',
  sheetRange: 'Applications!A:G',
  aliasDomain: 'gmail.com',
  autofillEnabled: true,
  trustBadgeEnabled: true
};

export const DEFAULT_RESUME: Resume = {
  firstName: '',
  lastName: '',
  preferredName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  linkedin: '',
  website: '',
  summary: '',
  experiences: [],
  education: [],
  skills: []
};
