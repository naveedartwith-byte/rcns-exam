import { getFirestore, type Firestore } from 'firebase/firestore';
import { app } from './config';

// Modular Cloud Firestore instance (Region: Asia Mumbai / asia-south1)
export const db: Firestore = getFirestore(app);

export default db;
