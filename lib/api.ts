import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE,
  withCredentials: true, // keep session cookie from /auth/* if your backend sets one
});

// Helpers
export const getJSON = async <T>(url: string) => (await api.get<T>(url)).data;
export const postJSON = async <T>(url: string, body?: any) => (await api.post<T>(url, body)).data;

export const endpoints = {
  polls: () => `/polls`,
  poll: (id: string) => `/poll/${id}`,
  pollTally: (id: string) => `/poll/${id}/tally`,
  vote: () => `/vote`,                 // POST { pollId, projectId, ephemeralPublicKey?, ... }
  authStart: (provider: string, returnTo?: string) =>
    `/auth/start?provider=${provider}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`,
  // New SSO endpoints
  ssoStart: (university: string, email: string, returnTo?: string) =>
    `/auth/sso/start?university=${university}&email=${encodeURIComponent(email)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`,
  ssoCallback: () => `/auth/sso/callback`,
  me: () => `/me`,                     // returns user/session status
  adminCreatePoll: () => `/admin/create-poll`,
  adminRegisterTeam: () => `/admin/register-team`,
  adminFinalize: (id: string) => `/admin/poll/${id}/finalize`,
  authenticateEmail: () => `/api/authenticate-email`, // New endpoint for email authentication
};
