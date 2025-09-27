// University SSO configuration
export interface UniversityConfig {
  name: string;
  domain: string;
  ssoUrl: string;
  icon?: string;
  displayName: string;
}

// Common university SSO configurations
export const UNIVERSITY_CONFIGS: UniversityConfig[] = [
  {
    name: 'polimi',
    domain: 'polimi.it',
    displayName: 'Politecnico di Milano',
    ssoUrl: 'https://auth.polimi.it/sso/login',
    icon: '🎓'
  },
  {
    name: 'unimi',
    domain: 'unimi.it',
    displayName: 'Università degli Studi di Milano',
    ssoUrl: 'https://auth.unimi.it/sso/login',
    icon: '🎓'
  },
  {
    name: 'unibo',
    domain: 'unibo.it',
    displayName: 'Università di Bologna',
    ssoUrl: 'https://auth.unibo.it/sso/login',
    icon: '🎓'
  },
  {
    name: 'sapienza',
    domain: 'uniroma1.it',
    displayName: 'Sapienza Università di Roma',
    ssoUrl: 'https://auth.uniroma1.it/sso/login',
    icon: '🎓'
  },
  {
    name: 'unito',
    domain: 'unito.it',
    displayName: 'Università degli Studi di Torino',
    ssoUrl: 'https://auth.unito.it/sso/login',
    icon: '🎓'
  },
  {
    name: 'unina',
    domain: 'unina.it',
    displayName: 'Università degli Studi di Napoli',
    ssoUrl: 'https://auth.unina.it/sso/login',
    icon: '🎓'
  }
];

// Generic university template for unknown domains
const GENERIC_UNIVERSITY_TEMPLATE: Omit<UniversityConfig, 'domain'> = {
  name: 'generic',
  displayName: 'Your University',
  ssoUrl: '', // Will be set dynamically
  icon: '🎓'
};

/**
 * Detects university from email domain
 */
export function detectUniversityFromEmail(email: string): UniversityConfig | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  const domain = email.split('@')[1].toLowerCase();
  
  // Find exact match
  const exactMatch = UNIVERSITY_CONFIGS.find(config => config.domain === domain);
  if (exactMatch) {
    return exactMatch;
  }

  // Check for subdomain matches (e.g., student.polimi.it)
  const subdomainMatch = UNIVERSITY_CONFIGS.find(config => 
    domain.endsWith('.' + config.domain)
  );
  if (subdomainMatch) {
    return subdomainMatch;
  }

  // For unknown domains, create a generic configuration
  if (domain.includes('.edu') || domain.includes('.ac.')) {
    return {
      ...GENERIC_UNIVERSITY_TEMPLATE,
      domain,
      displayName: domain.split('.')[0].toUpperCase(),
      ssoUrl: `https://auth.${domain}/sso/login`
    };
  }

  return null;
}

/**
 * Validates if email looks like a university email
 */
export function isValidUniversityEmail(email: string): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@')[1].toLowerCase();
  
  // Check against known university domains
  const isKnownUniversity = UNIVERSITY_CONFIGS.some(config => 
    domain === config.domain || domain.endsWith('.' + config.domain)
  );

  // Check for common academic domain patterns
  const isAcademicDomain = domain.includes('.edu') || 
                          domain.includes('.ac.') ||
                          domain.includes('university') ||
                          domain.includes('univ') ||
                          domain.includes('polimi') ||
                          domain.includes('unimi');

  return isKnownUniversity || isAcademicDomain;
}

/**
 * Gets SSO redirect URL for university
 */
export function getSSORedirectUrl(university: UniversityConfig, returnTo?: string): string {
  const baseUrl = university.ssoUrl;
  const params = new URLSearchParams();
  
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  
  // Add any university-specific parameters
  params.set('client_id', process.env.NEXT_PUBLIC_SSO_CLIENT_ID || 'sui-vote-app');
  params.set('response_type', 'code');
  params.set('scope', 'openid email profile');
  
  return `${baseUrl}?${params.toString()}`;
}
