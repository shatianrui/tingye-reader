import Reader from './reader-client';
import { requestUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requestUser();if(!user)redirect('/login');return <Reader userId={user.userId}/>;}
