import { getAuth, type Auth } from 'firebase/auth';
import { app } from './config';

// Modular Firebase Authentication instance
export const auth: Auth = getAuth(app);

export default auth;
