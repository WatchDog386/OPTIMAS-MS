import { Redirect } from 'expo-router';
import { homeFor, useAuth } from '../src/store/auth';

export default function Index() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={homeFor(user.role)} />;
}
