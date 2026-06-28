import { useEffect, useState } from 'react'

export default function UserAvatar({ user, className = 'sidebar-avatar', size = 40 }) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = (user?.name || user?.email || 'JP')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => setImageFailed(false), [user?.avatarUrl])

  return (
    <span className={className} style={{ '--avatar-size': `${size}px` }} aria-label={`${user?.name || 'JobPilot user'} profile photo`}>
      {user?.avatarUrl && !imageFailed
        ? <img src={user.avatarUrl} alt={`${user?.name || 'JobPilot user'} profile`} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : <span aria-hidden="true">{initials || 'JP'}</span>}
    </span>
  )
}
