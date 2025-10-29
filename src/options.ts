import { DEFAULT_RESUME, DEFAULT_SETTINGS } from './shared/defaults';
import { Resume, ResumeEducation, ResumeExperience, Settings } from './shared/types';
import { getResume, getSettings, setResume, setSettings } from './shared/storage';

document.addEventListener('DOMContentLoaded', () => {
  hydrateForms().catch((error) => console.error('Failed to load options', error));
  bindForms();
});

async function hydrateForms(): Promise<void> {
  const [resume, settings] = await Promise.all([getResume(), getSettings()]);
  populateResumeForm(resume ?? DEFAULT_RESUME);
  populateSettingsForm(settings ?? DEFAULT_SETTINGS);
}

function bindForms(): void {
  const resumeForm = document.getElementById('resume-form') as HTMLFormElement | null;
  const settingsForm = document.getElementById('settings-form') as HTMLFormElement | null;

  resumeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const status = document.getElementById('resume-status');
    try {
      const resume = readResumeForm(form);
      await setResume(resume);
      if (status) {
        status.textContent = 'Resume saved';
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = 'Failed to save resume';
      }
    }
  });

  settingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const status = document.getElementById('settings-status');
    try {
      const settings = readSettingsForm(form);
      await setSettings(settings);
      if (status) {
        status.textContent = 'Settings saved';
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = 'Failed to save settings';
      }
    }
  });
}

function populateResumeForm(resume: Resume): void {
  const form = document.getElementById('resume-form') as HTMLFormElement | null;
  if (!form) {
    return;
  }

  const setValue = (name: string, value: string): void => {
    const element = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    if (element) {
      element.value = value;
    }
  };

  setValue('firstName', resume.firstName);
  setValue('lastName', resume.lastName);
  setValue('preferredName', resume.preferredName);
  setValue('email', resume.email);
  setValue('phone', resume.phone);
  setValue('address', resume.address);
  setValue('city', resume.city);
  setValue('state', resume.state);
  setValue('postalCode', resume.postalCode);
  setValue('country', resume.country);
  setValue('linkedin', resume.linkedin);
  setValue('website', resume.website);
  setValue('summary', resume.summary);
  setValue('skills', resume.skills.join(', '));
  setValue('experiences', resume.experiences.map(formatExperience).join('\n'));
  setValue('education', resume.education.map(formatEducation).join('\n'));
}

function populateSettingsForm(settings: Settings): void {
  const form = document.getElementById('settings-form') as HTMLFormElement | null;
  if (!form) {
    return;
  }

  const setValue = (name: string, value: string | boolean): void => {
    const element = form.elements.namedItem(name) as HTMLInputElement | null;
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else {
        element.value = String(value ?? '');
      }
    }
  };

  setValue('apiBaseUrl', settings.apiBaseUrl);
  setValue('sheetId', settings.sheetId);
  setValue('sheetRange', settings.sheetRange);
  setValue('aliasDomain', settings.aliasDomain);
}

function readResumeForm(form: HTMLFormElement): Resume {
  const getValue = (name: string): string => {
    const element = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    return element?.value?.trim() ?? '';
  };

  const experiences = parseExperiences(getValue('experiences'));
  const education = parseEducation(getValue('education'));
  const skills = getValue('skills')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    firstName: getValue('firstName'),
    lastName: getValue('lastName'),
    preferredName: getValue('preferredName'),
    email: getValue('email'),
    phone: getValue('phone'),
    address: getValue('address'),
    city: getValue('city'),
    state: getValue('state'),
    postalCode: getValue('postalCode'),
    country: getValue('country'),
    linkedin: getValue('linkedin'),
    website: getValue('website'),
    summary: getValue('summary'),
    experiences,
    education,
    skills
  };
}

function readSettingsForm(form: HTMLFormElement): Settings {
  const getValue = (name: string, fallback = ''): string => {
    const element = form.elements.namedItem(name) as HTMLInputElement | null;
    return element?.value?.trim() ?? fallback;
  };

  return {
    apiBaseUrl: getValue('apiBaseUrl', DEFAULT_SETTINGS.apiBaseUrl),
    sheetId: getValue('sheetId'),
    sheetRange: getValue('sheetRange', DEFAULT_SETTINGS.sheetRange),
    aliasDomain: getValue('aliasDomain', DEFAULT_SETTINGS.aliasDomain),
    autofillEnabled: DEFAULT_SETTINGS.autofillEnabled,
    trustBadgeEnabled: DEFAULT_SETTINGS.trustBadgeEnabled
  };
}

function parseExperiences(raw: string): ResumeExperience[] {
  if (!raw) {
    return [];
  }

  return raw.split('\n').map((line) => {
    const [titlePart, companyPart, datePart, descriptionPart] = line.split('|').map((value) => value.trim());
    const [startDate, endDate] = splitDateRange(datePart ?? '');
    return {
      title: titlePart ?? '',
      company: companyPart ?? '',
      startDate,
      endDate,
      description: descriptionPart ?? ''
    };
  });
}

function parseEducation(raw: string): ResumeEducation[] {
  if (!raw) {
    return [];
  }

  return raw.split('\n').map((line) => {
    const [degreePart, schoolPart, datePart] = line.split('|').map((value) => value.trim());
    const [startDate, endDate] = splitDateRange(datePart ?? '');
    return {
      degree: degreePart ?? '',
      school: schoolPart ?? '',
      field: '',
      startDate,
      endDate
    };
  });
}

function splitDateRange(raw: string): [string, string] {
  if (!raw) {
    return ['', ''];
  }

  const parts = raw.split(/–|-/).map((value) => value.trim());
  const start = parts[0] ?? '';
  const end = parts[1] ?? '';
  return [start, end];
}

function formatExperience(experience: ResumeExperience): string {
  const date = [experience.startDate, experience.endDate].filter(Boolean).join(' – ');
  return [experience.title, experience.company, date, experience.description].filter(Boolean).join(' | ');
}

function formatEducation(education: ResumeEducation): string {
  const date = [education.startDate, education.endDate].filter(Boolean).join(' – ');
  return [education.degree, education.school, date].filter(Boolean).join(' | ');
}
