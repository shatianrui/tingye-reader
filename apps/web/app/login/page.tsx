import Login from './login-client';
import {requestUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){if(await requestUser())redirect('/');return <Login/>;}
