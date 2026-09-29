import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../../lib/admin-auth'

export default async function AdminPage() {
  const cookieStore = await cookies()
  if (!isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect('/admin/login')

  return <AdminDashboard />
}
