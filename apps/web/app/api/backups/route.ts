import {handleBackup} from '@/lib/backup-api';
export const runtime='nodejs';
export const maxDuration=60;
export const GET=handleBackup,POST=handleBackup,DELETE=handleBackup;
