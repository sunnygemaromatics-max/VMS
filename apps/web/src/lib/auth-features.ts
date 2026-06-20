const isProd = process.env.NODE_ENV === 'production';

export const PUBLIC_SIGNUP_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === 'true' || !isProd;

export const PASSWORD_RESET_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RESET === 'true' || !isProd;
