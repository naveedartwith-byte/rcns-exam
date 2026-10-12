import { getFunctions, type Functions } from 'firebase/functions';
import { app } from './config';

// Regional Functions instance (Asia Mumbai / asia-south1) matching Cloud Firestore
export const functions: Functions = getFunctions(app, 'asia-south1');

export default functions;
