interface ImportMetaEnv {
  /** Set to "live" to call the Java backend through the /api proxy instead of the in-browser mock. */
  readonly VITE_API_MODE?: 'mock' | 'live'
}

declare module '@fontsource-variable/rubik'
